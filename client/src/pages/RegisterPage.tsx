import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

import { sections, validateRegistration, heightDescription } from '../forms/registration';
import { ApiError } from '../services/api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    Object.fromEntries(sections.flatMap(section => section.fields.map(field => [field.name, ''])))
  );
  const allErrors = { ...validateRegistration(formData), ...serverErrors };
  const visibleErrors = Object.fromEntries(Object.entries(allErrors).filter(([name]) => submitted || touched[name]));
  const errorCount = Object.keys(allErrors).length;
  const focusSummary = () => requestAnimationFrame(() => {
    summaryRef.current?.focus();
    summaryRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  const focusField = (name: string) => {
    const input = document.getElementById(name);
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData(current => ({ ...current, [name]: value }));
    setError(null);
    setServerErrors(current => {
      const next = { ...current };
      delete next[name];
      if (name === 'minAge') delete next.maxAge;
      if (name === 'minHeight') delete next.maxHeight;
      return next;
    });
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setSubmitted(true);
    if (Object.keys(allErrors).length > 0) {
      focusSummary();
      return;
    }
    setLoading(true);
    try {
      await register(formData);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      navigate('/matches');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.fieldErrors) setServerErrors(err.fieldErrors);
      else setError(err instanceof TypeError ? 'We could not reach the server. Please check your connection and try again. Your answers are still here.' : err instanceof Error ? err.message : 'We could not complete registration. Please try again.');
      focusSummary();
    } finally {
      setLoading(false);
    }
  };
  const inputClass = 'w-full text-sm p-3 border rounded-xl outline-none focus:ring-2 focus:ring-rose-500';
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl p-6 sm:p-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-xs font-semibold text-rose-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick & Easy Registration
          </div>
          <h1 className="font-playfair text-3xl font-extrabold text-slate-900">Begin Your Sacred Journey</h1>
          <p className="text-sm text-slate-500">Register with your basic details to get started. You can complete your full education, family background, and partner preferences in your profile anytime!</p>
          <p className="text-xs text-slate-400">Takes less than 1 minute · Fields marked * are required.</p>
        </div>
        <form noValidate onSubmit={handleSubmit} className="space-y-8" aria-busy={loading}>
          {(submitted && errorCount > 0 || error) && (
            <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="registration-errors-title" className="scroll-mt-32 p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 outline-none focus:ring-2 focus:ring-rose-500">
              <h2 id="registration-errors-title" className="font-bold text-base">{errorCount ? `Please check ${errorCount === 1 ? 'this detail' : `these ${errorCount} details`} to finish registration` : 'Registration needs your attention'}</h2>
              {error && <p className="mt-2 text-sm">{error}</p>}
              {errorCount > 0 && <>
                <p className="mt-1 text-sm">Registration is not complete. Select a message below to go to the field. Your answers are still here.</p>
                <ul className="mt-3 space-y-2 list-disc pl-5 text-sm">
                  {sections.flatMap(section => section.fields).filter(field => allErrors[field.name]).map(field => (
                    <li key={field.name}><a href={`#${field.name}`} onClick={event => { event.preventDefault(); focusField(field.name); }} className="underline decoration-rose-300 underline-offset-2 hover:decoration-rose-800"><strong>{field.label}:</strong> {allErrors[field.name]}</a></li>
                  ))}
                </ul>
              </>}
            </div>
          )}
          <fieldset disabled={loading} className="space-y-8 disabled:opacity-60">
            {sections.map((section, index) => (
              <fieldset key={section.title} className="space-y-4">
                <legend className="w-full text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">{index + 1}. {section.title}
                  {section.fields.some(field => visibleErrors[field.name]) && <span className="ml-2 inline-block text-xs font-semibold normal-case tracking-normal text-rose-700">Needs attention</span>}
                </legend>
                {section.title === 'Partner preferences' && <p className="text-sm text-slate-600">Tell us the age and height range you are comfortable with. For example, ages from 25 to 32 includes anyone aged 25 through 32. Leave optional preferences blank if any option is fine. Separate multiple text preferences with commas.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {section.fields.map(field => {
                    const fieldError = visibleErrors[field.name];
                    const describedBy = [field.hint && `${field.name}-hint`, fieldError && `${field.name}-error`, ['height', 'minHeight', 'maxHeight'].includes(field.name) && heightDescription(formData[field.name]) && `${field.name}-conversion`].filter(Boolean).join(' ') || undefined;
                    const controlProps = {
                      id: field.name, name: field.name, value: formData[field.name], onChange: handleChange,
                      onBlur: () => setTouched(current => ({ ...current, [field.name]: true })),
                      required: field.required, 'aria-invalid': Boolean(fieldError), 'aria-describedby': describedBy,
                      className: `${inputClass} ${fieldError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-slate-50'}`,
                    };
                    return (
                    <div key={field.name} className={`scroll-mt-32 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                      <label htmlFor={field.name} className="block text-sm font-semibold text-slate-600 mb-1">{field.label}{field.required ? ' *' : <span className="font-normal text-slate-500"> (optional)</span>}</label>
                      {field.options ? (
                        <select {...controlProps}>
                          <option value="">{field.required ? 'Select an option' : 'No preference'}</option>
                          {field.options.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea {...controlProps} rows={4} maxLength={4000} />
                      ) : (
                        <input {...controlProps} type={field.type || 'text'}
                          min={field.min} max={field.max}
                          step={['annualIncome', 'minIncome', 'height', 'minHeight', 'maxHeight'].includes(field.name) ? '0.01' : undefined}
                          minLength={field.name === 'password' ? 6 : undefined} maxLength={field.type === 'password' ? undefined : 500}
                          autoComplete={field.name === 'password' ? 'new-password' : field.name === 'email' ? 'email' : field.name === 'phone' ? 'tel' : undefined}
                          inputMode={field.type === 'number' ? (['brothersCount', 'sistersCount', 'minAge', 'maxAge'].includes(field.name) ? 'numeric' : 'decimal') : undefined} />
                      )}
                      {field.hint && <p id={`${field.name}-hint`} className="text-xs text-slate-500 mt-1">{field.hint}</p>}
                      {['height', 'minHeight', 'maxHeight'].includes(field.name) && heightDescription(formData[field.name]) && <p id={`${field.name}-conversion`} className="text-xs text-slate-600 mt-1">{heightDescription(formData[field.name])}</p>}
                      {fieldError && <p id={`${field.name}-error`} className="text-sm font-medium text-rose-700 mt-2"><span className="sr-only">Error: </span>{fieldError}</p>}
                    </div>
                  );})}
                </div>
              </fieldset>
            ))}
          </fieldset>
          {submitted && errorCount > 0 && <p aria-live="polite" className="text-sm text-rose-700">{errorCount} {errorCount === 1 ? 'detail needs' : 'details need'} your attention before you can register. <button type="button" onClick={focusSummary} className="font-semibold underline">Show what to fix</button></p>}
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-rose-200 disabled:opacity-50">
            {loading ? 'Creating Your Biodata...' : 'Complete Registration & Browse Matches'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-rose-600 hover:underline">Log in here</Link></p>
      </div>
    </div>
  );
};
