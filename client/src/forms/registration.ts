export interface Field {
  name: string; label: string; type?: string; options?: string[];
  required?: boolean; min?: number; max?: number; hint?: string;
}
const maritalStatuses = ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'];
const diets = ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Jain', 'Vegan'];
const habits = ['No', 'Yes', 'Occasionally', 'Prefer not to say'];

// Basic details required during initial registration without login
export const basicSections: { title: string; fields: Field[] }[] = [
  { title: 'Account information', fields: [
    { name: 'fullName', label: "Candidate's full name", required: true },
    { name: 'email', label: 'Email address', type: 'email', required: true },
    { name: 'password', label: 'Create password', type: 'password', required: true, hint: 'At least 6 characters.' },
    { name: 'phone', label: 'Phone number', type: 'tel', required: true, hint: 'Include your country code, e.g. +91 98765 43210.' },
  ] },
  { title: 'Basic personal details', fields: [
    { name: 'gender', label: 'Gender', options: ['Female', 'Male', 'Other'], required: true },
    { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, hint: 'You must be at least 18 to register.' },
    { name: 'maritalStatus', label: 'Marital status', options: maritalStatuses, required: true },
    { name: 'religion', label: 'Religion / belief', required: true },
    { name: 'motherTongue', label: 'Mother tongue', required: true },
    { name: 'city', label: 'City', required: true },
    { name: 'state', label: 'State / province', required: true },
  ] },
];

// All comprehensive biodata sections available when updating profile
export const fullBiodataSections: { title: string; fields: Field[] }[] = [
  { title: 'Personal & cultural biodata', fields: [
    { name: 'gender', label: 'Gender', options: ['Female', 'Male', 'Other'], required: true },
    { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, hint: 'You must be at least 18 to register.' },
    { name: 'height', label: 'Your height (centimetres)', type: 'number', min: 100, max: 250, required: true, hint: 'Enter 100 to 250 cm. For example, 165 cm is about 5 ft 5 in.' },
    { name: 'maritalStatus', label: 'Marital status', options: maritalStatuses, required: true },
    { name: 'religion', label: 'Religion / belief', required: true },
    { name: 'community', label: 'Community / caste' },
    { name: 'subCommunity', label: 'Sub-community' },
    { name: 'motherTongue', label: 'Mother tongue', required: true },
    { name: 'languagesKnown', label: 'Languages spoken', hint: 'Separate languages with commas.' },
    { name: 'manglik', label: 'Manglik status (astrology)', options: ['Yes', 'No', 'Partial', 'Do not believe', 'Prefer not to say'], required: true, hint: 'If this does not apply to you, choose “Prefer not to say”.' },
    { name: 'gothram', label: 'Gothram', hint: 'Leave blank if not applicable.' },
    { name: 'rashi', label: 'Rashi', hint: 'Leave blank if not applicable.' },
    { name: 'nakshatra', label: 'Nakshatra', hint: 'Leave blank if not applicable.' },
  ] },
  { title: 'Education & profession', fields: [
    { name: 'highestEducation', label: 'Highest education', required: true },
    { name: 'collegeUniversity', label: 'College / university' },
    { name: 'profession', label: 'Profession / current occupation', required: true },
    { name: 'company', label: 'Company / organization' },
    { name: 'annualIncome', label: 'Your yearly income (lakhs of rupees)', type: 'number', min: 0, max: 1000000, required: true, hint: 'For 5 lakh rupees a year, enter 5. Enter 0 if you have no income.' },
    { name: 'workLocation', label: 'Work location' },
  ] },
  { title: 'Location & citizenship', fields: [
    { name: 'city', label: 'City', required: true },
    { name: 'state', label: 'State / province', required: true },
    { name: 'country', label: 'Country of residence', required: true },
    { name: 'citizenship', label: 'Citizenship', required: true },
  ] },
  { title: 'Family background', fields: [
    { name: 'familyType', label: 'Family type', options: ['Nuclear', 'Joint', 'Prefer not to say'], required: true },
    { name: 'familyStatus', label: 'Family financial background', options: ['Middle Class', 'Upper Middle Class', 'Rich / Affluent', 'Prefer not to say'], required: true },
    { name: 'fatherOccupation', label: "Father's occupation" },
    { name: 'motherOccupation', label: "Mother's occupation" },
    { name: 'brothersCount', label: 'Number of brothers', type: 'number', min: 0, max: 50, required: true, hint: 'Enter 0 if you have no brothers.' },
    { name: 'sistersCount', label: 'Number of sisters', type: 'number', min: 0, max: 50, required: true, hint: 'Enter 0 if you have no sisters.' },
    { name: 'familyLocation', label: 'Family location' },
    { name: 'aboutFamily', label: 'About your family', type: 'textarea' },
  ] },
  { title: 'Lifestyle & introduction', fields: [
    { name: 'diet', label: 'Diet', options: [...diets, 'Prefer not to say'], required: true },
    { name: 'smoking', label: 'Smoking', options: habits, required: true },
    { name: 'drinking', label: 'Drinking', options: habits, required: true },
    { name: 'hobbies', label: 'Hobbies & interests', hint: 'Separate interests with commas.' },
    { name: 'aboutMe', label: 'About yourself & life goals', type: 'textarea', required: true },
  ] },
  { title: 'Partner preferences', fields: [
    { name: 'minAge', label: 'Partner age: from (years)', type: 'number', min: 18, max: 100, required: true, hint: 'The youngest partner you would consider, aged 18 to 100.' },
    { name: 'maxAge', label: 'Partner age: to (years)', type: 'number', min: 18, max: 100, required: true, hint: 'The oldest partner you would consider. Use the same age or an older age.' },
    { name: 'minHeight', label: 'Partner height: from (centimetres)', type: 'number', min: 100, max: 250, required: true, hint: 'The shortest partner you would consider. Enter 100 to 250 cm.' },
    { name: 'maxHeight', label: 'Partner height: to (centimetres)', type: 'number', min: 100, max: 250, required: true, hint: 'The tallest partner you would consider.' },
    { name: 'minIncome', label: 'Partner yearly income: at least (lakhs of rupees)', type: 'number', min: 0, max: 1000000, required: true, hint: 'For at least 5 lakh rupees a year, enter 5. Enter 0 if any income is fine.' },
    { name: 'preferredMaritalStatus', label: 'Marital status', options: maritalStatuses },
    { name: 'preferredReligions', label: 'Religions / beliefs' },
    { name: 'preferredCommunities', label: 'Communities' },
    { name: 'preferredMotherTongues', label: 'Mother tongues' },
    { name: 'preferredEducation', label: 'Education levels' },
    { name: 'preferredOccupations', label: 'Occupations' },
    { name: 'preferredLocations', label: 'Locations' },
    { name: 'preferredDiet', label: 'Diet', options: diets },
  ] },
];

