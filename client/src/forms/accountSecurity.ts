export function validatePasswordUpdate(data: { currentPassword: string; newPassword: string; confirmPassword: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.currentPassword) errors.currentPassword = 'Enter your current password.';
  if (data.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters for your new password.';
  else if (new TextEncoder().encode(data.newPassword).length > 72) errors.newPassword = 'This password is too long. Please use a shorter password.';
  else if (data.newPassword === data.currentPassword) errors.newPassword = 'Choose a password different from your current password.';
  if (!data.confirmPassword || data.confirmPassword !== data.newPassword) errors.confirmPassword = 'Type the same new password in both boxes.';
  return errors;
}

export function phoneInputError(value: string): string | undefined {
  return /^\+[1-9]\d{7,14}$/.test(value.replace(/[\s().-]/g, '')) ? undefined : 'Start with + and your country code. For example, +91 98765 43210.';
}

export function preparePhoneInput(value: string, dialCode: string): { number: string; error?: string } {
  const digits = value.replace(/[\s().-]/g, '');
  const number = dialCode ? `${dialCode}${digits}` : value;
  const error = dialCode === '+91' && !/^\d{10}$/.test(digits)
    ? 'Enter your 10-digit mobile number. The +91 country code is already selected.' : phoneInputError(number);
  return { number, error };
}
