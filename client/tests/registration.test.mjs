import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the same validator used by the form without starting a browser.
const loadTypeScript = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
const { sections, validateRegistration, heightDescription } = await loadTypeScript('../src/forms/registration.ts');
const { api, ApiError } = await loadTypeScript('../src/services/api.ts');
const today = new Date('2026-11-06T12:00:00Z');
const valid = {
  fullName: 'Test Member', email: 'member@example.com', password: 'a-good-password', phone: '+91 90000 00000',
  gender: 'Other', dateOfBirth: '2000-11-07', height: '165', maritalStatus: 'Divorced', religion: 'No religious affiliation',
  motherTongue: 'Kannada', manglik: 'Prefer not to say', highestEducation: 'Diploma', profession: 'Student', annualIncome: '0',
  city: 'Mysuru', state: 'Karnataka', country: 'India', citizenship: 'Indian', familyType: 'Joint', familyStatus: 'Prefer not to say',
  brothersCount: '0', sistersCount: '0', diet: 'Vegan', smoking: 'No', drinking: 'No', aboutMe: 'My introduction.',
  minAge: '22', maxAge: '35', minHeight: '140', maxHeight: '200', minIncome: '0',
};

test('shows every missing required field together, without flagging optional blanks', () => {
  const errors = validateRegistration({}, today);
  assert.deepEqual(Object.keys(errors), sections.flatMap(section => section.fields).filter(field => field.required).map(field => field.name));
  assert.deepEqual(validateRegistration(valid, today), {});
});

test('identifies the height field and explains centimetres for feet-like input', () => {
  const errors = validateRegistration({ ...valid, height: '5.5', minHeight: '5', maxHeight: '6' }, today);
  assert.deepEqual(Object.keys(errors), ['height', 'minHeight', 'maxHeight']);
  for (const message of Object.values(errors)) {
    assert.match(message, /100 and 250 cm/);
    assert.match(message, /5 ft 5 in/);
  }
  assert.equal(heightDescription('165'), '165 cm is about 5 ft 5 in.');
  assert.equal(heightDescription('5.5'), undefined);
});

test('points reversed ranges to the ending field with the actual starting value', () => {
  const errors = validateRegistration({ ...valid, minAge: '35', maxAge: '25', minHeight: '180', maxHeight: '160' }, today);
  assert.deepEqual(Object.keys(errors), ['maxAge', 'maxHeight']);
  assert.match(errors.maxAge, /35 years or older/);
  assert.match(errors.maxHeight, /180 cm or taller/);
  assert.deepEqual(validateRegistration({ ...valid, minAge: '35', maxAge: '35', minHeight: '180', maxHeight: '180' }, today), {});
});

test('accepts zero income and zero siblings, and rejects negative or fractional counts', () => {
  const errors = validateRegistration({ ...valid, annualIncome: '-1', minIncome: '-1', brothersCount: '1.5', sistersCount: '-1', minAge: '22.5' }, today);
  assert.deepEqual(Object.keys(errors), ['annualIncome', 'brothersCount', 'sistersCount', 'minAge', 'minIncome']);
  assert.deepEqual(validateRegistration(valid, today), {});
});

test('explains invalid dates and the exact adult age boundary', () => {
  for (const dateOfBirth of ['2000-02-30', '2030-01-01', '2008-11-07']) {
    assert.ok(validateRegistration({ ...valid, dateOfBirth }, today).dateOfBirth);
  }
  assert.equal(validateRegistration({ ...valid, dateOfBirth: '2008-11-06' }, today).dateOfBirth, undefined);
});

test('identifies email, password and phone problems together and clears corrected answers', () => {
  const errors = validateRegistration({ ...valid, email: 'invalid', password: '123', phone: 'abc' }, today);
  assert.deepEqual(Object.keys(errors), ['email', 'password', 'phone']);
  assert.ok(validateRegistration({ ...valid, fullName: '   ' }, today).fullName);
  assert.ok(validateRegistration({ ...valid, password: '\u00e9'.repeat(37) }, today).password);
  assert.deepEqual(validateRegistration(valid, today), {});
});

test('preserves server field errors so a rejected email can be highlighted', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    message: 'This email is already registered.', fieldErrors: { email: 'Log in or use another email address.' },
  }), { status: 409 });
  try {
    await assert.rejects(api.register(valid), error => error instanceof ApiError && error.fieldErrors.email === 'Log in or use another email address.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
