import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Mail, ShieldCheck, MessageCircle, ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/PageIntro';

const configuredEmail = String((import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_SUPPORT_EMAIL || '').trim();
const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ? configuredEmail : '';
const topics = ['Profile and approval', 'Login and account', 'Connections and messages', 'Wedding planning', 'Privacy or safety', 'Other'];
type Fields = { name: string; email: string; topic: string; message: string; consent: boolean };

export const ContactPage: React.FC = () => {
  const [fields, setFields] = useState<Fields>({ name: '', email: '', topic: '', message: '', consent: false });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState('');
  const summary = useRef<HTMLDivElement>(null);
  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => { setFields(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); setStatus(''); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (fields.name.trim().length < 2) next.name = 'Enter your name (at least 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) next.email = 'Enter a valid email address so we can reply.';
    if (!topics.includes(fields.topic)) next.topic = 'Choose what you need help with.';
    if (fields.message.trim().length < 20) next.message = 'Please add at least 20 characters to explain your question.';
    if (!fields.consent) next.consent = 'Confirm that you want to include these details in your request.';
    setErrors(next);
    if (Object.keys(next).length) { requestAnimationFrame(() => summary.current?.focus()); return; }
    const subject = `ShadiPlanner help: ${fields.topic}`;
    const body = `Name: ${fields.name.trim()}\nReply email: ${fields.email.trim()}\nTopic: ${fields.topic}\n\n${fields.message.trim()}`;
    if (supportEmail) {
      window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setStatus('Your email app has been requested. Review and send your message there. Nothing has been sent from this page.');
    } else {
      const url = URL.createObjectURL(new Blob([`${subject}\n\n${body}`], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'shadiplanner-support-request.txt'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Your request draft is ready to download. It has not been sent. Keep it until a support contact is published.');
    }
  };
  const errorProps = (key: keyof Fields) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `contact-${key}-error` : undefined });
  const fieldError = (key: keyof Fields) => errors[key] && <p id={`contact-${key}-error`} className="field-error">{errors[key]}</p>;
  return <div className="info-page contact-page site-container">
    <section className="contact-hero" aria-label="Contact and support"><div><PageIntro eyebrow="A LITTLE GUIDANCE. A BEAUTIFUL BEGINNING." title="Let’s take the next step, together." description="Questions about your profile, a connection, or wedding plans? Tell us what’s on your mind, and prepare your support request here." /><a href="#support-heading" className="support-link">Looking for a quick answer? Browse FAQs <ArrowRight size={18} /></a></div><div className="contact-hero-photo"><img src="/images/matrimonial-hero-mobile.webp" width="900" height="507" alt="An Indian couple smiling together in a wedding garden" /><span>Every beginning deserves a little care.</span></div></section>
    <div className="contact-grid">
      <section className="theme-card contact-form-card" aria-labelledby="contact-heading"><span className="theme-icon"><Mail aria-hidden="true" /></span><h2 id="contact-heading">How can we help?</h2><p>{supportEmail ? 'Complete the form to prepare an email to our support address.' : 'Direct support submission is not available yet. Complete the form to save a request draft.'}</p>
        <form noValidate onSubmit={submit} className="contact-form">
          <div ref={summary} tabIndex={-1} className="contact-status" role={Object.values(errors).some(Boolean) ? 'alert' : undefined}>{Object.values(errors).some(Boolean) && <>Please check the highlighted fields below. Your request has not been sent.</>}</div>
          <div className="contact-name-row"><div><label htmlFor="contact-name">Your name <span>(required)</span></label><input id="contact-name" autoComplete="name" required maxLength={100} value={fields.name} onChange={e => update('name', e.target.value)} {...errorProps('name')} />{fieldError('name')}</div><div><label htmlFor="contact-email">Email address <span>(required)</span></label><input id="contact-email" type="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={e => update('email', e.target.value)} {...errorProps('email')} />{fieldError('email')}</div></div>
          <div><label htmlFor="contact-topic">What is your question about? <span>(required)</span></label><select id="contact-topic" required value={fields.topic} onChange={e => update('topic', e.target.value)} {...errorProps('topic')}><option value="">Choose a topic</option>{topics.map(topic => <option key={topic}>{topic}</option>)}</select>{fieldError('topic')}</div>
          <div><label htmlFor="contact-message">Your message <span>(required)</span></label><textarea id="contact-message" required minLength={20} maxLength={2000} rows={6} value={fields.message} onChange={e => update('message', e.target.value)} {...errorProps('message')} /><div className="message-help"><span>Please don’t include passwords, OTPs, or identity documents.</span><span>{fields.message.length}/2000</span></div>{fieldError('message')}</div>
          <div><label className="contact-consent" htmlFor="contact-consent"><input id="contact-consent" type="checkbox" required checked={fields.consent} onChange={e => update('consent', e.target.checked)} {...errorProps('consent')} /><span>I agree to include my name, email, and message in this request.</span></label>{fieldError('consent')}</div>
          <div className="contact-submit-row"><button type="submit" className="theme-button">{supportEmail ? <Mail size={20} /> : <Download size={20} />}{supportEmail ? 'Prepare email' : 'Download request draft'}<ArrowRight size={18} /></button><span><ShieldCheck size={17} aria-hidden="true" />You review it before sharing.</span></div>
          {status && <p role="status" className="request-status">{status}</p>}
        </form>
      </section>
      <aside className="contact-sidebar"><section className="theme-card"><p className="theme-eyebrow">CONTACT DETAILS</p><h2>Stay connected.</h2>{supportEmail ? <a className="support-email" href={`mailto:${supportEmail}`}><Mail size={18} />{supportEmail}</a> : <p>A public support email, telephone number, and office address have not been published. We’ll show them here when available.</p>}<p className="support-note">Your request stays on this page until you choose to download it or open your email app.</p></section><section className="support-panel"><MessageCircle aria-hidden="true" /><h2>Already a member?</h2><p>Check your conversations for messages from your connections or a ShadiPlanner administrator.</p><Link to="/messages">Open messages <ArrowRight size={17} /></Link></section><section className="theme-card"><ShieldCheck className="text-rose-700" aria-hidden="true" /><h3>Your privacy comes first.</h3><p>Never share your password or verification code in a message. You can manage your password and phone number in account settings.</p><Link className="support-link" to="/account-settings">Account settings <ArrowRight size={16} /></Link></section></aside>
    </div>
    <section className="info-section" aria-labelledby="support-heading"><p className="theme-eyebrow">A HELPFUL PLACE TO START</p><h2 id="support-heading">Common questions, clear answers.</h2><div className="support-faq">{[{ question: 'Why isn’t my profile visible in search?', answer: 'New profiles need administrator approval before appearing in discovery. You can review your biodata and keep your details complete while waiting.' }, { question: 'When can I see someone’s contact details?', answer: 'Gold and Platinum include contact details after a mutual connection. Free keeps direct contacts private. Start by sending an interest to someone you would like to know better.' }, { question: 'How do I change my password or phone number?', answer: 'Sign in and open Account settings. Follow the instructions for changing your password or verifying a new phone number.' }, { question: 'Where can I organise my wedding plans?', answer: 'Open Wedding Planner to explore vendors, your checklist, and budget tools. Your existing planning tools are available from the navigation.' }].map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
  </div>;
};
