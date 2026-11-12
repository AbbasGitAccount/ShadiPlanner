import type { ExpoConfig } from 'expo/config';

const development = process.env.APP_VARIANT === 'development';
if (process.env.EAS_BUILD_PROFILE === 'production' && !/^https:\/\//.test(process.env.EXPO_PUBLIC_API_URL || '')) throw new Error('Production builds require EXPO_PUBLIC_API_URL pointing to your HTTPS backend.');
const config: ExpoConfig = {
  name: development ? 'ShadiPlanner Dev' : 'ShadiPlanner', slug: 'shadiplanner-mobile', scheme: 'shadiplanner', version: '1.0.0',
  platforms: ['android'], orientation: 'portrait', userInterfaceStyle: 'light', backgroundColor: '#FBF8F3',
  icon: './assets/icon.png',
  android: { package: development ? 'com.shadiplanner.mobile.dev' : 'com.shadiplanner.mobile', versionCode: 1, predictiveBackGestureEnabled: true, adaptiveIcon: { foregroundImage: './assets/android-icon-foreground.png', backgroundColor: '#6C233E' } },
  plugins: ['expo-router', 'expo-secure-store', ['expo-build-properties', { android: { usesCleartextTraffic: development } }]],
};
export default config;
