import { MatrimonialProfile } from './types.js';

export class RegistrationValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

type ProfileDetails = Omit<MatrimonialProfile, 'id' | 'userId' | 'email' | 'createdAt' | 'updatedAt'>;

// Only explicitly supplied biodata belongs on a member's profile.
export function buildRegistrationProfile(input: unknown, today = new Date()): ProfileDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RegistrationValidationError('Please provide registration details.');
  }
  const data = input as Record<string, unknown>;
  const label = (name: string): string => ({
    minAge: 'partner age from', maxAge: 'partner age to',
    minHeight: 'partner height from (cm)', maxHeight: 'partner height to (cm)',
    height: 'your height (cm)', minIncome: 'partner minimum yearly income (lakhs)',
    annualIncome: 'your yearly income (lakhs)',
  }[name] || name.replace(/([A-Z])/g, ' $1').toLowerCase());
  const text = (name: string, required = false): string => {
    const value = data[name];
    if (value === undefined || value === null) {
      if (!required) return '';
      throw new RegistrationValidationError(`Please fill in ${label(name)}.`, name);
    }
    if (typeof value !== 'string' || value.length > (['aboutMe', 'aboutFamily'].includes(name) ? 4000 : 500)) {
      throw new RegistrationValidationError(`Please check ${label(name)} and shorten your answer if necessary.`, name);
    }
    if (required && !value.trim()) throw new RegistrationValidationError(`Please fill in ${label(name)}.`, name);
    return value.trim();
  };
  const number = (name: string, min: number, max: number, integer = false): number => {
    const value = data[name];
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
      throw new RegistrationValidationError(`Please enter a number for ${label(name)}.`, name);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
      throw new RegistrationValidationError(`Enter ${label(name)} as ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`, name);
    }
    return parsed;
  };
  const choice = <T extends string>(name: string, options: readonly T[]): T => {
    const value = text(name, true);
    if (!options.includes(value as T)) throw new RegistrationValidationError(`Please choose one of the listed options for ${label(name)}.`, name);
    return value as T;
  };
  const list = (name: string): string[] => [...new Set(text(name).split(',').map(value => value.trim()).filter(Boolean))];
  const maritalStatuses = ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'] as const;
  const diets = ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Jain', 'Vegan'] as const;
  const habits = ['No', 'Yes', 'Occasionally', 'Prefer not to say'] as const;
  const optionalChoice = <T extends string>(name: string, options: readonly T[]): T[] =>
    text(name) ? [choice(name, options)] : [];

  const dateOfBirth = text('dateOfBirth', true);
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateOfBirth) {
    throw new RegistrationValidationError('Enter your full date of birth: day, month and year.', 'dateOfBirth');
  }
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age--;
  if (age < 18 || age > 100) throw new RegistrationValidationError('Please check your date of birth. You must be aged 18 to 100 to register.', 'dateOfBirth');

  const height = number('height', 100, 250);
  const totalInches = Math.round(height / 2.54);
  const annualIncome = number('annualIncome', 0, 1000000);
  const phone = text('phone', true);
  if (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) {
    throw new RegistrationValidationError('Enter a phone number with 7 to 15 digits, including the country code.', 'phone');
  }
  const minAge = number('minAge', 18, 100, true);
  const maxAge = number('maxAge', 18, 100, true);
  const minHeight = number('minHeight', 100, 250);
  const maxHeight = number('maxHeight', 100, 250);
  if (minAge > maxAge) throw new RegistrationValidationError(`Your oldest preferred partner must be ${minAge} years or older, because your age range starts at ${minAge}.`, 'maxAge');
  if (minHeight > maxHeight) throw new RegistrationValidationError(`Your tallest preferred partner must be ${minHeight} cm or taller, because your height range starts at ${minHeight} cm.`, 'maxHeight');

  return {
    fullName: text('fullName', true),
    gender: choice('gender', ['Male', 'Female', 'Other'] as const),
    dateOfBirth, age, height,
    heightFormatted: `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in (${height} cm)`,
    maritalStatus: choice('maritalStatus', maritalStatuses),
    motherTongue: text('motherTongue', true), languagesKnown: list('languagesKnown'),
    religion: text('religion', true), community: text('community'), subCommunity: text('subCommunity'),
    gothram: text('gothram'), rashi: text('rashi'), nakshatra: text('nakshatra'),
    manglik: choice('manglik', ['Yes', 'No', 'Partial', 'Do not believe', 'Prefer not to say'] as const),
    highestEducation: text('highestEducation', true), collegeUniversity: text('collegeUniversity'),
    profession: text('profession', true), company: text('company'), annualIncome,
    annualIncomeFormatted: `\u20b9${annualIncome} Lakhs / yr`, workLocation: text('workLocation'),
    city: text('city', true), state: text('state', true), country: text('country', true), citizenship: text('citizenship', true),
    familyType: choice('familyType', ['Nuclear', 'Joint', 'Prefer not to say'] as const),
    familyStatus: choice('familyStatus', ['Middle Class', 'Upper Middle Class', 'Rich / Affluent', 'Prefer not to say'] as const),
    fatherOccupation: text('fatherOccupation'), motherOccupation: text('motherOccupation'),
    brothersCount: number('brothersCount', 0, 50, true), sistersCount: number('sistersCount', 0, 50, true),
    familyLocation: text('familyLocation'), aboutFamily: text('aboutFamily'),
    diet: choice('diet', [...diets, 'Prefer not to say'] as const),
    smoking: choice('smoking', habits), drinking: choice('drinking', habits), hobbies: list('hobbies'),
    profilePhoto: '/avatar-placeholder.svg', galleryPhotos: [], aboutMe: text('aboutMe', true),
    isVerified: false, phoneVerified: false, govtIdVerified: false, premiumMember: false, phone,
    partnerPreferences: {
      minAge, maxAge, minHeight, maxHeight, minIncome: number('minIncome', 0, 1000000),
      maritalStatus: optionalChoice('preferredMaritalStatus', maritalStatuses),
      religions: list('preferredReligions'), communities: list('preferredCommunities'),
      motherTongues: list('preferredMotherTongues'), educationLevels: list('preferredEducation'),
      occupations: list('preferredOccupations'), locations: list('preferredLocations'),
      diet: optionalChoice('preferredDiet', diets),
    },
  };
}
