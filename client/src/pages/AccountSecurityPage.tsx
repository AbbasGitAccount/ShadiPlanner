import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole, Phone, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AccountSecurity, api, ApiError, PhoneTestChallenge } from '../services/api';
import { preparePhoneInput, validatePasswordUpdate } from '../forms/accountSecurity';
import { AccountEmailForm } from '../components/AccountEmailForm';

export const AccountSecurityPage: React.FC = () => {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountSecurity | null>(null);
  const [loadError, setLoadError] = useState('');
  const [activePanel, setActivePanel] = useState<'password' | 'phone'>('password');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordError, setPasswordError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [phonePassword, setPhonePassword] = useState('');
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [challenge, setChallenge] = useState<PhoneTestChallenge | null>(null);
  const [code, setCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [resendAt, setResendAt] = useState<string | null>(null);
  const passwordStatus = useRef<HTMLDivElement>(null);
  const phoneStatus = useRef<HTMLDivElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoadError('');
    try {
      const data = await api.getAccountSecurity();
      setAccount(data);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load account settings. Please try again.'); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!challenge && !resendAt) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (resendAt && Date.now() >= Date.parse(resendAt)) setResendAt(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challenge, resendAt]);
  const focusStatus = (ref: React.RefObject<HTMLDivElement>) => requestAnimationFrame(() => {
    ref.current?.focus(); ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingPassword || phoneBusy) return;
    setPasswordError('');
    const errors = validatePasswordUpdate(passwords);
    setPasswordErrors(errors);
    if (Object.keys(errors).length) { focusStatus(passwordStatus); return; }
    setSavingPassword(true);
    try {
      const result = await api.changePassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      logout();
      navigate('/login', { replace: true, state: { message: result.message } });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setPasswordErrors(error.fieldErrors);
      else setPasswordError(error instanceof Error ? error.message : 'Could not change your password. Please try again.');
      focusStatus(passwordStatus);
    } finally { setSavingPassword(false); }
  };
  const sendTest = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (phoneBusy || savingPassword) return;
    setPhoneError(''); setPhoneSuccess('');
    const errors: Record<string, string> = {};
    const { number: fullPhone, error: invalidPhone } = preparePhoneInput(phone, dialCode);
    if (invalidPhone) errors.phone = invalidPhone;
    if (!phonePassword) errors.phonePassword = 'Enter your current password to change your number.';
    setPhoneErrors(errors);
    if (Object.keys(errors).length) { focusStatus(phoneStatus); return; }
    setPhoneBusy(true);
    try {
      const result = await api.startPhoneTest(fullPhone, phonePassword);
      setChallenge(result); setResendAt(result.resendAt); setNow(Date.now()); setCode('');
      requestAnimationFrame(() => codeInput.current?.focus());
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setPhoneErrors(error.fieldErrors);
      else setPhoneError(error instanceof Error ? error.message : 'Could not create a test code.');
      focusStatus(phoneStatus);
    } finally { setPhoneBusy(false); }
  };
  const confirmTest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challenge || phoneBusy || savingPassword) return;
    setPhoneErrors({}); setPhoneError('');
    if (!/^\d{6}$/.test(code)) { setPhoneErrors({ code: 'Enter all 6 digits of the test code shown below.' }); focusStatus(phoneStatus); return; }
    setPhoneBusy(true);
    try {
      const result = await api.confirmPhoneTest(challenge.challengeId, code);
      setAccount(current => current && { ...current, phone: result.phone, phoneVerified: false });
      setPhone(''); setPhonePassword(''); setCode(''); setChallenge(null); setPhoneSuccess('Phone number saved. It is still unverified because this was a test.');
      await refreshProfile();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setPhoneErrors(error.fieldErrors);
      else setPhoneError(error instanceof Error ? error.message : 'Could not complete this test.');
      focusStatus(phoneStatus);
    } finally { setPhoneBusy(false); }
  };
  const input = (invalid: boolean) => `w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-rose-500 ${invalid ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50'}`;
  const button = 'rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-50';
  const cooldown = resendAt ? Math.max(0, Math.ceil((Date.parse(resendAt) - now) / 1000)) : 0;
  const expired = challenge && Date.parse(challenge.expiresAt) <= now;
  const secondsLeft = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1000)) : 0;
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-2">
        <Link to={user?.role === 'admin' ? '/admin' : '/my-profile'} className="text-sm text-rose-700 underline">Back to {user?.role === 'admin' ? 'admin dashboard' : 'my profile'}</Link>
        <h1 className="font-playfair text-3xl font-bold text-slate-900">Account settings</h1>
        <p className="text-sm text-slate-600">Signed in as <strong className="break-all">{user?.email}</strong></p>
      </div>
      <AccountEmailForm disabled={savingPassword || phoneBusy} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Choose what to update">
        {([{ id: 'password', label: 'Change password', description: 'Keep your account secure', Icon: LockKeyhole }, { id: 'phone', label: 'Change phone number', description: 'Update your contact number', Icon: Phone }] as const).map(item => (
          <button key={item.id} type="button" aria-pressed={activePanel === item.id} aria-controls={`${item.id}-panel`} onClick={() => setActivePanel(item.id)} disabled={savingPassword || phoneBusy}
            className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left focus-visible:ring-2 focus-visible:ring-rose-500 ${activePanel === item.id ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-200'}`}>
            <item.Icon className="w-6 h-6 text-rose-600 shrink-0" /><span><span className="block font-semibold text-slate-900">{item.label}</span><span className="block mt-1 text-xs text-slate-600">{item.description}</span></span>
          </button>
        ))}
      </div>
      <section id="password-panel" hidden={activePanel !== 'password'} className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-sm space-y-5" aria-labelledby="password-heading">
        <h2 id="password-heading" className="text-xl font-bold flex items-center gap-2"><LockKeyhole className="w-5 h-5 text-rose-600" />Change password</h2>
        <p className="text-sm text-slate-600">Enter your old password and choose a new one. You will need to sign in again after saving.</p>
        <form noValidate onSubmit={savePassword} className="space-y-4">
          <div ref={passwordStatus} tabIndex={-1} className="outline-none" role={passwordError || Object.keys(passwordErrors).length ? 'alert' : undefined}>
            {(passwordError || Object.keys(passwordErrors).length > 0) && <p className="text-sm text-rose-700">{passwordError || 'Please correct the highlighted password fields. Your password has not been changed.'}</p>}
          </div>
          <fieldset disabled={savingPassword || phoneBusy} className="space-y-4">
            {([{ name: 'currentPassword', label: 'Current password' }, { name: 'newPassword', label: 'New password' }, { name: 'confirmPassword', label: 'Type new password again' }] as const).map(field => (
              <div key={field.name}>
                <label htmlFor={field.name} className="block text-sm font-semibold mb-1">{field.label}</label>
                <input id={field.name} type={showPasswords ? 'text' : 'password'} required autoComplete={field.name === 'currentPassword' ? 'current-password' : 'new-password'} value={passwords[field.name]}
                  onChange={event => { setPasswords(current => ({ ...current, [field.name]: event.target.value })); setPasswordErrors(current => { const next = { ...current }; delete next[field.name]; return next; }); setPasswordError(''); }}
                  aria-invalid={!!passwordErrors[field.name]} aria-describedby={[field.name === 'newPassword' && 'new-password-help', passwordErrors[field.name] && `${field.name}-error`].filter(Boolean).join(' ') || undefined} className={input(!!passwordErrors[field.name])} />
                {field.name === 'newPassword' && <p id="new-password-help" className="mt-1 text-xs text-slate-500">Use at least 8 characters. A longer phrase is easier to remember.</p>}
                {passwordErrors[field.name] && <p id={`${field.name}-error`} className="mt-1 text-sm text-rose-700">{passwordErrors[field.name]}</p>}
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPasswords} onChange={event => setShowPasswords(event.target.checked)} />Show passwords</label>
            <button type="submit" className={button}>{savingPassword ? 'Saving password...' : 'Save new password'}</button>
          </fieldset>
        </form>
      </section>
      <section id="phone-panel" hidden={activePanel !== 'phone'} className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-sm space-y-5" aria-labelledby="phone-heading">
        <h2 id="phone-heading" className="text-xl font-bold flex items-center gap-2"><Phone className="w-5 h-5 text-rose-600" />Change phone number</h2>
        {loadError ? <div role="alert" className="text-sm text-rose-700">{loadError} <button onClick={() => void load()} className="underline">Try again</button></div> : !account ? <p role="status">Loading phone settings...</p> : <>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">Current number: <strong>{account.phone || 'No number added'}</strong><span className={`block mt-1 text-xs ${account.phoneVerified ? 'text-emerald-700' : 'text-amber-800'}`}>{account.phoneVerified ? 'Verified' : 'Not verified'}</span></div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Test mode: no SMS will be sent</p>
            <p className="mt-1">Use a fictional number. Your test code appears here, and the saved number stays unverified.</p>
          </div>
          {phoneSuccess && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 flex items-start gap-2"><CheckCircle2 className="w-5 h-5 shrink-0" />{phoneSuccess}</p>}
          {!account.phoneTestEnabled ? <p role="status" className="text-sm text-slate-600">Phone testing is currently disabled. Your saved number will stay unchanged.</p> : <>
            <ol aria-label="Phone update steps" className="grid grid-cols-2 gap-2 text-sm">
              <li className={`rounded-lg p-3 ${!challenge ? 'bg-rose-50 font-semibold text-rose-800' : 'bg-slate-50 text-slate-500'}`} aria-current={!challenge ? 'step' : undefined}>1. Enter number</li>
              <li className={`rounded-lg p-3 ${challenge ? 'bg-rose-50 font-semibold text-rose-800' : 'bg-slate-50 text-slate-500'}`} aria-current={challenge ? 'step' : undefined}>2. Enter code & save</li>
            </ol>
            <div ref={phoneStatus} tabIndex={-1} className="outline-none" role={phoneError || Object.values(phoneErrors).some(Boolean) ? 'alert' : undefined}>
              {(phoneError || Object.values(phoneErrors).some(Boolean)) && <p className="text-sm text-rose-700">{phoneError || 'Please correct the highlighted fields. Your number has not been changed.'}</p>}
            </div>
            <form noValidate onSubmit={sendTest} hidden={!!challenge} className="space-y-4">
              <fieldset disabled={phoneBusy || savingPassword || !!challenge} className="space-y-4">
                <div><label htmlFor="phone-country" className="block text-sm font-semibold mb-1">Country code</label>
                  <select id="phone-country" value={dialCode} onChange={event => { setDialCode(event.target.value); setPhoneErrors({}); }} className={input(false)}>
                    <option value="+91">India (+91)</option><option value="+1">USA / Canada (+1)</option><option value="+44">United Kingdom (+44)</option><option value="+971">UAE (+971)</option><option value="">Another country (enter full number)</option>
                  </select>
                </div>
                <div><label htmlFor="phone" className="block text-sm font-semibold mb-1">{dialCode ? 'New mobile number' : 'Full international number'}</label>
                  <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={event => { setPhone(event.target.value); setPhoneErrors({}); setPhoneSuccess(''); }} aria-invalid={!!phoneErrors.phone} aria-describedby={`phone-help${phoneErrors.phone ? ' phone-error' : ''}`} className={input(!!phoneErrors.phone)} />
                  <p id="phone-help" className="mt-1 text-xs text-slate-500">{dialCode ? `The ${dialCode} country code is added for you. Enter only the mobile number.` : 'Start with + and the country code.'}</p>
                  {phoneErrors.phone && <p id="phone-error" className="mt-1 text-sm text-rose-700">{phoneErrors.phone}</p>}
                </div>
                <div><label htmlFor="phonePassword" className="block text-sm font-semibold mb-1">Current password</label>
                  <input id="phonePassword" type="password" autoComplete="current-password" value={phonePassword} onChange={event => { setPhonePassword(event.target.value); setPhoneErrors({}); }} aria-invalid={!!phoneErrors.phonePassword} aria-describedby={phoneErrors.phonePassword ? 'phonePassword-error' : undefined} className={input(!!phoneErrors.phonePassword)} />
                  {phoneErrors.phonePassword && <p id="phonePassword-error" className="mt-1 text-sm text-rose-700">{phoneErrors.phonePassword}</p>}
                </div>
                {!challenge && <button type="submit" disabled={cooldown > 0} className={button}>{phoneBusy ? 'Creating test code...' : cooldown ? `Try again in ${cooldown}s` : 'Continue to test code'}</button>}
              </fieldset>
            </form>
            {challenge && <form noValidate onSubmit={confirmTest} className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2 text-sm">
                <p>Test code for <strong>{challenge.phone}</strong>:</p><p className="text-2xl tracking-widest font-mono font-bold">{challenge.testCode}</p>
                <p>{expired ? 'This code has expired. Get a new code below.' : `Enter this code below. It expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}.`}</p>
                {!expired && <button type="button" onClick={() => { setCode(challenge.testCode); setPhoneErrors({}); codeInput.current?.focus(); }} className="font-semibold text-rose-700 underline">Fill test code for me</button>}
              </div>
              <div><label htmlFor="code" className="block text-sm font-semibold mb-1">6-digit test code</label>
                <input ref={codeInput} id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => { setCode(event.target.value); setPhoneErrors(current => ({ ...current, code: '' })); }} disabled={phoneBusy || savingPassword || !!expired} aria-invalid={!!phoneErrors.code} aria-describedby={phoneErrors.code ? 'code-error' : undefined} className={input(!!phoneErrors.code)} />
                {phoneErrors.code && <p id="code-error" className="mt-1 text-sm text-rose-700">{phoneErrors.code}</p>}
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <button type="submit" disabled={phoneBusy || savingPassword || !!expired} className={button}>{phoneBusy ? 'Saving number...' : 'Save phone number (test)'}</button>
                <button type="button" disabled={phoneBusy || savingPassword || cooldown > 0} onClick={() => void sendTest()} className="text-sm text-rose-700 underline disabled:text-slate-400">{cooldown ? `New test code in ${cooldown}s` : 'Create another test code'}</button>
                <button type="button" disabled={phoneBusy || savingPassword} onClick={() => { setChallenge(null); setCode(''); setPhoneErrors({}); setPhoneError(''); }} className="text-sm text-slate-600 underline">Back to change number</button>
              </div>
            </form>}
          </>}
        </>}
      </section>
    </div>
  );
};