// Default sections for initial registration without login
export const sections = basicSections;

export type FieldErrors = Record<string, string>;

export function heightDescription(value: string): string | undefined {
  if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < 100 || Number(value) > 250) return;
  const inches = Math.round(Number(value) / 2.54);
  return `${value} cm is about ${Math.floor(inches / 12)} ft ${inches % 12} in.`;
}

function validateFieldList(data: Record<string, string>, fieldList: Field[], today = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fieldList) {
    const raw = data[field.name] ?? '';
    const value = raw.trim();
    if (!value) {
      if (field.required) errors[field.name] = field.options
        ? `Please choose an option for ${field.label.toLowerCase()}.`
        : `Please fill in ${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.options && !field.options.includes(value)) {
      errors[field.name] = `Please choose one of the listed options for ${field.label.toLowerCase()}.`;
    } else if (field.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number)) errors[field.name] = `Please enter a number for ${field.label.toLowerCase()}.`;
      else if ((field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) {
        if (['height', 'minHeight', 'maxHeight'].includes(field.name)) {
          errors[field.name] = `Enter ${field.label.toLowerCase()} between 100 and 250 cm. For example, enter 165 for about 5 ft 5 in.`;
        } else if (['minAge', 'maxAge'].includes(field.name)) {
          errors[field.name] = 'Choose a partner age between 18 and 100 years.';
        } else if (['brothersCount', 'sistersCount'].includes(field.name)) {
          errors[field.name] = 'Enter a number from 0 to 50. Use 0 if none.';
        } else {
          errors[field.name] = 'Enter income from 0 to 1,000,000 lakhs. Use 0 for no income or no minimum.';
        }
      } else if (['brothersCount', 'sistersCount', 'minAge', 'maxAge'].includes(field.name) && !Number.isInteger(number)) {
        errors[field.name] = ['minAge', 'maxAge'].includes(field.name)
          ? 'Enter age in complete years, such as 25. Do not use a decimal point.'
          : 'Use a whole number, such as 0, 1 or 2, without a decimal point.';
      }
    } else if (field.name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.email = 'Enter a complete email address, such as name@example.com.';
    } else if (field.name === 'password') {
      if (raw.length < 6) errors.password = 'Use at least 6 characters for your password.';
      else if (new TextEncoder().encode(raw).length > 72) errors.password = 'This password is too long. Please use a shorter password.';
    } else if (field.name === 'phone' && (!/^\+?[\d\s().-]+$/.test(value) || value.replace(/\D/g, '').length < 7 || value.replace(/\D/g, '').length > 15)) {
      errors.phone = 'Enter a phone number with 7 to 15 digits, including the country code. For example, +91 98765 43210.';
    } else if (field.name === 'dateOfBirth') {
      const birth = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== value) {
        errors.dateOfBirth = 'Enter your full date of birth: day, month and year.';
      } else {
        let age = today.getUTCFullYear() - birth.getUTCFullYear();
        if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age--;
        if (age < 18) errors.dateOfBirth = 'You must be at least 18 years old to register. Please check your date of birth.';
        else if (age > 100) errors.dateOfBirth = 'Please check your date of birth. Registration supports ages 18 to 100.';
      }
    }
    const maxLength = field.type === 'textarea' ? 4000 : 500;
    if (field.name !== 'password' && raw.length > maxLength) errors[field.name] = `Please shorten this answer to ${maxLength} characters or fewer.`;
  }
  if (data.minAge?.trim() && data.maxAge?.trim() && !errors.minAge && !errors.maxAge && Number(data.minAge) > Number(data.maxAge)) {
    errors.maxAge = `Your oldest preferred partner must be ${Number(data.minAge)} years or older, because your age range starts at ${Number(data.minAge)}.`;
  }
  if (data.minHeight?.trim() && data.maxHeight?.trim() && !errors.minHeight && !errors.maxHeight && Number(data.minHeight) > Number(data.maxHeight)) {
    errors.maxHeight = `Your tallest preferred partner must be ${Number(data.minHeight)} cm or taller, because your height range starts at ${Number(data.minHeight)} cm.`;
  }
  return errors;
}

// Validates only basic details for initial sign up
export function validateRegistration(data: Record<string, string>, today = new Date()): FieldErrors {
  return validateFieldList(data, basicSections.flatMap(s => s.fields), today);
}

// Validates all comprehensive details when editing full profile
export function validateFullProfile(data: Record<string, string>, today = new Date()): FieldErrors {
  return validateFieldList(data, fullBiodataSections.flatMap(s => s.fields), today);
}
