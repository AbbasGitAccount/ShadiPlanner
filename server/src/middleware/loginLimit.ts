import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../data/postgres.js';

export async function loginLimit(req: Request,res: Response,next: NextFunction) {
  try {
    const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase().slice(0,500):'';
    // Separate account and network budgets work across server processes. Never store submitted credentials.
    const keys=[`account:${email}`,`network:${req.ip}`].map(s=>createHash('sha256').update(s).digest('hex'));
    let blocked=false;
    for(let i=0;i<keys.length;i++) {
      const row=(await pool.query(`INSERT INTO login_attempts(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET
        attempts=CASE WHEN login_attempts.window_started<NOW()-INTERVAL '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
        window_started=CASE WHEN login_attempts.window_started<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE login_attempts.window_started END RETURNING attempts`,[keys[i]])).rows[0];
      if(row.attempts>(i===0?10:100))blocked=true;
    }
    if(blocked){res.set('Retry-After','900').status(429).json({message:'Too many sign-in attempts. Please try again in 15 minutes.'});return;}
    next();
  }catch(e){next(e);}
}
