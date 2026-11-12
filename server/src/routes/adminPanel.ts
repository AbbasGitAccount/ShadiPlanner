import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../data/postgres.js';
import { audit, transaction } from '../data/adminDatabase.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { subscriptionPlans } from '../data/subscriptionDatabase.js';
import { checkoutAvailability } from '../services/subscriptionPayments.js';
import { isDeepStrictEqual } from 'node:util';

const router = Router();
router.use(authenticateToken, requireAdmin, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
class InputError extends Error { constructor(message: string, public status = 400) { super(message); } }
const run = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res).then(value => { if (!res.headersSent) res.json(value); }).catch(e => e instanceof InputError ? res.status(e.status).json({ message: e.message }) : next(e)); };
const actor = (r: AuthenticatedRequest) => r.user!.id;
function paging(r: Request) {
  const page = Number(r.query.page ?? 1); if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new InputError('Invalid page');
  return { page, offset: (page - 1) * 20 };
}
function dates(r: Request) {
  const start = String(r.query.start || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const end = String(r.query.end || new Date().toISOString().slice(0, 10));
  if (![start,end].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d) || start > end || Date.parse(end)-Date.parse(start)>366*86400000) throw new InputError('Choose a valid date range of up to one year');
  return [start+'T00:00:00+05:30', end+'T23:59:59.999+05:30'];
}
const search = (r: Request) => { const q = String(r.query.q || ''); if(q.length>120) throw new InputError('Search is too long'); return '%'+q+'%'; };
const userSelect = `SELECT u.id,u.created_at,u.suspended,u.last_active_at,p.id AS profile_id,p.full_name,p.city,p.gender,p.age,p.religion,p.is_verified,p.review_status,
  CASE WHEN s.cancelled_at IS NOT NULL THEN 'cancelled' WHEN s.expires_at<=NOW() THEN 'expired' ELSE COALESCE(s.status,'free') END AS subscription_status,COALESCE(s.plan_id,'free') AS plan_id,
  COUNT(*) OVER()::int AS total FROM auth_users u LEFT JOIN matrimonial_profiles p ON p.user_id=u.id LEFT JOIN user_subscriptions s ON s.user_id=u.id`;
router.get('/analytics', run(async r => {
  const d = dates(r);
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const kpis = (await c.query(`SELECT
      (SELECT COUNT(*)::int FROM auth_users WHERE role='user') AS total_users,
      (SELECT COUNT(*)::int FROM auth_users WHERE role='user' AND NOT suspended AND last_active_at>=NOW()-INTERVAL '30 days') AS active_users,
      (SELECT COUNT(*)::int FROM matrimonial_profiles p JOIN auth_users u ON p.user_id=u.id WHERE u.role='user' AND gender='Male') AS male_users,
      (SELECT COUNT(*)::int FROM matrimonial_profiles p JOIN auth_users u ON p.user_id=u.id WHERE u.role='user' AND gender='Female') AS female_users,
      (SELECT COUNT(*)::int FROM auth_users WHERE role='user' AND created_at::timestamptz BETWEEN $1 AND $2) AS new_registrations,
      (SELECT COUNT(*)::int FROM subscription_interests WHERE payload->>'status'='accepted' AND (payload->>'respondedAt')::timestamptz BETWEEN $1 AND $2) AS successful_matches,
      (SELECT COUNT(*)::int FROM user_subscriptions WHERE status='active' AND cancelled_at IS NULL AND expires_at>NOW()) AS active_subscriptions,
      (SELECT COALESCE(SUM(amount_paise),0)::float8 FROM subscription_orders WHERE status='paid' AND paid_at BETWEEN $1 AND $2) AS revenue_paise`,d)).rows[0];
    const series = (await c.query(`WITH days AS (SELECT generate_series(($1::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,($2::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,INTERVAL '1 day')::date AS day),
      registrations AS (SELECT (created_at::timestamptz AT TIME ZONE 'Asia/Kolkata')::date AS day,COUNT(*)::int AS value FROM auth_users WHERE role='user' AND created_at::timestamptz BETWEEN $1 AND $2 GROUP BY day),
      revenue AS (SELECT (paid_at AT TIME ZONE 'Asia/Kolkata')::date AS day,SUM(amount_paise)::float8 AS value FROM subscription_orders WHERE status='paid' AND paid_at BETWEEN $1 AND $2 GROUP BY day),
      matches AS (SELECT ((payload->>'respondedAt')::timestamptz AT TIME ZONE 'Asia/Kolkata')::date AS day,COUNT(*)::int AS value FROM subscription_interests WHERE payload->>'status'='accepted' AND (payload->>'respondedAt')::timestamptz BETWEEN $1 AND $2 GROUP BY day)
      SELECT days.day::text,COALESCE(r.value,0) AS registrations,
      ((SELECT COUNT(*) FROM auth_users WHERE role='user' AND created_at::timestamptz<$1)+SUM(COALESCE(r.value,0)) OVER(ORDER BY days.day))::int AS growth,
      COALESCE(v.value,0)::float8 AS revenue,COALESCE(m.value,0) AS matches
      FROM days LEFT JOIN registrations r USING(day) LEFT JOIN revenue v USING(day) LEFT JOIN matches m USING(day) ORDER BY days.day`,d)).rows;
    const distribution = (await c.query(`SELECT p.id,p.configuration->>'name' AS name,
      CASE WHEN p.id='free' THEN (SELECT COUNT(*)::int FROM auth_users a WHERE role='user' AND NOT EXISTS(SELECT 1 FROM user_subscriptions s WHERE s.user_id=a.id AND status='active' AND cancelled_at IS NULL AND expires_at>NOW()))
      ELSE (SELECT COUNT(*)::int FROM user_subscriptions s JOIN auth_users a ON a.id=s.user_id WHERE a.role='user' AND s.plan_id=p.id AND status='active' AND cancelled_at IS NULL AND expires_at>NOW()) END AS count FROM subscription_plans p ORDER BY CASE p.id WHEN 'free' THEN 0 WHEN 'gold' THEN 1 ELSE 2 END`)).rows;
    await c.query('COMMIT'); return { kpis, series, distribution };
  } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}));
