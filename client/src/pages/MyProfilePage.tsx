import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck, Camera, CheckCircle2, Save, Eye, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SubscriptionSummary } from '../components/SubscriptionSummary';
import { api, ApiError } from '../services/api';
import { heightDescription } from '../forms/registration';
import { profileSections, preferenceLists, profileFormValues, profileFormPayload, validateProfileForm, splitProfileList } from '../forms/profile';

export const MyProfilePage: React.FC = () => {
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => { if (profile && !isEditing) setFormData(profileFormValues(profile)); }, [profile]);
  const errors = { ...validateProfileForm(formData), ...serverErrors };
  const focusSummary = () => requestAnimationFrame(() => { summary.current?.focus(); summary.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  const reset = () => {
    if (profile) setFormData(profileFormValues(profile));
    setPhotoError(''); setSaveError(''); setServerErrors({}); setTouched({}); setSubmitted(false);
  };
  const cancel = () => { reset(); setIsEditing(false); };
  const change = (name: string, value: string) => {
    setFormData(current => ({ ...current, [name]: value })); setSavedSuccess(false); setSaveError('');
    setServerErrors(current => { const next = { ...current }; delete next[name]; if (name in preferenceLists || ['minAge','maxAge','minHeight','maxHeight','minIncome'].includes(name)) delete next.partnerPreferences; return next; });
  };
  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setPhotoError('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setPhotoError('Please choose a JPG, PNG, or WebP image. Your previous photo is unchanged.'); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Choose an image smaller than 5 MB. Your previous photo is unchanged.'); return; }
    setPhotoLoading(true);
    try {
      const photo = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reader.onabort = () => reject(new Error('Could not read image')); reader.readAsDataURL(file); });
      const image = new Image(); image.src = photo; await image.decode(); change('profilePhoto', photo);
    } catch { setPhotoError('This image could not be opened. Please choose another. Your previous photo is unchanged.'); }
    finally { setPhotoLoading(false); }
  };
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault(); if (!profile || !isEditing || saving || photoLoading) return;
    setSubmitted(true); setSaveError('');
    if (Object.keys(errors).length) { focusSummary(); return; }
    setSaving(true);
    try {
      const updated = await api.updateProfile(profile.id, profileFormPayload(formData, profile.partnerPreferences));
      await refreshProfile(); setFormData(profileFormValues(updated)); setIsEditing(false); setSavedSuccess(true); setSubmitted(false); setTouched({});
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setServerErrors(error.fieldErrors);
      setSaveError(error instanceof Error ? error.message : 'Could not save your changes. Please try again.'); focusSummary();
    } finally { setSaving(false); }
  };
  if (!user && !isLoading) return <Navigate to="/login" state={{ from: '/my-profile' }} replace />;
  if (!profile) return <div className="max-w-5xl mx-auto px-4 py-12"><p role="status">{isLoading ? 'Loading your biodata…' : 'There is no matrimonial profile linked to this account.'}</p>{!isLoading && <Link to={user?.role === 'admin' ? '/admin' : '/contact'} className="text-rose-700 underline">{user?.role === 'admin' ? 'Open admin panel' : 'Contact support'}</Link>}</div>;
  const fields = profileSections.flatMap(section => section.fields);
  const visibleError = (name: string) => isEditing && (submitted || touched[name]) ? errors[name] : undefined;
  return <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 profile-editor">
    <SubscriptionSummary />
    {!profile.isVerified && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your profile is awaiting admin review. You can update all your biodata while you wait.</div>}
    <header className="bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-5 min-w-0"><img src={formData.profilePhoto || profile.profilePhoto} alt={profile.fullName} width={88} height={88} className="w-20 h-20 rounded-2xl object-cover border-2 border-rose-100 shrink-0" /><div className="min-w-0"><p className="theme-eyebrow">YOUR STORY, IN YOUR WORDS</p><h1 className="mt-2 break-words">{profile.fullName}</h1><p className="mt-2 text-sm text-slate-600">{profile.age} years · {profile.heightFormatted} · {profile.city}, {profile.state}</p><p className="mt-2 inline-flex items-center gap-2 text-sm text-rose-700"><ShieldCheck size={17} />{profile.isVerified ? 'Admin approved' : 'Pending admin review'}</p></div></div>
      <div className="flex flex-wrap gap-3"><Link to={`/profile/${profile.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold"><Eye size={17} />Profile preview</Link><button type="button" onClick={() => { if (isEditing) cancel(); else { reset(); setSavedSuccess(false); setIsEditing(true); } }} disabled={saving || photoLoading} className="rounded-xl bg-rose-600 text-white px-5 py-3 text-sm font-semibold disabled:opacity-60">{isEditing ? 'Cancel edit' : 'Edit all biodata'}</button></div>
    </header>
    {savedSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-center gap-2 text-sm"><CheckCircle2 size={19} />Your changes were saved and submitted for admin review.</p>}
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6" aria-labelledby="profile-account-heading"><h2 id="profile-account-heading" className="font-semibold flex items-center gap-2"><Lock size={18} className="text-rose-700" />Login & contact details</h2><div className="flex flex-wrap items-start justify-between gap-4 mt-3"><div className="text-sm leading-7 break-all"><p>Email: <strong>{user?.email}</strong></p><p>Phone: <strong>{profile.phone || 'Not added'}</strong> <span className="text-slate-500">({profile.phoneVerified ? 'verified' : 'not verified'})</span></p></div><Link to="/account-settings" className="text-sm font-semibold text-rose-700 inline-flex items-center gap-2 py-2">Manage account details <ArrowRight size={17} /></Link></div><p className="text-sm text-slate-500 mt-2">Use account settings for secure email, password, and phone changes. These details cannot be changed through the biodata form.</p></section>
    <nav aria-label="Biodata sections" className="flex flex-wrap gap-2">{profileSections.map((section,index) => <a href={`#profile-section-${index}`} key={section.title} className="rounded-lg border border-rose-100 bg-white px-3 py-2 text-sm text-rose-800 hover:bg-rose-50">{section.title}</a>)}</nav>
    <form noValidate onSubmit={handleSave} aria-busy={saving || photoLoading} className="space-y-6">
      {isEditing && <p className="text-sm text-slate-600">Update the same details you provided at signup. Fields marked * are required. Saving changes submits your profile for admin review again.</p>}
      {(submitted && Object.keys(errors).length > 0 || saveError) && <div ref={summary} tabIndex={-1} role="alert" className="scroll-mt-32 rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-900 focus:outline-rose-500"><h2 className="font-bold">Please check your changes</h2>{saveError && <p className="mt-2">{saveError}</p>}<ul className="mt-3 list-disc pl-5 space-y-2 text-sm">{Object.entries(errors).map(([name,message]) => <li key={name}><a href={`#edit-${name}`} className="underline" onClick={event => { event.preventDefault(); document.getElementById(`edit-${name}`)?.focus(); document.getElementById(`edit-${name}`)?.scrollIntoView({ block: 'center' }); }}>{fields.find(field => field.name===name)?.label || (name==='partnerPreferences' ? 'Partner preferences' : 'Profile photo')}: {message}</a></li>)}</ul><p className="text-sm mt-3">Your answers are still here. No changes have been saved.</p></div>}
      <fieldset disabled={!isEditing || saving || photoLoading} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-4"><legend className="font-playfair text-xl font-semibold px-2">Profile photo</legend><div className="flex flex-wrap items-center gap-5"><img src={formData.profilePhoto || profile.profilePhoto} alt="Profile photo preview" width={90} height={90} className="w-24 h-24 object-cover rounded-xl border border-rose-100" /><div className="min-w-0 flex-1"><label htmlFor="edit-profilePhoto" className="text-sm font-semibold flex items-center gap-2"><Camera size={18} />Choose a portrait</label><input id="edit-profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} aria-describedby="profile-photo-help profile-photo-status" aria-invalid={!!photoError || !!serverErrors.profilePhoto} className="w-full text-sm mt-3 rounded-xl border border-slate-300 p-2 file:border-0 file:bg-rose-50 file:text-rose-700 file:rounded-lg file:mr-3 file:px-3 file:py-2" /><p id="profile-photo-help" className="text-sm text-slate-500 mt-2">JPG, PNG, or WebP. Maximum 5 MB. {isEditing ? 'Your photo is saved together with your changes.' : 'Select Edit all biodata to change your photo.'}</p></div></div><p id="profile-photo-status" role={photoError || serverErrors.profilePhoto ? 'alert' : 'status'} className="text-sm text-rose-700">{photoError || serverErrors.profilePhoto || (photoLoading ? 'Preparing photo preview…' : '')}</p></fieldset>
      {profileSections.map((section,index) => <fieldset disabled={!isEditing || saving || photoLoading} id={`profile-section-${index}`} key={section.title} className="scroll-mt-28 bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5"><legend className="font-playfair text-xl sm:text-2xl font-semibold text-rose-900 px-2">{index+1}. {section.title}</legend>{section.title==='Partner preferences' && <p id="edit-partnerPreferences" tabIndex={-1} className="text-sm text-slate-600">Choose the age and height ranges you are comfortable with. For text preferences, separate choices with commas. Leave optional preferences blank or unchecked if any option is fine.{visibleError('partnerPreferences') && <span className="block text-rose-700 mt-2">{errors.partnerPreferences}</span>}</p>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {section.fields.map(field => {
          const value = formData[field.name] || '';
          const error = visibleError(field.name);
          const id = `edit-${field.name}`;
          const conversion = ['height','minHeight','maxHeight'].includes(field.name) && heightDescription(value);
          const described = [field.hint && `${id}-hint`, error && `${id}-error`, conversion && `${id}-conversion`].filter(Boolean).join(' ') || undefined;
          const props = { id, name: field.name, value, required: field.required, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => change(field.name,event.target.value), onBlur: () => setTouched(current => ({ ...current,[field.name]:true })), 'aria-invalid': !!error, 'aria-describedby': described, className: `w-full rounded-xl border p-3 text-base outline-none focus:ring-2 focus:ring-rose-500 ${error ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50'} disabled:opacity-100 disabled:text-slate-700` };
          const multi = !!field.options && field.name in preferenceLists;
          return <div key={field.name} className={field.type==='textarea' || multi ? 'sm:col-span-2' : ''}><label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-2">{field.label}{field.required ? ' *' : ' (optional)'}</label>{multi ? <div id={id} tabIndex={-1} role="group" aria-label={field.label} aria-describedby={described} className="flex flex-wrap gap-3">{[...field.options!,...splitProfileList(value).filter(option=>!field.options!.includes(option))].map(option => <label key={option} className="flex items-center gap-2 border border-rose-100 rounded-lg px-3 py-2 text-sm"><input type="checkbox" checked={splitProfileList(value).includes(option)} onChange={event => change(field.name,(event.target.checked ? [...splitProfileList(value),option] : splitProfileList(value).filter(item=>item!==option)).join(', '))} />{option}</label>)}</div> : field.options ? <select {...props}><option value="">Select an option</option>{value && !field.options.includes(value) && <option value={value}>{value} (previous value)</option>}{field.options.map(option=><option key={option}>{option}</option>)}</select> : field.type==='textarea' ? <textarea {...props} rows={4} maxLength={4000} /> : <input {...props} type={field.type || 'text'} min={field.min} max={field.max} maxLength={500} step={['annualIncome','minIncome','height','minHeight','maxHeight'].includes(field.name) ? '0.01' : undefined} />}{field.hint && <p id={`${id}-hint`} className="text-sm text-slate-500 mt-2">{field.hint}</p>}{conversion && <p id={`${id}-conversion`} className="text-sm text-slate-600 mt-1">{conversion}</p>}{error && <p id={`${id}-error`} className="text-sm font-medium text-rose-700 mt-2">{error}</p>}</div>;
        })}
      </div></fieldset>)}
      {isEditing && <div className="profile-save-bar"><span>Changes are saved only when you select Save changes.</span><div><button type="button" onClick={cancel} disabled={saving || photoLoading} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold">Cancel</button><button type="submit" disabled={saving || photoLoading} className="rounded-xl bg-rose-700 text-white px-5 py-3 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><Save size={18} />{saving ? 'Saving biodata…' : 'Save changes'}</button></div></div>}
    </form>
  </div>;
};
