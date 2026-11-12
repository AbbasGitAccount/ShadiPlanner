import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createTransport, normalizeBase } from '../src/lib/transport.ts';

test('API configuration requires HTTPS for releases and keeps secrets out of URLs', () => {
  assert.equal(normalizeBase('https://api.example.com/api/', false), 'https://api.example.com/api');
  assert.equal(normalizeBase('http://10.0.2.2:5000', true), 'http://10.0.2.2:5000/api');
  for (const url of ['http://api.example.com', 'https://user:secret@api.example.com', 'https://api.example.com?token=secret', 'file:///tmp']) assert.throws(() => normalizeBase(url, false));
});
test('requests send the current bearer token and encode bodies without persisting credentials', async () => {
  const previous = global.fetch;
  try {
    let captured;
    global.fetch = async (url, options) => { captured = {url, options}; return new Response(JSON.stringify({id:'saved'}), {status:200}); };
    const request = createTransport('https://api.example.com/api', () => 'session-token', () => assert.fail());
    assert.deepEqual(await request('/auth/me'), {id:'saved'});
    assert.equal(captured.url, 'https://api.example.com/api/auth/me');
    assert.equal(captured.options.headers.Authorization, 'Bearer session-token');
    await request('/profiles/member', {aboutMe:'Updated'}, 'PUT');
    assert.equal(captured.options.method, 'PUT');assert.equal(captured.options.body, '{"aboutMe":"Updated"}');
    await assert.rejects(request('https://attacker.invalid'), ApiError);
  } finally { global.fetch = previous; }
});
test('expired sessions clear authentication but late responses cannot end a newer session', async () => {
  const previous = global.fetch;
  try {
    let token='old';let expired=0;
    const request=createTransport('https://api.example.com/api',()=>token,()=>expired++);
    global.fetch=async()=>new Response('{"message":"Session ended"}',{status:401});
    await assert.rejects(request('/auth/me'),e=>e.status===401);assert.equal(expired,1);
    global.fetch=async()=>{token='new';return new Response('{"message":"Session ended"}',{status:401});};
    await assert.rejects(request('/auth/me'),e=>e.status===401);assert.equal(expired,1);
  } finally {global.fetch=previous;}
});
test('server field errors, proxy failures and CSV responses are handled without fabricated success', async () => {
  const previous=global.fetch;
  try {
    const request=createTransport('https://api.example.com/api',()=>null,()=>assert.fail());
    global.fetch=async()=>new Response('{"message":"Invalid birth date","fieldErrors":{"dateOfBirth":"Check this date"}}',{status:400});
    await assert.rejects(request('/auth/register',{}),e=>e.fields.dateOfBirth==='Check this date');
    global.fetch=async()=>new Response('',{status:500});
    await assert.rejects(request('/auth/login',{}),e=>e.status===500&&e.message.includes('HTTP 500'));
    global.fetch=async()=>new Response('id,amount\r\n1,99900',{status:200});
    assert.equal(await request('/admin/export/revenue',undefined,'GET','text'),'id,amount\r\n1,99900');
    global.fetch=async()=>{throw new TypeError('Network failed');};
    await assert.rejects(request('/auth/me'),e=>e.status===0&&e.message.includes('Cannot reach'));
  } finally {global.fetch=previous;}
});
