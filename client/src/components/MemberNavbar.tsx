import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X, MessageCircle, ChevronDown, UserRound, Settings, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MemberNavigation } from './MemberNavigation';

export const MemberNavbar: React.FC = () => {
  const { user, profile, isPaidMember, logout } = useAuth();
  const location = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const administrator = user?.role === 'admin';
  const accountPath = administrator ? '/admin' : '/my-profile';
  const closeMenu = () => dialog.current?.close();
  useEffect(() => { closeMenu(); account.current?.removeAttribute('open'); }, [location.pathname, location.search, location.hash]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1200px)');
    const closeOnDesktop = () => { if (media.matches) closeMenu(); };
    media.addEventListener('change', closeOnDesktop);
    return () => { media.removeEventListener('change', closeOnDesktop); document.body.style.overflow = ''; };
  }, []);
  const openMenu = () => { dialog.current?.showModal(); document.body.style.overflow = 'hidden'; menuButton.current?.setAttribute('aria-expanded', 'true'); };
  return <>
    <header className="member-header">
      <div className="member-header-inner">
        <button ref={menuButton} className="member-menu-toggle" onClick={openMenu} aria-label="Open account navigation" aria-haspopup="dialog" aria-expanded="false" aria-controls="member-menu"><Menu size={23} /></button>
        <Link to="/" className="member-brand"><span><Heart size={25} aria-hidden="true" /></span><div><strong>ShadiPlanner</strong><small>MEANINGFUL BEGINNINGS</small></div></Link>
        <nav className="member-top-links" aria-label="Explore"><Link to="/matches">Browse matches</Link><Link to="/subscriptions">Membership plans</Link><Link to="/shadi-planner">Wedding planner</Link><Link to="/download" className="inline-flex items-center gap-1.5"><Smartphone size={15} className="text-rose-600" /><span>Get App</span></Link></nav>
        <div className="member-header-actions">{isPaidMember && <Link to="/messages" className="member-message-link" aria-label="Open messages"><MessageCircle size={22} /></Link>}
          <details className="member-account-menu" ref={account}><summary aria-label="Account options"><img src={profile?.profilePhoto || '/avatar-placeholder.svg'} alt="" width={32} height={32} /><span>{administrator ? 'Administrator' : profile?.fullName?.split(' ')[0] || 'My account'}</span><ChevronDown size={15} aria-hidden="true" /></summary><div className="member-account-options"><Link to={administrator ? '/admin/users' : accountPath}><UserRound size={17} />{administrator ? 'Admin verification' : 'My profile'}</Link><Link to="/account-settings"><Settings size={17} />Account settings</Link><button onClick={logout}><LogOut size={17} />Log out</button></div></details>
          <Link className="member-account-cta" to={accountPath}>{administrator ? 'Admin panel' : 'My profile'}</Link>
        </div>
      </div>
    </header>
    <dialog ref={dialog} id="member-menu" className="member-drawer" aria-labelledby="member-menu-title" onClose={() => { document.body.style.overflow = ''; menuButton.current?.setAttribute('aria-expanded', 'false'); menuButton.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget && event.clientX > event.currentTarget.getBoundingClientRect().right) closeMenu(); }}>
      <div className="member-drawer-heading"><h2 id="member-menu-title">Your ShadiPlanner</h2><button onClick={closeMenu} aria-label="Close account navigation"><X size={23} /></button></div><MemberNavigation onNavigate={closeMenu} />
    </dialog>
  </>;
};
