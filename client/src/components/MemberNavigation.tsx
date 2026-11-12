import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Heart, Inbox, Send, Eye, MessageCircle, CalendarHeart, Settings, UserRound, ShieldCheck, HelpCircle, LogOut, ArrowUpRight, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MemberNavigation: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { user, profile, logout } = useAuth();
  const { pathname, search } = useLocation();
  const tab = new URLSearchParams(search).get('tab') || 'received';
  const administrator = user?.role === 'admin';
  const groups = [
    { label: administrator ? 'Administration' : 'Your journey', items: [
      ...(administrator ? [{ to: '/admin/users', label: 'Profile verification', Icon: ShieldCheck }] : [{ to: '/my-profile', label: 'My profile & biodata', Icon: UserRound }]),
      { to: '/matches', label: 'Search matches', Icon: Search },
      ...(!administrator ? [
        { to: '/interests?tab=shortlist', label: 'Shortlisted profiles', Icon: Heart },
        { to: '/interests?tab=received', label: 'Received interests', Icon: Inbox },
        { to: '/interests?tab=sent', label: 'Sent interests', Icon: Send },
      ] : []),
      { to: '/messages', label: 'Messages', Icon: MessageCircle },
      ...(!administrator ? [{ to: '/interests?tab=views', label: 'Profile views', Icon: Eye }] : []),
    ] },
    { label: 'Plan & manage', items: [
      { to: '/subscriptions', label: 'Subscription plans', Icon: Crown },
      { to: '/shadi-planner', label: 'Wedding planner', Icon: CalendarHeart },
      { to: '/account-settings', label: 'Account settings', Icon: Settings },
      { to: '/contact', label: 'Help & contact', Icon: HelpCircle },
    ] },
  ];
  return <div className="member-navigation">
    <div className="member-identity"><img src={profile?.profilePhoto || '/avatar-placeholder.svg'} alt="" width={48} height={48} /><div><strong>{administrator ? 'Administrator' : profile?.fullName || 'Your account'}</strong><span>{administrator ? 'ShadiPlanner administration' : profile?.isVerified ? 'Approved profile' : 'Profile awaiting approval'}</span></div></div>
    <nav aria-label="Account navigation">{groups.map(group => <div className="member-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(({ to, label, Icon }) => {
      const [path, query] = to.split('?');
      const active = path === '/interests' ? pathname === path && tab === new URLSearchParams(query).get('tab') : path === '/matches' ? pathname === path || pathname.startsWith('/profile/') : pathname === path;
      return <Link key={to} to={to} onClick={onNavigate} className={`member-nav-link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span>{active && <span className="member-active-mark" aria-hidden="true" />}</Link>;
    })}</div>)}</nav>
    <div className="member-nav-help"><span>Here for your next step.</span><p>Find answers about profiles, connections, and your account.</p><Link to="/contact#support-heading" onClick={onNavigate}>Visit the help centre <ArrowUpRight size={17} /></Link></div>
    <button className="member-signout" onClick={() => { onNavigate?.(); logout(); }}><LogOut size={18} aria-hidden="true" />Log out</button>
  </div>;
};