router.get('/users', run(async r => {
  const {page,offset}=paging(r); const status=String(r.query.status||'');const d=dates(r);
  const rows=(await pool.query(`${userSelect} WHERE u.role='user' AND (COALESCE(p.full_name,'') ILIKE $1 OR u.id ILIKE $1 OR COALESCE(p.city,'') ILIKE $1)
    AND ($2='' OR ($2='suspended' AND u.suspended) OR ($2='pending' AND NOT p.is_verified AND p.review_status NOT IN ('rejected','hidden')) OR ($2='rejected' AND p.review_status='rejected') OR ($2='hidden' AND NOT p.is_verified AND p.review_status='hidden') OR ($2='verified' AND p.is_verified))
    AND ($6::boolean OR u.created_at::timestamptz BETWEEN $4 AND $5) ORDER BY u.created_at DESC,u.id LIMIT 20 OFFSET $3`,[search(r),status,offset,...d,r.query.period!=='range'])).rows;
  return {rows,total:rows[0]?.total||0,page};
}));
router.get('/users/:id',run(async r=> {
  return transaction(async c=> {
    const p=(await c.query(`SELECT to_jsonb(p)-'phone'-'email'-'date_of_birth' AS profile,u.created_at,u.last_active_at,u.suspended FROM auth_users u LEFT JOIN matrimonial_profiles p ON p.user_id=u.id WHERE u.id=$1 AND u.role='user'`,[r.params.id])).rows[0];
    if(!p) throw new InputError('Member not found',404);
    await audit(c,actor(r),'view_profile',r.params.id);
    const history=(await c.query("SELECT action,created_at FROM (SELECT action,created_at FROM admin_audit WHERE target_id=$1 UNION ALL SELECT action,created_at FROM account_activity WHERE user_id=$1) h ORDER BY created_at DESC LIMIT 30",[r.params.id])).rows;
    const subscription=(await c.query('SELECT plan_id,status,started_at,expires_at,cancelled_at FROM user_subscriptions WHERE user_id=$1',[r.params.id])).rows[0]||null;
    p.subscription=subscription;
    p.subscriptionHistory=(await c.query('SELECT plan_id,status,started_at,expires_at,cancelled_at,recorded_at,plan_snapshot FROM subscription_history WHERE user_id=$1 ORDER BY recorded_at DESC,id DESC LIMIT 30',[r.params.id])).rows;
    return {...p,history};
  });
}));
router.put('/users/:id',run(async r=>transaction(async c=> {
  const action=r.body?.action;
  if(!['approve','reject','verify','hide','suspend','reactivate'].includes(action)) throw new InputError('Invalid member action');
  const u=await c.query("SELECT id FROM auth_users WHERE id=$1 AND role='user' FOR UPDATE",[r.params.id]);
  if(!u.rowCount) throw new InputError('Member not found',404);
  if(action==='suspend'||action==='reactivate') await c.query('UPDATE auth_users SET suspended=$2,auth_version=auth_version+1 WHERE id=$1',[r.params.id,action==='suspend']);
  else {
    const result=await c.query(`UPDATE matrimonial_profiles SET is_verified=$2,review_status=$3,verification_reviewed_by=$4,verification_reviewed_at=$5 WHERE user_id=$1 AND updated_at=$6`,[r.params.id,action==='approve'||action==='verify',action==='reject'?'rejected':action==='hide'?'hidden':'approved',actor(r),new Date().toISOString(),r.body.expectedUpdatedAt]);
    if(!result.rowCount) throw new InputError('Profile changed. Open it again before reviewing.',409);
  }
  await audit(c,actor(r),action,r.params.id); return {message:'Member updated'};
})));
router.get('/plans',run(async()=>({plans:await subscriptionPlans(),checkout:await checkoutAvailability()})));
router.put('/plans/:id',run(async r=>transaction(async c=> {
  const old=(await c.query('SELECT configuration FROM subscription_plans WHERE id=$1 FOR UPDATE',[r.params.id])).rows[0]?.configuration;
  if(!old) throw new InputError('Plan not found',404);
  if(!isDeepStrictEqual(old,r.body.expected)) throw new InputError('Plan changed. Refresh before saving.',409);
  const p=r.body.plan;
  if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>60||!Number.isSafeInteger(p.pricePaise)||p.pricePaise<0||p.pricePaise>100000000||(old.id==='free'?p.pricePaise!==0:p.pricePaise===0)) throw new InputError('Enter a valid name and price');
  if(old.id!=='free'&&(!Number.isSafeInteger(p.durationDays)||p.durationDays<1||p.durationDays>3660)) throw new InputError('Duration must be 1–3660 days');
  for(const k of ['interestLimit','browseLimit']) if(p[k]!==null&&(!Number.isSafeInteger(p[k])||p[k]<0||p[k]>1000000)) throw new InputError('Invalid plan limits');
  for(const k of ['enabled','advancedSearch','contactDetails','enhancedVisibility','compatibleFirst','premiumBadge']) if(typeof p[k]!=='boolean') throw new InputError('Invalid feature setting');
  if(!['standard','priority','dedicated'].includes(p.support)||old.id==='free'&&!p.enabled) throw new InputError('Free plan must remain available');
  const updated={...old,name:p.name.trim(),pricePaise:p.pricePaise,durationDays:old.id==='free'?null:p.durationDays,interestLimit:p.interestLimit,browseLimit:p.browseLimit,support:p.support,
    ...Object.fromEntries(['enabled','advancedSearch','contactDetails','enhancedVisibility','compatibleFirst','premiumBadge'].map(k=>[k,p[k]]))};
  await c.query('UPDATE subscription_plans SET configuration=$2 WHERE id=$1',[old.id,updated]);
  await audit(c,actor(r),'plan_change',old.id,{before:old,after:updated}); return updated;
})));
router.get('/subscriptions',run(async r=> {
  const {page,offset}=paging(r); const d=dates(r);
  const rows=(await pool.query(`SELECT user_id,plan_id,started_at,expires_at,plan_snapshot,cancelled_at,CASE WHEN cancelled_at IS NOT NULL THEN 'cancelled' WHEN expires_at<=NOW() THEN 'expired' ELSE status END AS status,COUNT(*) OVER()::int AS total
    FROM user_subscriptions WHERE started_at BETWEEN $1 AND $2 AND ($3='' OR plan_id=$3 OR user_id ILIKE $4) AND ($5='' OR CASE WHEN cancelled_at IS NOT NULL THEN 'cancelled' WHEN expires_at<=NOW() THEN 'expired' ELSE status END=$5) ORDER BY started_at DESC,user_id LIMIT 20 OFFSET $6`,[...d,String(r.query.q||''),search(r),String(r.query.status||''),offset])).rows;
  return {rows,total:rows[0]?.total||0,page};
}));
router.post('/subscriptions/:id/cancel',run(async r=>transaction(async c=> {
  const result=await c.query("UPDATE user_subscriptions SET cancelled_at=NOW() WHERE user_id=$1 AND cancelled_at IS NULL RETURNING user_id",[r.params.id]);
  if(!result.rowCount) throw new InputError('Subscription unavailable',409);
  await audit(c,actor(r),'cancel_subscription',r.params.id); return {message:'Subscription cancelled; access ends immediately. No refund has been issued.'};
})));
router.get('/payments',run(async r=> {
  const {page,offset}=paging(r);const d=dates(r);
  const rows=(await pool.query(`SELECT id,user_id,plan_id,amount_paise,currency,status,created_at,paid_at,COUNT(*) OVER()::int AS total FROM subscription_orders WHERE created_at BETWEEN $1 AND $2 AND ($3='' OR status=$3) ORDER BY created_at DESC,id LIMIT 20 OFFSET $4`,[...d,String(r.query.status||''),offset])).rows;
  return {rows,total:rows[0]?.total||0,page};
}));
router.get('/matches',run(async r=> {
  const {page,offset}=paging(r);const d=dates(r);
  const rows=(await pool.query(`SELECT i.id,a.full_name AS sender,b.full_name AS receiver,i.payload->>'status' AS status,i.sent_at,COUNT(*) OVER()::int AS total FROM subscription_interests i
    JOIN matrimonial_profiles a ON a.id=i.sender_profile_id JOIN matrimonial_profiles b ON b.id=i.receiver_profile_id
    WHERE ($1='' OR i.payload->>'status'=$1) AND (a.full_name ILIKE $2 OR b.full_name ILIKE $2 OR a.city ILIKE $2 OR b.city ILIKE $2 OR a.religion ILIKE $2 OR b.religion ILIKE $2)
    AND ($3::int IS NULL OR (a.age>=$3 AND b.age>=$3)) AND ($4::int IS NULL OR (a.age<=$4 AND b.age<=$4))
    AND (NOT $6::boolean OR (${preferenceSql('a','b')} AND ${preferenceSql('b','a')})) AND i.sent_at BETWEEN $7 AND $8
    ORDER BY sent_at DESC,i.id LIMIT 20 OFFSET $5`,[String(r.query.status||''),search(r),age(r.query.minAge),age(r.query.maxAge),offset,r.query.preferences==='mutual',...d])).rows;
  const totals=(await pool.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE payload->>'status'='accepted')::int AS accepted,COUNT(*) FILTER(WHERE payload->>'status'='declined')::int AS rejected,COUNT(*) FILTER(WHERE payload->>'status'='pending')::int AS pending FROM subscription_interests WHERE sent_at BETWEEN $1 AND $2`,d)).rows[0];
  return {rows,total:rows[0]?.total||0,page,totals};
}));
// Aliases and column names below are internal constants, never request input.
function preferenceSql(a: string,b: string) {
  const p=`${a}.partner_preferences`;
  const lists=[['religions','religion'],['communities','community'],['motherTongues','mother_tongue'],['educationLevels','highest_education'],['occupations','profession'],['locations','city'],['diet','diet'],['maritalStatus','marital_status']];
  return `${b}.age BETWEEN (${p}->>'minAge')::int AND (${p}->>'maxAge')::int AND ${b}.height BETWEEN (${p}->>'minHeight')::float8 AND (${p}->>'maxHeight')::float8 AND ${b}.annual_income>=COALESCE((${p}->>'minIncome')::float8,0) AND `+
    lists.map(([key,col])=>`(jsonb_array_length(COALESCE(${p}->'${key}','[]'::jsonb))=0 OR ${p}->'${key}' ? ${b}.${col} OR ${p}->'${key}' ? 'Any')`).join(' AND ');
}
function age(v: unknown) { if(v===undefined||v==='') return null; const n=Number(v);if(!Number.isInteger(n)||n<18||n>120) throw new InputError('Age must be 18–120');return n; }
router.get('/suggestions',run(async()=>({rows:(await pool.query(`SELECT m.*,a.full_name AS first_name,b.full_name AS second_name FROM assisted_matches m JOIN matrimonial_profiles a ON a.id=m.first_id JOIN matrimonial_profiles b ON b.id=m.second_id ORDER BY m.created_at DESC LIMIT 100`)).rows})));
router.post('/suggestions',run(async r=>transaction(async c=> {
  if(![r.body?.firstId,r.body?.secondId].every(v=>typeof v==='string'&&v.length<100)||r.body.firstId===r.body.secondId) throw new InputError('Choose two different profiles');
  const ids=[r.body.firstId,r.body.secondId].sort();
  const found=await c.query(`SELECT p.id FROM matrimonial_profiles p JOIN auth_users u ON u.id=p.user_id WHERE p.id=ANY($1::text[]) AND p.is_verified AND NOT u.suspended AND u.role='user' FOR UPDATE OF u,p`,[ids]);
  if(found.rowCount!==2) throw new InputError('Both members must be approved and active');
  const result=await c.query('INSERT INTO assisted_matches(first_id,second_id,created_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[...ids,actor(r)]);
  if(!result.rowCount) throw new InputError('Suggestion already exists',409);
  await audit(c,actor(r),'suggest_match',String(result.rows[0].id));return {message:'Suggestion sent for independent consent from both members'};
})));
router.get('/reports',run(async r=> {
  const {page,offset}=paging(r);const d=dates(r);
  const rows=(await pool.query(`SELECT r.id,r.profile_id,p.full_name,r.reason,r.status,r.created_at,COUNT(*) OVER()::int AS total FROM profile_reports r JOIN matrimonial_profiles p ON p.id=r.profile_id WHERE r.created_at BETWEEN $1 AND $2 ORDER BY r.created_at DESC,r.id DESC LIMIT 20 OFFSET $3`,[...d,offset])).rows;
  const revenue=(await pool.query(`SELECT plan_id,to_char(paid_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM') AS period,COUNT(*)::int AS transactions,SUM(amount_paise)::float8 AS amount_paise FROM subscription_orders WHERE status='paid' AND paid_at BETWEEN $1 AND $2 GROUP BY plan_id,period ORDER BY period DESC,plan_id`,d)).rows;
  return {rows,total:rows[0]?.total||0,page,revenue};
}));
router.put('/reports/:id',run(async r=>transaction(async c=> {
  if(!['resolved','dismissed'].includes(r.body?.status)) throw new InputError('Invalid report status');
  if(!(await c.query('UPDATE profile_reports SET status=$2 WHERE id=$1 AND status=\'open\' RETURNING id',[r.params.id,r.body.status])).rowCount) throw new InputError('Report unavailable',409);
  await audit(c,actor(r),'review_report',r.params.id,{status:r.body.status});return {message:'Report reviewed'};
})));
router.get('/audit',run(async r=> {const {page,offset}=paging(r);const d=dates(r);const rows=(await pool.query('SELECT *,COUNT(*) OVER()::int AS total FROM admin_audit WHERE created_at BETWEEN $2 AND $3 ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $1',[offset,...d])).rows;return {rows,total:rows[0]?.total||0,page};}));
router.get('/export/:kind',run(async(r,res)=> {
  const d=dates(r);let rows: Record<string,unknown>[];
  if(r.params.kind==='users') rows=(await pool.query(`SELECT u.id,p.full_name,p.city,u.created_at,u.suspended,p.is_verified FROM auth_users u LEFT JOIN matrimonial_profiles p ON p.user_id=u.id WHERE u.role='user' AND u.created_at::timestamptz BETWEEN $1 AND $2 ORDER BY u.id LIMIT 10001`,d)).rows;
  else if(r.params.kind==='subscriptions') rows=(await pool.query(`SELECT user_id,plan_id,CASE WHEN cancelled_at IS NOT NULL THEN 'cancelled' WHEN expires_at<=NOW() THEN 'expired' ELSE status END AS status,started_at,expires_at,cancelled_at FROM user_subscriptions WHERE started_at BETWEEN $1 AND $2 ORDER BY user_id LIMIT 10001`,d)).rows;
  else if(r.params.kind==='revenue') rows=(await pool.query("SELECT id,user_id,plan_id,amount_paise,currency,paid_at FROM subscription_orders WHERE status='paid' AND paid_at BETWEEN $1 AND $2 ORDER BY id LIMIT 10001",d)).rows;
  else throw new InputError('Unknown export');
  if(rows.length>10000) throw new InputError('Narrow your date range to export at most 10,000 records');
  await audit(pool,actor(r),'export',r.params.kind,{start:d[0],end:d[1],count:rows.length});
  const cell=(v:unknown)=>{let s=v instanceof Date?v.toISOString():String(v??'');if(/^[=+\-@\t\r\n]/.test(s)) s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  res.set('Content-Disposition',`attachment; filename="${r.params.kind}.csv"`).type('text/csv').send(rows.length?[Object.keys(rows[0]).map(cell).join(','),...rows.map(row=>Object.values(row).map(cell).join(','))].join('\r\n'):'No records\r\n');
}));
export default router;
