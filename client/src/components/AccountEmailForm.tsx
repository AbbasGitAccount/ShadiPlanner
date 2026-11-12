import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AccountEmailForm: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [values,setValues] = useState({newEmail:'',confirmEmail:'',emailPassword:''});
  const [busy,setBusy] = useState(false);
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [error,setError] = useState('');
  const status = useRef<HTMLDivElement>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || disabled) return;
    const next: Record<string,string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.newEmail.trim())) next.newEmail='Enter a complete email address.';
    if (values.newEmail.trim().toLowerCase()!==values.confirmEmail.trim().toLowerCase()) next.confirmEmail='Type the same new email address again.';
    if (!values.emailPassword) next.emailPassword='Enter your current password.';
    setErrors(next); setError('');
    if (Object.keys(next).length) { requestAnimationFrame(()=>status.current?.focus()); return; }
    setBusy(true);
    try {
      const result = await api.changeEmail(values.newEmail,values.confirmEmail,values.emailPassword);
      logout(); navigate('/login',{replace:true,state:{message:result.message}});
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      else setError(error instanceof Error ? error.message : 'Your email could not be changed.');
      requestAnimationFrame(()=>status.current?.focus());
    } finally { setBusy(false); }
  };
  return <details className="rounded-3xl bg-white border border-rose-100 p-6 sm:p-8"><summary className="cursor-pointer font-semibold text-lg text-rose-900"><Mail size={19} className="inline mr-2" aria-hidden="true" />Change email address</summary><p className="text-sm text-slate-600 leading-7 mt-4">This changes your login email and the email on your biodata. Confirm your current password to continue. You will be signed out of all sessions, and your biodata will go for admin review again.</p><form noValidate onSubmit={submit} className="space-y-4 mt-5"><div ref={status} tabIndex={-1} role={error || Object.keys(errors).length ? 'alert' : undefined} className="text-sm text-rose-700">{error || (Object.keys(errors).length ? 'Please correct the highlighted details. Your email has not changed.' : '')}</div><fieldset disabled={busy || disabled} className="space-y-4">{([{name:'newEmail',label:'New email address'},{name:'confirmEmail',label:'Type new email address again'},{name:'emailPassword',label:'Current password'}] as const).map(field=><div key={field.name}><label htmlFor={`account-${field.name}`} className="block text-sm font-semibold mb-2">{field.label}</label><input id={`account-${field.name}`} required type={field.name==='emailPassword'?'password':'email'} autoComplete={field.name==='emailPassword'?'current-password':'email'} maxLength={field.name==='emailPassword'?undefined:500} value={values[field.name]} onChange={event=>{setValues(current=>({...current,[field.name]:event.target.value}));setErrors(current=>{const next={...current};delete next[field.name];return next;});setError('');}} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name]?`account-${field.name}-error`:undefined} className={`w-full rounded-xl border p-3 ${errors[field.name]?'border-rose-500 bg-rose-50':'border-slate-300 bg-slate-50'}`} />{errors[field.name]&&<p id={`account-${field.name}-error`} className="text-sm text-rose-700 mt-2">{errors[field.name]}</p>}</div>)}<button disabled={busy || disabled} className="rounded-xl bg-rose-700 text-white px-5 py-3 font-semibold disabled:opacity-60" type="submit">{busy?'Saving new email…':'Save new email & sign out'}</button></fieldset></form></details>;
};
