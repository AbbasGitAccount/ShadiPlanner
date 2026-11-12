import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/forms/accountSecurity.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { validatePasswordUpdate, phoneInputError, preparePhoneInput } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('reports all missing password fields with readable messages', () => {
  const errors = validatePasswordUpdate({ currentPassword: '', newPassword: '', confirmPassword: '' });
  assert.deepEqual(Object.keys(errors), ['currentPassword', 'newPassword', 'confirmPassword']);
});
test('validates password length, confirmation, reuse, and accepts corrected answers', () => {
  assert.ok(validatePasswordUpdate({ currentPassword: 'old', newPassword: 'short', confirmPassword: 'different' }).newPassword);
  assert.ok(validatePasswordUpdate({ currentPassword: 'same-password', newPassword: 'same-password', confirmPassword: 'same-password' }).newPassword);
  assert.ok(validatePasswordUpdate({ currentPassword: 'old', newPassword: '\u00e9'.repeat(37), confirmPassword: '\u00e9'.repeat(37) }).newPassword);
  assert.deepEqual(validatePasswordUpdate({ currentPassword: 'old-password', newPassword: 'new-password', confirmPassword: 'new-password' }), {});
});
test('requires an international phone number and accepts spaces and punctuation', () => {
  assert.ok(phoneInputError('9876543210'));
  assert.ok(phoneInputError(''));
  assert.equal(phoneInputError('+1 (650) 555-0100'), undefined);
});

test('adds the selected country code and explains when a full number was entered twice', () => {
  assert.deepEqual(preparePhoneInput('98765 43210', '+91'), { number: '+919876543210', error: undefined });
  assert.match(preparePhoneInput('+91 98765 43210', '+91').error, /country code is already selected/);
  assert.equal(preparePhoneInput('650 555 0100', '+1').number, '+16505550100');
  assert.equal(preparePhoneInput('+44 7700 900000', '').error, undefined);
});
