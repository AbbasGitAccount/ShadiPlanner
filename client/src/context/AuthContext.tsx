import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, MatrimonialProfile } from '../types';
import { Membership } from '../types/subscriptions';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  profile: MatrimonialProfile | null;
  membership: Membership | null;
  isPaidMember: boolean;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MatrimonialProfile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('shadi_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchMembershipForUser = async (currentUser: User | null) => {
    if (!currentUser || currentUser.role === 'admin') {
      setMembership(null);
      return;
    }
    try {
      const data = await api.getSubscription();
      setMembership(data);
    } catch {
      setMembership(null);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      if (!token) return;
      const data = await api.getCurrentUser();
      if (data && data.user) {
        setUser(data.user);
        setProfile(data.profile);
        if (data.membership) {
          setMembership(data.membership);
        } else {
          void fetchMembershipForUser(data.user);
        }
      } else {
        localStorage.removeItem('shadi_token');
        setToken(null);
        setUser(null);
        setProfile(null);
        setMembership(null);
      }
    } catch (e) {
      console.warn('Auth check fallback:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('shadi_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setProfile(res.profile);
      if (res.membership) {
        setMembership(res.membership);
      } else {
        void fetchMembershipForUser(res.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem('shadi_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setProfile(res.profile);
      if (res.membership) {
        setMembership(res.membership);
      } else {
        void fetchMembershipForUser(res.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('shadi_token');
    setToken(null);
    setUser(null);
    setProfile(null);
    setMembership(null);
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const data = await api.getCurrentUser();
      if (data && data.profile) {
        setProfile(data.profile);
      }
      if (data && data.membership) {
        setMembership(data.membership);
      }
    } catch (e) {
      console.error('Error refreshing profile:', e);
    }
  };

  const refreshMembership = async () => {
    if (!token || !user || user.role === 'admin') return;
    await fetchMembershipForUser(user);
  };

  const isPaidMember = user?.role === 'admin' || Boolean(
    membership &&
    membership.status === 'active' &&
    membership.plan.id !== 'free' &&
    membership.plan.directMessaging !== false
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        membership,
        isPaidMember,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        refreshMembership,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

