import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../../components/ui';
const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = { index: 'compass-outline', connections: 'heart-outline', inbox: 'chatbubbles-outline', account: 'person-circle-outline' };
export default function TabLayout() { return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.wine, tabBarInactiveTintColor: '#B09CA7', tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line, height: 70, paddingTop: 8, paddingBottom: 10 }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} color={typeof color === 'string' ? color : colors.wine} size={size} /> })}><Tabs.Screen name="index" options={{ title: 'Discover' }} /><Tabs.Screen name="connections" options={{ title: 'Connections' }} /><Tabs.Screen name="inbox" options={{ title: 'Messages' }} /><Tabs.Screen name="account" options={{ title: 'My account' }} /></Tabs>; }
