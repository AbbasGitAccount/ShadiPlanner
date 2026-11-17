import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, X, Crown, Heart, Sparkles, ShieldCheck, LockKeyhole, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Membership, SubscriptionCatalogue, SubscriptionPlan, formatPrice } from '../types/subscriptions';
import { SubscriptionSummary } from '../components/SubscriptionSummary';

const rank = { free: 0, gold: 1, platinum: 2 };
const features: { label: string; value: (plan: SubscriptionPlan) => boolean | string }[] = [
  { label: 'Create a matrimonial profile', value: () => true },
  { label: 'Profile browsing', value: plan => plan.browseLimit === null ? 'Unlimited' : `Up to ${plan.browseLimit} discoverable profiles` },
  { label: 'Basic search filters', value: () => true },
  { label: 'Advanced search filters', value: plan => plan.advancedSearch },
  { label: 'Interests per calendar month', value: plan => plan.interestLimit === null ? 'Unlimited' : `${plan.interestLimit} interests / month` },
  { label: 'Direct chat & messaging with matches', value: plan => plan.directMessaging ?? (plan.id !== 'free') },
  { label: 'Contact details after mutual consent', value: plan => plan.contactDetails },
  { label: 'Priority customer support', value: plan => plan.support !== 'standard' },
  { label: 'Enhanced profile visibility', value: plan => plan.enhancedVisibility },
  { label: 'Compatible matches first', value: plan => plan.compatibleFirst },
  { label: 'Premium profile badge', value: plan => plan.premiumBadge },
  { label: 'Dedicated support', value: plan => plan.support === 'dedicated' },
];
export const SubscriptionsPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState<SubscriptionCatalogue>();
  const [current, setCurrent] = useState<Membership>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (isLoading) return;
    let active = true;
    setLoading(true); setError(''); setCurrent(undefined);
    Promise.all([api.getSubscriptionPlans(), user && user.role !== 'admin' ? api.getSubscription() : Promise.resolve(undefined)])
      .then(([plans, membership]) => { if (active) { setCatalogue(plans); setCurrent(membership); } })
      .catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, isLoading, attempt]);
  const subscribe = async (plan: SubscriptionPlan) => {
    if (!user) { navigate(plan.id === 'free' ? '/register' : '/login', { state: { from: '/subscriptions' } }); return; }
    if (pending || !current || rank[plan.id] <= rank[current.plan.id]) return;
    setPending(plan.id); setError('');
    try {
      const checkout = await api.createSubscriptionCheckout(plan.id);
      navigate(`/checkout?orderId=${encodeURIComponent(checkout.orderId)}`);
    }
    catch (err) { setError(err instanceof Error ? err.message : 'Checkout is unavailable. Your plan has not changed.'); }
    finally { setPending(''); }
  };
  return <div className="pricing-page site-container">
    <header className="pricing-intro"><p className="theme-eyebrow">A LITTLE MORE POSSIBILITY</p><h1>Choose your path to <em>forever.</em></h1><p>Start with your story. Find the plan that gives your next chapter room to grow.</p><span><ShieldCheck size={16} />Your choice. Your pace. Your connections.</span></header>
    {current && <SubscriptionSummary membership={current} />}
    {error && <div className="pricing-notice pricing-error" role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>Refresh subscription information</button></div>}
    {(loading || isLoading) ? <div role="status" className="pricing-loading">Loading plans and checking your subscription…</div> : catalogue && <>
      {!catalogue.checkout.available && <p className="pricing-notice" id="checkout-availability"><LockKeyhole size={20} aria-hidden="true" /><span>{catalogue.checkout.message} Prices are configurable; billing duration will be shown before checkout is enabled.</span></p>}
      <div className="pricing-grid">{catalogue.plans.map(plan => {
        const isCurrent = !!current && current.plan.id === plan.id;
        const lower = !!current && rank[plan.id] < rank[current.plan.id];
        const disabled = isCurrent || lower || !!pending || user?.role === 'admin' || (!!user && !current) || (plan.id !== 'free' && !catalogue.checkout.available);
        const Icon = plan.id === 'free' ? Heart : plan.id === 'gold' ? Crown : Sparkles;
        return <article className={`pricing-card pricing-${plan.id}`} key={plan.id} aria-labelledby={`plan-${plan.id}`}>
          {plan.id === 'gold' && <div className="popular-ribbon"><Sparkles size={14} />Most Popular</div>}
          <span className="pricing-plan-icon"><Icon size={27} aria-hidden="true" /></span><h2 id={`plan-${plan.id}`}>{plan.name}</h2><p className="pricing-tagline">{plan.id === 'free' ? 'A thoughtful place to begin.' : plan.id === 'gold' ? 'More ways to make a connection.' : 'Your most considered experience.'}</p>
          <div className="pricing-amount">{formatPrice(plan.pricePaise)}</div><p className="pricing-period">{plan.id === 'free' ? 'Free access' : plan.durationDays ? `For ${plan.durationDays} days of access` : 'Billing duration to be confirmed'}</p>
          <button onClick={() => void subscribe(plan)} disabled={disabled} className="pricing-plan-button" aria-describedby={plan.id !== 'free' && !catalogue.checkout.available ? 'checkout-availability' : undefined}>{pending === plan.id ? 'Preparing checkout…' : isCurrent ? 'Current Plan' : lower ? 'Included in your plan' : user?.role === 'admin' ? 'Member plans only' : plan.id === 'free' ? 'Create Free Profile' : current && current.plan.id !== 'free' ? `Upgrade to ${plan.name}` : `Subscribe to ${plan.name}`}{!disabled && <ArrowRight size={18} />}</button>
          <ul className="pricing-feature-list">{features.map(feature => { const value = feature.value(plan); return <li key={feature.label} className={value === false ? 'feature-unavailable' : ''}>{value === false ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}<span>{typeof value === 'string' ? <>{feature.label === 'Profile browsing' || feature.label === 'Interests per calendar month' ? value : `${feature.label}: ${value}`}</> : <>{value === false && <span className="sr-only">Not included: </span>}{feature.label}</>}</span></li>; })}</ul>
        </article>;
      })}</div>
      <p className="pricing-fineprint">Interest allowances reset on the first day of each calendar month at 00:00 UTC, independently of billing duration. Free browsing includes a limited discovery selection; existing mutual connections remain accessible. Paid access never bypasses profile approval or mutual consent.</p>
    </>}
    <section className="pricing-trust" aria-label="Subscription safeguards">{[{ Icon: ShieldCheck, title: 'Verified before activation', text: 'Paid access activates only after our server verifies a captured payment with the payment provider.' }, { Icon: LockKeyhole, title: 'Consent stays essential', text: 'Gold and Platinum can view contact details only after a mutual connection. Free keeps direct contacts private.' }, { Icon: Heart, title: 'Clear, considered choices', text: 'Your current plan, remaining allowance, and paid expiry are checked against your account on the server.' }].map(({ Icon, title, text }) => <article key={title}><Icon aria-hidden="true" /><h2>{title}</h2><p>{text}</p></article>)}</section>
    <section className="pricing-faq" aria-labelledby="pricing-faq-title"><p className="theme-eyebrow">A FEW THINGS TO KNOW</p><h2 id="pricing-faq-title">Your questions, answered.</h2>{[
      { q: 'Are these monthly or annual prices?', a: 'No billing duration is assumed. The duration is configurable and must be confirmed before paid checkout can be enabled. Interest allowances use a separate calendar-month reset.' },
      { q: 'Can I purchase a paid plan right now?', a: catalogue?.checkout.available ? 'Choose a higher plan to begin checkout. Your subscription changes only after server-side verification of your payment.' : 'Paid checkout is not available yet because a payment provider has not been connected. You can use Free; selecting or viewing a paid plan does not activate it.' },
      { q: 'Does a paid plan unlock everyone’s contact details?', a: 'No. Gold and Platinum require mutual consent through an accepted connection. Profile approval and privacy checks apply to every plan.' },
      { q: 'What happens when paid access expires?', a: 'Your account returns to Free automatically. Your profile and existing connections remain, while contact visibility, search access, and interest allowances follow Free limits.' },
      { q: 'Can an upgrade reset my monthly interest count?', a: 'No. Interests already sent in the current calendar month count toward your new plan allowance. An upgrade changes the limit, not the usage history.' },
    ].map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}<Link to="/contact">Need more guidance? Visit support <ArrowRight size={17} /></Link></section>
  </div>;
};
