import React from 'react';
import { View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../components/ui';

const activeIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  index: 'compass',
  connections: 'heart',
  inbox: 'chatbubbles',
  account: 'person-circle',
};

const inactiveIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  index: 'compass-outline',
  connections: 'heart-outline',
  inbox: 'chatbubbles-outline',
  account: 'person-circle-outline',
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Safe clearance above Android 3-button navigation bar (||| O <) and gesture bar
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.wine,
        tabBarInactiveTintColor: '#6E5A68',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EFE3E8',
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 16,
          shadowColor: '#381626',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.1,
        },
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? '#FCEBED' : 'transparent',
              paddingHorizontal: 16,
              paddingVertical: 4,
              borderRadius: 16,
              minWidth: 48,
            }}
          >
            <Ionicons
              name={focused ? activeIcons[route.name] : inactiveIcons[route.name]}
              color={focused ? colors.wine : '#6E5A68'}
              size={22}
            />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="connections" options={{ title: 'Connections' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Messages' }} />
      <Tabs.Screen name="account" options={{ title: 'My account' }} />
    </Tabs>
  );
}
