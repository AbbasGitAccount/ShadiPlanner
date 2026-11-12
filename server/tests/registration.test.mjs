import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistrationProfile, RegistrationValidationError } from '../dist/models/registration.js';

const today = new Date('2026-11-06T12:00:00Z');
const details = {
  fullName: ' Test Member ', gender: 'Other', dateOfBirth: '2000-11-07', height: '182.88',
  maritalStatus: 'Divorced', motherTongue: 'Kannada', religion: 'No religious affiliation',
  highestEducation: 'Diploma', profession: 'Student', annualIncome: '0',
  city: 'Mysuru', state: 'Karnataka', country: 'India', citizenship: 'Indian',
  familyType: 'Joint', familyStatus: 'Prefer not to say', brothersCount: '0', sistersCount: '2',
  manglik: 'Prefer not to say', diet: 'Vegan', smoking: 'No', drinking: 'Occasionally',
  aboutMe: 'My own introduction.', phone: '+91 90000 00000',
  minAge: '22', maxAge: '35', minHeight: '140', maxHeight: '200', minIncome: '0',
};

test('preserves supplied details, zero income, and exact birthday age', () => {
  const profile = buildRegistrationProfile(details, today);
  assert.equal(profile.fullName, 'Test Member');
  assert.equal(profile.age, 25);
  assert.equal(profile.heightFormatted, '6 ft 0 in (182.88 cm)');
  assert.equal(profile.annualIncome, 0);
  assert.equal(profile.annualIncomeFormatted, '\u20b90 Lakhs / yr');
  assert.equal(profile.maritalStatus, 'Divorced');
  assert.equal(profile.familyType, 'Joint');
  assert.equal(profile.sistersCount, 2);
  assert.equal(profile.diet, 'Vegan');
  assert.equal(profile.isVerified, false);
});

test('leaves optional biodata empty instead of inventing personal facts', () => {
  const profile = buildRegistrationProfile(details, today);
  for (const field of ['community', 'company', 'fatherOccupation', 'motherOccupation', 'aboutFamily', 'workLocation', 'familyLocation']) {
    assert.equal(profile[field], '');
  }
  assert.deepEqual(profile.hobbies, []);
  assert.deepEqual(profile.languagesKnown, []);
  assert.deepEqual(profile.galleryPhotos, []);
  assert.equal(profile.profilePhoto, '/avatar-placeholder.svg');
  for (const field of ['religions', 'communities', 'motherTongues', 'occupations', 'locations', 'diet', 'maritalStatus', 'educationLevels']) {
    assert.deepEqual(profile.partnerPreferences[field], []);
  }
});

test('saves optional family details and only chosen partner preferences', () => {
  const profile = buildRegistrationProfile({ ...details,
    fatherOccupation: 'Retired', aboutFamily: 'Our family introduction.',
    languagesKnown: 'Kannada, English, Kannada, ', hobbies: 'Cycling, Painting',
    preferredReligions: 'Buddhist, Jain', preferredLocations: 'Mysuru, Bengaluru',
    preferredMaritalStatus: 'Divorced', preferredDiet: 'Vegan', preferredEducation: 'Diploma',
  }, today);
  assert.equal(profile.fatherOccupation, 'Retired');
  assert.equal(profile.aboutFamily, 'Our family introduction.');
  assert.deepEqual(profile.languagesKnown, ['Kannada', 'English']);
  assert.deepEqual(profile.hobbies, ['Cycling', 'Painting']);
  assert.deepEqual(profile.partnerPreferences.religions, ['Buddhist', 'Jain']);
  assert.deepEqual(profile.partnerPreferences.locations, ['Mysuru', 'Bengaluru']);
  assert.deepEqual(profile.partnerPreferences.maritalStatus, ['Divorced']);
  assert.deepEqual(profile.partnerPreferences.diet, ['Vegan']);
});

test('rejects missing, invalid, future and underage birth dates', () => {
  for (const dateOfBirth of ['', 'invalid', '2000-02-30', '2030-01-01', '2008-11-07']) {
    assert.throws(() => buildRegistrationProfile({ ...details, dateOfBirth }, today), RegistrationValidationError);
  }
  assert.equal(buildRegistrationProfile({ ...details, dateOfBirth: '2008-11-06' }, today).age, 18);
});

test('rejects missing fields, invalid choices, and malformed numeric values', () => {
  for (const change of [
    { gender: '' }, { maritalStatus: 'Unknown' }, { religion: '  ' }, { height: '' },
    { annualIncome: '' }, { annualIncome: -1 }, { annualIncome: true },
    { height: 'NaN' }, { height: 99 }, { brothersCount: '1.5' },
    { sistersCount: '' }, { phone: '123' }, { phone: 'abcdefghijk' },
    { diet: 'Unknown' }, { preferredDiet: 'Unknown' }, { city: {} },
  ]) assert.throws(() => buildRegistrationProfile({ ...details, ...change }, today), RegistrationValidationError);
});

test('rejects inverted or out-of-range partner preferences', () => {
  for (const change of [{ minAge: '40' }, { maxHeight: '130' }, { minIncome: '-1' }, { minAge: '17' }, { maxAge: '25.5' }]) {
    assert.throws(() => buildRegistrationProfile({ ...details, ...change }, today), RegistrationValidationError);
  }
});

test('reports which field prevents registration, using readable labels and units', () => {
  for (const [change, field, message] of [
    [{ height: '5.5' }, 'height', /your height \(cm\)/],
    [{ maxAge: '20' }, 'maxAge', /22 years or older/],
    [{ maxHeight: '130' }, 'maxHeight', /140 cm or taller/],
    [{ phone: 'abc' }, 'phone', /phone number/],
    [{ dateOfBirth: '2008-11-07' }, 'dateOfBirth', /date of birth/],
  ]) {
    assert.throws(() => buildRegistrationProfile({ ...details, ...change }, today), error =>
      error instanceof RegistrationValidationError && error.field === field && message.test(error.message));
  }
});
