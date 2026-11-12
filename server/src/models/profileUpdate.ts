import { MatrimonialProfile, PartnerPreferences } from './types.js';

export class ProfileUpdateError extends Error {
  constructor(message: string, public status = 400, public field?: string) { super(message); }
}

export function validateProfilePatch(input: unknown): Partial<MatrimonialProfile> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ProfileUpdateError('Please provide the profile details you want to change.');
  const data = input as Record<string, unknown>;
  const patch: Partial<MatrimonialProfile> = {};
  const optional = new Set(['company', 'community', 'subCommunity', 'gothram', 'rashi', 'nakshatra', 'collegeUniversity', 'workLocation', 'fatherOccupation', 'motherOccupation', 'familyLocation', 'aboutFamily']);
  for (const name of ['fullName', 'profession', 'company', 'highestEducation', 'city', 'state', 'aboutMe', 'religion', 'community', 'subCommunity', 'motherTongue', 'gothram', 'rashi', 'nakshatra', 'collegeUniversity', 'workLocation', 'country', 'citizenship', 'fatherOccupation', 'motherOccupation', 'familyLocation', 'aboutFamily'] as const) {
    if (!(name in data)) continue;
    const value = data[name];
    const max = name === 'aboutMe' || name === 'aboutFamily' ? 4000 : 500;
    if (typeof value !== 'string' || (!optional.has(name) && !value.trim()) || value.length > max) {
      throw new ProfileUpdateError(`Please check ${name.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`)}. Enter a valid answer within ${max} characters.`, 400, name);
    }
    patch[name] = value.trim();
  }
  for (const [name, choices] of Object.entries({
    gender: ['Female', 'Male', 'Other'], maritalStatus: ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'],
    manglik: ['Yes', 'No', 'Partial', 'Do not believe', 'Prefer not to say'],
    familyType: ['Nuclear', 'Joint', 'Prefer not to say'], familyStatus: ['Middle Class', 'Upper Middle Class', 'Rich / Affluent', 'Prefer not to say'],
    smoking: ['No', 'Yes', 'Occasionally', 'Prefer not to say'], drinking: ['No', 'Yes', 'Occasionally', 'Prefer not to say'],
  })) {
    if (!(name in data)) continue;
    if (typeof data[name] !== 'string' || !choices.includes(data[name] as string)) throw new ProfileUpdateError(`Choose a listed option for ${name.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`)}.`, 400, name);
    Object.assign(patch, { [name]: data[name] });
  }
  for (const name of ['languagesKnown', 'hobbies'] as const) {
    if (!(name in data)) continue;
    const list = data[name];
    if (!Array.isArray(list) || list.length > 100 || list.some(value => typeof value !== 'string' || value.length > 500) || list.join(', ').length > 500) throw new ProfileUpdateError('Use a comma-separated list of up to 500 characters.', 400, name);
    patch[name] = [...new Set((list as string[]).map(value => value.trim()).filter(Boolean))];
  }
  if ('dateOfBirth' in data) {
    const value = data.dateOfBirth;
    const date = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : new Date(NaN);
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ProfileUpdateError('Enter a valid full date of birth.', 400, 'dateOfBirth');
    const today = new Date();
    let age = today.getUTCFullYear() - date.getUTCFullYear();
    if (today.getUTCMonth() < date.getUTCMonth() || today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate()) age--;
    if (age < 18 || age > 100) throw new ProfileUpdateError('Your date of birth must give an age between 18 and 100 years.', 400, 'dateOfBirth');
    patch.dateOfBirth = value; patch.age = age;
  }
  for (const [name, min, max] of [['height', 100, 250], ['brothersCount', 0, 50], ['sistersCount', 0, 50]] as const) {
    if (!(name in data)) continue;
    const value = data[name];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || name !== 'height' && !Number.isInteger(value)) throw new ProfileUpdateError(`Enter ${name === 'height' ? 'height in centimetres' : 'the number of siblings'} from ${min} to ${max}${name !== 'height' ? ' using a whole number' : ''}.`, 400, name);
    patch[name] = value;
    if (name === 'height') { const inches = Math.round(value / 2.54); patch.heightFormatted = `${Math.floor(inches / 12)} ft ${inches % 12} in (${value} cm)`; }
  }
  if ('annualIncome' in data) {
    if (typeof data.annualIncome !== 'number' || !Number.isFinite(data.annualIncome) || data.annualIncome < 0 || data.annualIncome > 1000000) throw new ProfileUpdateError('Enter yearly income between 0 and 1,000,000 lakhs.', 400, 'annualIncome');
    patch.annualIncome = data.annualIncome;
    patch.annualIncomeFormatted = `\u20b9${data.annualIncome} Lakhs / yr`;
  }
  if ('diet' in data) {
    if (!['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Jain', 'Vegan', 'Prefer not to say'].includes(data.diet as string)) throw new ProfileUpdateError('Choose a listed diet option.', 400, 'diet');
    patch.diet = data.diet as MatrimonialProfile['diet'];
  }
  if ('profilePhoto' in data) {
    const photo = data.profilePhoto;
    const dataImage = typeof photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo) && photo.length <= 7 * 1024 * 1024;
    const safeUrl = typeof photo === 'string' && (photo === '/avatar-placeholder.svg' || photo.length <= 2048 && /^https?:\/\//.test(photo));
    if (!dataImage && !safeUrl) throw new ProfileUpdateError('Choose a JPG, PNG, or WebP image smaller than 5 MB.', 400, 'profilePhoto');
    patch.profilePhoto = photo as string;
  }
  if ('partnerPreferences' in data) {
    const raw = data.partnerPreferences;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ProfileUpdateError('Please check your partner preferences.', 400, 'partnerPreferences');
    const prefs = raw as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [name, min, max] of [['minAge', 18, 100], ['maxAge', 18, 100], ['minHeight', 100, 250], ['maxHeight', 100, 250], ['minIncome', 0, 1000000]] as const) {
      const value = prefs[name];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (name.endsWith('Age') && !Number.isInteger(value))) throw new ProfileUpdateError(`Partner ${name.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`)} must be between ${min} and ${max}.`, 400, name);
      result[name] = value;
    }
    if ((result.minAge as number) > (result.maxAge as number)) throw new ProfileUpdateError('Your oldest preferred partner must be the same age or older than your starting age.', 400, 'maxAge');
    if ((result.minHeight as number) > (result.maxHeight as number)) throw new ProfileUpdateError('Your tallest preferred partner must be the same height or taller than your starting height.', 400, 'maxHeight');
    for (const name of ['maritalStatus', 'religions', 'communities', 'motherTongues', 'educationLevels', 'occupations', 'locations', 'diet']) {
      const value = prefs[name];
      if (!Array.isArray(value) || value.length > 100 || value.some(item => typeof item !== 'string' || item.length > 500)) throw new ProfileUpdateError('Enter valid text lists for your partner preferences.', 400, 'partnerPreferences');
      result[name] = [...new Set((value as string[]).map(item => item.trim()).filter(Boolean))];
      const choices = name === 'maritalStatus' ? ['Never Married','Divorced','Widowed','Awaiting Divorce'] : name === 'diet' ? ['Vegetarian','Non-Vegetarian','Eggetarian','Jain','Vegan'] : undefined;
      if (choices && (result[name] as string[]).some(item => !choices.includes(item))) throw new ProfileUpdateError('Choose listed partner preferences, or leave them blank if any option is fine.',400,name === 'diet' ? 'preferredDiet' : 'preferredMaritalStatus');
    }
    if (prefs.manglikPreference !== undefined) {
      if (typeof prefs.manglikPreference !== 'string' || prefs.manglikPreference.length > 500) throw new ProfileUpdateError('Please check your astrology preference.', 400, 'partnerPreferences');
      result.manglikPreference = prefs.manglikPreference;
    }
    patch.partnerPreferences = result as unknown as PartnerPreferences;
  }
  if (!Object.keys(patch).length) throw new ProfileUpdateError('No editable profile details were provided. Use account settings for phone changes.');
  return patch;
}
