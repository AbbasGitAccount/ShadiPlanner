import React from 'react';
import { router } from 'expo-router';
import { profileFormPayload, profileFormValues } from '../../../../client/src/forms/profile';
import { useAuth } from '../../context/Auth';
import { request } from '../../lib/api';
import { ProfileForm } from '../../components/ProfileForm';
import { Empty, Screen } from '../../components/ui';
export default function EditProfile() { const { profile, refresh } = useAuth(); if (!profile) return <Screen><Empty title="No member biodata" text="Administrator accounts do not require a matrimonial profile." /></Screen>; return <Screen scroll={false}><ProfileForm editing initial={profileFormValues(profile)} onSave={async fields => { await request(`/profiles/${encodeURIComponent(profile.id)}`, profileFormPayload(fields, profile.partnerPreferences), 'PUT'); await refresh(); router.back(); }} /></Screen>; }
