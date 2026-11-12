import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/Auth';
import { Button, Loading, Problem, Screen, colors } from '../components/ui';

function Navigation() {
  const auth = useAuth();
  if (auth.loading) return <Screen><Loading /></Screen>;
  if (auth.error) return <Screen><Problem message={auth.error} retry={() => void auth.restore()} /><Button title="Return to sign in" secondary onPress={() => void auth.logout()} /></Screen>;
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerStyle: { backgroundColor: colors.ivory }, headerTintColor: colors.wine, headerShadowVisible: false, contentStyle: { backgroundColor: colors.ivory } }}><Stack.Screen name="index" options={{ headerShown: false }} /><Stack.Screen name="login" options={{ title: 'Welcome back' }} /><Stack.Screen name="register" options={{ title: 'Create your profile' }} /><Stack.Screen name="(member)" options={{ headerShown: false }} /></Stack></>;
}
export default function RootLayout() { return <SafeAreaProvider><AuthProvider><Navigation /></AuthProvider></SafeAreaProvider>; }
