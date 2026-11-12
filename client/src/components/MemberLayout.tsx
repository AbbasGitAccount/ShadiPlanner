import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MemberNavigation } from './MemberNavigation';

export const MemberLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if(pathname.startsWith('/admin')) return <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>;
  const hasSidebar = !!user && (/^\/(matches|interests|messages|my-profile|account-settings|admin|shadi-planner|subscriptions)(\/|$)/.test(pathname) || pathname.startsWith('/profile/'));
  return <div className={hasSidebar ? 'member-workspace' : 'flex flex-col flex-1'}>
    {hasSidebar && <aside className="member-sidebar"><MemberNavigation /></aside>}
    <main id="main-content" tabIndex={-1} className={`site-main flex-1${hasSidebar ? ' member-main' : ''}`}>{children}</main>
  </div>;
};
