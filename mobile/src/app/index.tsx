import React from 'react';
import { ImageBackground, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/Auth';
import { Button, Screen, colors, s } from '../components/ui';

export default function Welcome() {
  const { user } = useAuth();
  if (user) return <Redirect href={user.role === 'admin' ? '/admin' : '/(member)/(tabs)'} />;
  return <Screen><View style={[s.row, { marginTop: 16 }]}><Ionicons name="heart" color={colors.coral} size={29} /><Text style={[s.h2, { fontFamily: 'serif', fontSize: 25, color: colors.wine }]}>ShadiPlanner</Text></View><ImageBackground source={require('../../assets/matrimonial-hero-mobile.webp')} style={{ height: 420, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 28 }}><LinearGradient colors={['transparent', '#381626E8']} style={{ padding: 27, paddingTop: 130 }}><Text style={[s.eyebrow, { color: '#F5CCA5' }]}>YOUR NEXT CHAPTER</Text><Text style={[s.title, { color: '#FFF8ED', fontSize: 36, marginTop: 13 }]}>A connection.{"\n"}A lifetime.{"\n"}Your forever.</Text></LinearGradient></ImageBackground><Text style={s.muted}>Find a partner who shares your values. Make meaningful connections, then plan your celebration together.</Text><Button title="Create my free profile" icon="heart-outline" onPress={() => router.push('/register')} /><Button title="I already have an account" secondary onPress={() => router.push('/login')} /><Text style={[s.muted, { textAlign: 'center', fontSize: 11 }]}>Reviewed profiles · Private contacts · Mutual consent</Text></Screen>;
}
