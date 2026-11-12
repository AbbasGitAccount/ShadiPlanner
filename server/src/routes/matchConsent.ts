import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { pool } from '../data/postgres.js';
import { transaction } from '../data/adminDatabase.js';

const router=Router();
router.use(authenticateToken,(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/suggestions',async(req:AuthenticatedRequest,res,next)=> {
  try {res.json((await pool.query(`SELECT m.id,m.created_at,
    CASE WHEN a.user_id=$1 THEN b.full_name ELSE a.full_name END AS partner_name,
    CASE WHEN a.user_id=$1 THEN m.first_consent ELSE m.second_consent END AS consent,
    (m.first_consent=TRUE AND m.second_consent=TRUE) AS mutual_consent,
    CASE WHEN m.first_consent=TRUE AND m.second_consent=TRUE THEN CASE WHEN a.user_id=$1 THEN b.id ELSE a.id END ELSE NULL END AS partner_id
    FROM assisted_matches m JOIN matrimonial_profiles a ON a.id=m.first_id JOIN matrimonial_profiles b ON b.id=m.second_id
    WHERE (a.user_id=$1 OR b.user_id=$1) AND a.is_verified AND b.is_verified AND NOT EXISTS(SELECT 1 FROM auth_users u WHERE u.id IN (a.user_id,b.user_id) AND u.suspended) ORDER BY m.created_at DESC LIMIT 100`,[req.user!.id])).rows);}catch(e){next(e);}
});
router.put('/suggestions/:id',async(req:AuthenticatedRequest,res,next)=> {
  try {
    if(typeof req.body?.consent!=='boolean'){res.status(400).json({message:'Choose accept or decline'});return;}
    const count=await transaction(async c=> {
      const m=(await c.query(`SELECT m.*,a.user_id AS first_user,b.user_id AS second_user FROM assisted_matches m JOIN matrimonial_profiles a ON a.id=m.first_id JOIN matrimonial_profiles b ON b.id=m.second_id WHERE m.id=$1 AND (a.user_id=$2 OR b.user_id=$2) FOR UPDATE OF m`,[req.params.id,req.user!.id])).rows[0];
      if(!m)return 0;
      const col=m.first_user===req.user!.id?'first_consent':'second_consent';
      await c.query(`UPDATE assisted_matches SET ${col}=$2 WHERE id=$1`,[m.id,req.body.consent]);return 1;
    });
    if(!count){res.status(404).json({message:'Suggestion not found'});return;}
    res.json({message:'Your choice has been saved. Contact details remain private. Use the regular interest flow to connect.'});
  }catch(e){next(e);}
});
router.post('/reports/:profileId',async(req:AuthenticatedRequest,res,next)=> {
  try {
    const reason=req.body?.reason;
    if(typeof reason!=='string'||reason.trim().length<10||reason.length>1000){res.status(400).json({message:'Describe the concern in 10–1,000 characters'});return;}
    const result=await pool.query(`INSERT INTO profile_reports(reporter_id,profile_id,reason) SELECT $1,p.id,$3 FROM matrimonial_profiles p WHERE p.id=$2 AND p.user_id<>$1 AND NOT EXISTS(SELECT 1 FROM profile_reports WHERE reporter_id=$1 AND profile_id=$2 AND status='open') RETURNING id`,[req.user!.id,req.params.profileId,reason.trim()]);
    res.status(result.rowCount?201:409).json({message:result.rowCount?'Report sent to the moderation team':'Profile unavailable or already reported'});
  }catch(e){next(e);}
});
export default router;
