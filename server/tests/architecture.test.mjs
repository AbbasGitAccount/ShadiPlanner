import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { presentProfile, profilesConnected } from '../dist/models/profilePresentation.js';
import { validateProfilePatch } from '../dist/models/profileUpdate.js';
import { readJsonStore, writeJsonAtomically } from '../dist/data/jsonStore.js';

const first = { id: 'first', userId: 'owner', isVerified: true, phone: '+16505550100', email: 'owner@example.invalid' };
const second = { id: 'second', userId: 'visitor', isVerified: true, phone: '+16505550101', email: 'visitor@example.invalid' };
const profiles = [first, second];
const accepted = [{ senderProfileId: first.id, receiverProfileId: second.id, status: 'accepted' }];

test('one contact policy protects anonymous, pending, and unapproved requests', () => {
  assert.equal(presentProfile(first, undefined, profiles, accepted).isContactUnlocked, false);
  assert.notEqual(presentProfile(first, undefined, profiles, accepted).phone, first.phone);
  const visitor = { id: second.userId, role: 'user', membership: {plan:{contactDetails:true}} };
  assert.equal(presentProfile(first,{...visitor,membership:{plan:{contactDetails:false}}},profiles,accepted).isContactUnlocked,false);
  assert.equal(presentProfile(first, visitor, profiles, [{ ...accepted[0], status: 'pending' }]).isContactUnlocked, false);
  assert.equal(presentProfile(first, visitor, profiles, accepted).phone, first.phone);
  assert.equal(profilesConnected(second, first, accepted), true);
  assert.equal(presentProfile({ ...first, isVerified: false }, visitor, profiles, accepted).isContactUnlocked, false);
  assert.equal(presentProfile(first, { id: first.userId, role: 'user' }, profiles, []).phone, first.phone);
  assert.equal(presentProfile(first, { id: 'administrator', role: 'admin' }, profiles, []).isContactUnlocked, false);
});

test('profile editing validates values and cannot change identity or verification fields', () => {
  for (const data of [{ annualIncome: -1 }, { fullName: '  ' }, { profilePhoto: 'javascript:alert(1)' }, { partnerPreferences: { minAge: 40, maxAge: 20 } }, { diet: {} }]) assert.throws(() => validateProfilePatch(data));
  assert.deepEqual(validateProfilePatch({ fullName: ' New name ', phone: 'unverified', isVerified: true, userId: 'other-user' }), { fullName: 'New name' });
  assert.deepEqual(validateProfilePatch({ annualIncome: 0, annualIncomeFormatted: 'invented income' }), { annualIncome: 0, annualIncomeFormatted: '\u20b90 Lakhs / yr' });
  assert.throws(() => validateProfilePatch({ phoneVerified: true }));
});

test('local JSON writes replace complete files and corrupt files are preserved', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'shadiplanner-json-test-'));
  const file = path.join(folder, 'store.json');
  try {
    writeJsonAtomically(file, { messages: [] });
    writeJsonAtomically(file, { messages: [{ id: 'message' }] });
    assert.equal(readJsonStore(file, ['messages']).messages.length, 1);
    assert.deepEqual(fs.readdirSync(folder), ['store.json']);
    fs.writeFileSync(file, '{corrupt');
    assert.throws(() => readJsonStore(file, ['messages']));
    assert.equal(fs.readFileSync(file, 'utf8'), '{corrupt');
    fs.writeFileSync(file, '{"messages":{}}');
    assert.throws(() => readJsonStore(file, ['messages']));
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(folder);
  }
});
