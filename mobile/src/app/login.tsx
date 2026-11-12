import React, { useState } from 'react';
import { Text } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../context/Auth';
import { Button, Card, Field, Problem, Screen, s } from '../components/ui';

export default function Login() {
  const auth = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (auth.user) return <Redirect href={auth.user.role === 'admin' ? '/admin' : '/(member)/(tabs)'} />;
  async function submit() { setBusy(true); setError(''); try { await auth.login(email, password); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Screen><Text style={s.eyebrow}>YOUR STORY CONTINUES</Text><Text style={s.title}>Welcome back.</Text><Text style={s.muted}>Sign in with your existing ShadiPlanner account. Your profiles, connections and messages are already here.</Text><Card><Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={() => { if (email && password && !busy) void submit(); }} />{error && <Problem message={error} />}<Button title={busy ? 'Signing in…' : 'Sign in to my account'} disabled={busy || !email.trim() || !password} onPress={() => void submit()} /></Card><Button title="New here? Create a free profile" secondary onPress={() => router.push('/register')} /></Screen>;
}
