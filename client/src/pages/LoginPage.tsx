import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Heart, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const requestedPath = location.state?.from;
  const hasRequestedDestination = typeof requestedPath === 'string' && requestedPath.startsWith('/') && !requestedPath.startsWith('//') && requestedPath.split(/[?#]/)[0] !== '/login';
  const destination = hasRequestedDestination ? requestedPath : user?.role === 'admin' ? '/admin' : '/matches';
  useEffect(() => {
    if (user) navigate(destination, { replace: true });
  }, [user, navigate, destination]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout site-container">
      <section className="auth-story" aria-label="Your next chapter"><img src="/images/matrimonial-hero.webp" alt="An Indian couple in a wedding garden" width="1672" height="941" /><div><p className="theme-eyebrow">WELCOME TO YOUR NEXT CHAPTER</p><h1>Come for a connection.<br /><em>Stay for a lifetime.</em></h1><p>Your story is still being written. Find someone to share it with.</p></div></section>
      <div className="auth-card w-full space-y-8 bg-white p-6 sm:p-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-gradient-to-tr from-rose-600 to-amber-500 rounded-2xl flex items-center justify-center text-white mx-auto shadow-md text-2xl">
            <Heart aria-hidden="true" />
          </div>
          <h2 className="font-playfair text-2xl sm:text-3xl font-extrabold text-slate-900">
            Welcome to ShadiPlanner
          </h2>
          <p className="text-xs text-slate-500">
            Log in to view verified biodatas, mutual matches, and messages
          </p>
        </div>

        {typeof location.state?.message === 'string' && <p role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{location.state.message}</p>}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* Traditional Email / Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Registered Email ID
            </label>
            <div className="relative">
              <input
                id="login-email"
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-semibold rounded-xl text-xs shadow-md transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In To Account'}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            Don't have an auspicious profile yet?{' '}
            <Link to="/register" className="font-semibold text-rose-600 hover:underline">
              Register Free Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

