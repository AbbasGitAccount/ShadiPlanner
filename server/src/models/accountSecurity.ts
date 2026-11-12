export class AccountSecurityError extends Error {
  constructor(message: string, public status = 400, public field?: string) { super(message); }
}

export function validatePasswordChange(currentPassword: unknown, newPassword: unknown, confirmation: unknown): asserts newPassword is string {
  if (typeof currentPassword !== 'string' || !currentPassword) throw new AccountSecurityError('Enter your current password.', 400, 'currentPassword');
  if (typeof newPassword !== 'string' || newPassword.length < 8) throw new AccountSecurityError('Use at least 8 characters for your new password.', 400, 'newPassword');
  if (Buffer.byteLength(newPassword, 'utf8') > 72) throw new AccountSecurityError('This password is too long. Please use a shorter password.', 400, 'newPassword');
  if (confirmation !== newPassword) throw new AccountSecurityError('The two new passwords do not match. Type the same password again.', 400, 'confirmPassword');
  if (currentPassword === newPassword) throw new AccountSecurityError('Choose a new password that is different from your current password.', 400, 'newPassword');
}

export function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') throw new AccountSecurityError('Enter a phone number with its country code, for example +91 98765 43210.', 400, 'phone');
  const phone = value.replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AccountSecurityError('Start with + and your country code, followed by 8 to 15 digits. For example, +91 98765 43210.', 400, 'phone');
  return phone;
}

export const phoneTestEnabled = (): boolean => process.env.PHONE_VERIFICATION_MODE === 'test' && process.env.NODE_ENV !== 'production';
