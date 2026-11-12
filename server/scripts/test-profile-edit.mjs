import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

// Every write is confined to a new schema; existing accounts/data are untouched.
const schema = `profile_edit_test_${randomUUID().replaceAll('-', '')}`;
const administration = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
let pool;
let server;
try {
  await administration.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(process.env.DATABASE_URL);
  // Neon transaction poolers reject startup search_path; use its direct endpoint
  // for the isolated schema. The application's configured connection is unchanged.
  url.hostname = url.hostname.replace('-pooler.', '.');
  url.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.JWT_SECRET = 'isolated-subscription-test-secret';
  delete process.env.REDIS_URL;
  delete process.env.SUBSCRIPTION_DURATION_DAYS;
  process.env.GOLD_PRICE_PAISE = '99900'; process.env.PLATINUM_PRICE_PAISE = '199900'; process.env.FREE_PROFILE_LIMIT = '20';
  ({ pool } = await import('../dist/data/postgres.js'));
  await pool.query(`CREATE TABLE auth_users(id TEXT PRIMARY KEY,email TEXT,password_hash TEXT,role TEXT,created_at TEXT,auth_version INTEGER DEFAULT 0,phone TEXT,phone_verified BOOLEAN DEFAULT FALSE);
    CREATE TABLE app_migrations(name TEXT PRIMARY KEY,applied_at TIMESTAMPTZ DEFAULT NOW())`);
  const { initializeProfileDatabase, saveProfile } = await import('../dist/data/profileDatabase.js');
  const { initializeSubscriptions, membership, sendLimitedInterest, respondStoredInterest } = await import('../dist/data/subscriptionDatabase.js');
  const { SEED_PROFILES } = await import('../dist/data/mockData.js');
  const { db } = await import('../dist/data/db.js');
  // API view tracking still has a legacy mirror. Never write that real file in tests.
  db.save = () => {};
  db.saveProfileMirror = () => {};
  await initializeProfileDatabase([]);
  await initializeSubscriptions([]);
  await (await import('../dist/data/adminDatabase.js')).initializeAdminDatabase();
  for (const id of ['free-user', 'duplicate-user', 'gold-user', 'platinum-user']) await pool.query(`INSERT INTO auth_users(id,email,role,created_at) VALUES($1,$2,'user',$3)`, [id, `${id}@example.com`, new Date().toISOString()]);
  const template = SEED_PROFILES[0];
  const fixtures = await pool.connect();
  try {
    await fixtures.query('BEGIN');
    for (const id of ['free-user', 'duplicate-user', 'gold-user', 'platinum-user']) await saveProfile({ ...template, id: `own-${id}`, userId: id, gender: 'Male', isVerified: true }, fixtures);
    for (let i = 0; i < 30; i++) await saveProfile({ ...template, id: `target-${String(i).padStart(2, '0')}`, userId: `target-user-${i}`, gender: 'Female', isVerified: true }, fixtures);
    await fixtures.query('COMMIT');
  } finally { fixtures.release(); }
  console.log('Isolated schema and fixtures ready.');

  const { buildRegistrationProfile } = await import('../dist/models/registration.js');
  const bcrypt = (await import('bcryptjs')).default;
  const password='TestPassword!7';
  await pool.query('UPDATE auth_users SET password_hash=$1',[await bcrypt.hash(password,4)]);
  await pool.query(`CREATE UNIQUE INDEX email_unique ON auth_users(LOWER(email));
    CREATE TABLE account_security_attempts(user_id TEXT,action TEXT,window_started TIMESTAMPTZ DEFAULT NOW(),attempts INTEGER DEFAULT 1,PRIMARY KEY(user_id,action));
    CREATE TABLE phone_test_challenges(user_id TEXT PRIMARY KEY)`);
  const express=(await import('express')).default;
  const jwt=(await import('jsonwebtoken')).default;
  const app=express();app.use(express.json());
  app.use('/profiles',(await import('../dist/routes/profiles.js')).default);
  app.use('/security',(await import('../dist/routes/accountSecurity.js')).default);
  app.use('/auth',(await import('../dist/routes/auth.js')).default);
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  const token=jwt.sign({id:'free-user'},process.env.JWT_SECRET);
  const request=async(path,method,body,bearer=token)=>{const response=await fetch(root+path,{method,headers:{'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
  const details={fullName:'Updated Member',gender:'Other',dateOfBirth:'1997-03-19',height:'175',maritalStatus:'Divorced',motherTongue:'Kannada',religion:'No religious affiliation',community:'Updated community',subCommunity:'Updated sub-community',languagesKnown:'Kannada, Hindi',manglik:'Prefer not to say',gothram:'Updated gothram',rashi:'Updated rashi',nakshatra:'Updated nakshatra',highestEducation:'Diploma',collegeUniversity:'Updated college',profession:'Designer',company:'Updated company',annualIncome:'0',workLocation:'Remote',city:'Mysuru',state:'Karnataka',country:'India',citizenship:'Indian',familyType:'Joint',familyStatus:'Prefer not to say',fatherOccupation:'Retired',motherOccupation:'Retired',brothersCount:'0',sistersCount:'2',familyLocation:'Mysuru',aboutFamily:'Updated family introduction',diet:'Vegan',smoking:'No',drinking:'Occasionally',hobbies:'Reading, Music',aboutMe:'Updated introduction.',phone:'+91 90000 00000',minAge:'22',maxAge:'35',minHeight:'140',maxHeight:'200',minIncome:'0',preferredMaritalStatus:'Divorced',preferredReligions:'Any',preferredCommunities:'Any',preferredMotherTongues:'Kannada',preferredEducation:'Diploma',preferredOccupations:'Any',preferredLocations:'Mysuru',preferredDiet:'Vegan'};
  const patch=buildRegistrationProfile(details);
  const current=(await request('/profiles/own-free-user','GET')).data;
  assert.equal((await request('/profiles/own-free-user','PUT',patch,null)).status,401);
  assert.equal((await request('/profiles/own-gold-user','PUT',patch)).status,403);
  assert.equal((await request('/profiles/own-free-user','PUT',{height:5.5})).status,400);
  const saved=await request('/profiles/own-free-user','PUT',{...patch,email:'forged@example.com',phone:'+16505550100',userId:'gold-user',premiumMember:true,isVerified:true,age:99});
  assert.equal(saved.status,200);
  assert.equal(saved.data.email,current.email);assert.equal(saved.data.phone,current.phone);
  assert.equal(saved.data.userId,'free-user');assert.equal(saved.data.isVerified,false);assert.equal(saved.data.premiumMember,false);
  for(const key of Object.keys(patch))if(!['phone','galleryPhotos','isVerified','phoneVerified','govtIdVerified','premiumMember'].includes(key))assert.deepEqual(saved.data[key],patch[key],key);
  const reloaded=(await request('/profiles/own-free-user','GET')).data;
  assert.equal(reloaded.aboutFamily,'Updated family introduction');assert.equal(reloaded.collegeUniversity,'Updated college');
  assert.deepEqual(reloaded.languagesKnown,['Kannada','Hindi']);assert.equal(reloaded.heightFormatted,'5 ft 9 in (175 cm)');
  const wrong=await request('/security/email','POST',{newEmail:'updated@example.com',confirmEmail:'updated@example.com',currentPassword:'wrong'});assert.equal(wrong.status,400);
  const conflict=await request('/security/email','POST',{newEmail:'gold-user@example.com',confirmEmail:'gold-user@example.com',currentPassword:password});assert.equal(conflict.status,409);
  assert.equal((await request('/profiles/own-free-user','GET')).data.email,current.email);
  const changed=await request('/security/email','POST',{newEmail:'UPDATED@example.com',confirmEmail:'updated@example.com',currentPassword:password});assert.equal(changed.status,200);
  const account=(await pool.query('SELECT email,auth_version FROM auth_users WHERE id=$1',['free-user'])).rows[0];
  const profileEmail=(await pool.query('SELECT email FROM matrimonial_profiles WHERE user_id=$1',['free-user'])).rows[0].email;
  assert.equal(account.email,'updated@example.com');assert.equal(profileEmail,account.email);assert.equal(account.auth_version,1);
  assert.equal((await request('/profiles/own-free-user','GET')).status,401);
  assert.equal((await request('/auth/login','POST',{email:'free-user@example.com',password},null)).status,401);
  assert.equal((await request('/auth/login','POST',{email:'updated@example.com',password},null)).status,200);
  console.log('PASS: all signup biodata fields save and reload; ownership and protected fields enforced; derived values and re-review correct; secure email change rejects wrong passwords/conflicts, synchronizes account/profile and revokes old sessions.');
} finally {
  if(server)await new Promise(resolve=>server.close(resolve));
  if(pool)await pool.end();
  if(!/^profile_edit_test_[a-f0-9]+$/.test(schema))throw new Error('Invalid test schema');
  await administration.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await administration.end();
}
