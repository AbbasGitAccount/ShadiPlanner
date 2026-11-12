import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/Auth';
import { ProfileForm } from '../components/ProfileForm';
import { Screen } from '../components/ui';
export default function Register() { const auth = useAuth(); if (auth.user) return <Redirect href={auth.user.role === 'admin' ? '/admin' : '/(member)/(tabs)'} />; return <Screen scroll={false}><ProfileForm onSave={auth.register} /></Screen>; }
