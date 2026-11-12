import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowUpRight, ShieldCheck, Lock, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => <footer className="site-footer">
  <div className="site-container">
    <div className="footer-invitation"><div><p className="theme-eyebrow">YOUR STORY IS JUST BEGINNING</p><h2>Find your person. Plan your forever.</h2></div><Link to="/matches" className="footer-cta">Explore matches <ArrowUpRight size={20} /></Link></div>
    <div className="footer-grid">
      <div className="footer-brand"><Link to="/" className="footer-logo"><Heart aria-hidden="true" />ShadiPlanner</Link><p>Meaningful connections, shared traditions, and wedding plans that feel like you.</p><div className="footer-assurances"><span><ShieldCheck size={16} />Reviewed profiles</span><span><Lock size={16} />Contact privacy</span></div></div>
      <nav aria-label="Discover"><h3>Discover</h3><Link to="/about">About us</Link><Link to="/matches">Find your match</Link><Link to="/register">Create your profile</Link><Link to="/login">Member login</Link><Link to="/subscriptions">Subscription plans</Link></nav>
      <nav aria-label="Wedding planning"><h3>Your celebration</h3><Link to="/shadi-planner?tab=vendors">Wedding vendors</Link><Link to="/shadi-planner?tab=checklist">Wedding checklist</Link><Link to="/shadi-planner?tab=budget">Budget planner</Link><Link to="/shadi-planner"><Sparkles size={15} />Planning tools</Link></nav>
      <nav aria-label="Help and account"><h3>Here to help</h3><Link to="/contact">Contact & support</Link><Link to="/contact#support-heading">Common questions</Link><Link to="/account-settings">Account settings</Link><Link to="/my-profile">My biodata</Link></nav>
    </div>
    <div className="footer-bottom"><p>© {new Date().getFullYear()} ShadiPlanner. Made for meaningful beginnings.</p><span>Hearts connected. Traditions celebrated.</span></div>
  </div>
</footer>;
