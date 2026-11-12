import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { configurationError, request, session } from '../lib/api';
import type { MatrimonialProfile, Session, User } from '../types';

const KEY = 'shadiplanner.session';
interface Auth { user: User | null; profile: MatrimonialProfile | null; loading: boolean; error: string; login: (email: string, password: string) => Promise<void>; register: (fields: Record<string, string>) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void>; restore: () => Promise<void> }
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [profile, setProfile] = useState<MatrimonialProfile | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(configurationError); const version = useRef(0);
  const logout = useCallback(async () => { version.current++; session.setToken(null); setUser(null); setProfile(null); setError(''); await SecureStore.deleteItemAsync(KEY); }, []);
  const refresh = useCallback(async () => { const current = version.current; const data = await request<Pick<Session, 'user' | 'profile'>>('/auth/me'); if (version.current === current) { setUser(data.user); setProfile(data.profile); } }, []);
  const restore = useCallback(async () => {
    try { const saved = await SecureStore.getItemAsync(KEY); setLoading(true); setError(configurationError); if (configurationError) return; if (saved) { session.setToken(saved); await refresh(); } }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [refresh]);
  useEffect(() => {
    let alive = true;
    session.onExpired(() => { void logout().catch(() => setError('Could not clear the stored session. Please restart the app.')); });
    void SecureStore.getItemAsync(KEY).then(async saved => { if (!alive || configurationError) return; if (saved) { session.setToken(saved); await refresh(); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; session.onExpired(() => {}); };
  }, [logout, refresh]);
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state === 'active' && user) void refresh().catch(() => {}); }); return () => sub.remove(); }, [refresh, user]);
  async function accept(data: Session) { await SecureStore.setItemAsync(KEY, data.token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); version.current++; session.setToken(data.token); setUser(data.user); setProfile(data.profile); setError(''); }
  return <Context.Provider value={{ user, profile, loading, error, logout, refresh, restore,
    login: async (email, password) => accept(await request<Session>('/auth/login', { email: email.trim(), password })),
    register: async fields => accept(await request<Session>('/auth/register', fields)) }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Missing authentication provider'); return value; }
