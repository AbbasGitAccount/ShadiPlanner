import React from 'react';
import { View } from 'react-native';
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
  const bottomInset = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.wine,
        tabBarInactiveTintColor: '#7A6270',
        tabBarStyle: {
          position: 'absolute',
          bottom: bottomInset,
          left: 14,
          right: 14,
          height: 64,
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: '#EFE3E8',
          shadowColor: '#381626',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 10,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.2,
        },
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? '#F8E8EE' : 'transparent',
              paddingHorizontal: 12,
              paddingVertical: 3,
              borderRadius: 14,
              minWidth: 44,
            }}
          >
            <Ionicons
              name={focused ? activeIcons[route.name] : inactiveIcons[route.name]}
              color={focused ? colors.wine : '#7A6270'}
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
