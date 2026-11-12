import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <p role="status" className="p-8 text-center text-sm text-slate-500">Loading your account...</p>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname + location.search + location.hash }} replace />;

  return <>{children}</>;
};
