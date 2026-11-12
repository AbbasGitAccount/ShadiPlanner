import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MemberNavbar } from './MemberNavbar';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname, location.search, location.hash]);
  if(location.pathname.startsWith('/admin')) return null;
  if (user) return <MemberNavbar />;
  const links = [{ to: '/about', label: 'About us' }, { to: '/contact', label: 'Contact' }, { to: '/subscriptions', label: 'Membership plans' }, { to: '/shadi-planner?tab=vendors', label: 'Wedding vendors' }, { to: '/shadi-planner', label: 'Wedding planner' }];
  return <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-rose-100 shadow-sm matrimonial-nav">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between gap-4 h-20">
      <Link to="/" className="flex items-center space-x-2.5 group"><div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-200 group-hover:scale-105 transition-transform"><Heart className="w-6 h-6" aria-hidden="true" /></div><div><span className="font-playfair font-bold text-2xl tracking-tight bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 bg-clip-text text-transparent">ShadiPlanner</span><span className="hidden sm:block text-[10px] tracking-widest text-slate-400 font-semibold uppercase">Life partners & wedding planning</span></div></Link>
      <nav aria-label="Main navigation" className="hidden xl:flex items-center gap-1">{links.map(({ to, label }) => <Link key={to} to={to} className="nav-info-link" aria-current={location.pathname + location.search === to ? 'page' : undefined}>{to === '/shadi-planner' && <Sparkles className="w-4 h-4 mr-2 text-amber-600" aria-hidden="true" />}{label}</Link>)}</nav>
      <div className="hidden xl:flex items-center gap-3"><Link to="/login" className="text-sm font-medium text-slate-700 hover:text-rose-600 px-3 py-2">Log In</Link><Link to="/register" className="text-sm font-semibold text-white bg-rose-600 px-4 py-3 rounded-lg">Create Free Profile</Link></div>
      <button onClick={() => setMobileMenuOpen(value => !value)} aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} aria-controls="site-mobile-menu" className="xl:hidden p-2 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-slate-100">{mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
    </div></div>
    {mobileMenuOpen && <nav id="site-mobile-menu" aria-label="Mobile navigation" className="max-h-[calc(100dvh-80px)] overflow-y-auto xl:hidden border-t border-slate-100 bg-white px-4 pt-2 pb-6 space-y-2">{links.map(({ to, label }) => <Link key={to} to={to} className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-rose-50">{label}</Link>)}<div className="grid grid-cols-2 gap-3 pt-3"><Link to="/login" className="rounded-lg border border-rose-200 p-3 text-center text-sm font-semibold text-rose-700">Member login</Link><Link to="/register" className="rounded-lg bg-rose-600 p-3 text-center text-sm font-semibold text-white">Join free</Link></div></nav>}
  </header>;
};
