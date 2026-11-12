import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Membership, subscriptionDate } from '../types/subscriptions';

export const SubscriptionSummary: React.FC<{ membership?: Membership }> = ({ membership: supplied }) => {
  const { user } = useAuth();
  const [current, setCurrent] = useState<Membership | undefined>(supplied);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (supplied) { setCurrent(supplied); return; }
    if (!user || user.role === 'admin') return;
    let active = true;
    setError('');
    api.getSubscription().then(value => { if (active) setCurrent(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [user?.id, supplied, retry]);
  if (!user || user.role === 'admin') return null;
  return <section className="subscription-summary" aria-label="Your subscription"><span className="subscription-summary-icon"><Crown aria-hidden="true" /></span><div className="subscription-summary-copy"><h2>{current ? `${current.plan.name} plan` : 'Your subscription'}</h2>{error ? <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Try again</button></p> : !current ? <p role="status">Loading your plan…</p> : <><p>{current.plan.interestLimit === null ? `${current.interestsUsed} interests sent · Unlimited allowance` : `${current.interestsUsed} of ${current.plan.interestLimit} monthly interests used`} <span>· Resets {subscriptionDate(current.interestsResetAt)} (UTC)</span></p><p>{current.status === 'active' && current.expiresAt ? `Active until ${subscriptionDate(current.expiresAt)} (UTC)` : current.status === 'cancelled' ? 'Your paid subscription was cancelled. Your account is now on Free.' : current.status === 'expired' ? 'Your paid access has ended. Your account is now on Free.' : 'Free access. No paid subscription is active.'}</p></>}</div><Link to="/subscriptions">Manage plan <ArrowRight size={17} /></Link></section>;
};
