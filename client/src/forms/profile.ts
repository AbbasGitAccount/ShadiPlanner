import { fullBiodataSections, validateFullProfile, FieldErrors } from './registration';
import { MatrimonialProfile, PartnerPreferences } from '../types';

export const profileSections = fullBiodataSections;
export const preferenceLists = {
  preferredMaritalStatus: 'maritalStatus',
  preferredReligions: 'religions',
  preferredCommunities: 'communities',
  preferredMotherTongues: 'motherTongues',
  preferredEducation: 'educationLevels',
  preferredOccupations: 'occupations',
  preferredLocations: 'locations',
  preferredDiet: 'diet',
} as const;
const preferenceNumbers = ['minAge', 'maxAge', 'minHeight', 'maxHeight', 'minIncome'] as const;
const numericFields = new Set(['height', 'annualIncome', 'brothersCount', 'sistersCount']);
export const splitProfileList = (text: string) => [...new Set(text.split(',').map(value => value.trim()).filter(Boolean))];

export function profileFormValues(profile: MatrimonialProfile): Record<string, string> {
  const data: Record<string, string> = {};
  const values = profile as unknown as Record<string, unknown>;
  for (const field of profileSections.flatMap(section => section.fields)) {
    const key = preferenceLists[field.name as keyof typeof preferenceLists];
    const value = key
      ? profile.partnerPreferences[key]
      : preferenceNumbers.includes(field.name as typeof preferenceNumbers[number])
      ? profile.partnerPreferences[field.name as typeof preferenceNumbers[number]]
      : values[field.name];
    data[field.name] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
  data.profilePhoto = profile.profilePhoto;
  return data;
}

export function validateProfileForm(data: Record<string, string>): FieldErrors {
  const errors = validateFullProfile(data);
  for (const name of ['languagesKnown', 'hobbies']) {
    if (splitProfileList(data[name] || '').join(', ').length > 500) {
      errors[name] = 'Please shorten this list to 500 characters or fewer, including commas and spaces.';
    }
  }
  for (const field of profileSections.flatMap(section => section.fields)) {
    if (!field.options || !(field.name in preferenceLists)) continue;
    const values = splitProfileList(data[field.name] || '');
    if (values.every(value => field.options!.includes(value))) delete errors[field.name];
    else errors[field.name] = 'Choose one or more of the listed preferences, or leave all unchecked for any option.';
  }
  return errors;
}

export function profileFormPayload(data: Record<string, string>, existing: PartnerPreferences): Partial<MatrimonialProfile> {
  const payload: Record<string, unknown> = {};
  const preferences = { ...existing };
  for (const section of profileSections) {
    for (const field of section.fields) {
      const value = data[field.name] || '';
      const key = preferenceLists[field.name as keyof typeof preferenceLists];
      if (key) {
        Object.assign(preferences, { [key]: splitProfileList(value) });
      } else if (preferenceNumbers.includes(field.name as typeof preferenceNumbers[number])) {
        Object.assign(preferences, { [field.name]: Number(value) });
      } else {
        payload[field.name] = numericFields.has(field.name)
          ? Number(value)
          : ['languagesKnown', 'hobbies'].includes(field.name)
          ? splitProfileList(value)
          : value;
      }
    }
  }
  return { ...payload, profilePhoto: data.profilePhoto, partnerPreferences: preferences };
}
