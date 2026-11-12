import Constants from 'expo-constants';
import { createTransport, normalizeBase } from './transport';

const host = Constants.expoConfig?.hostUri?.split(':')[0];
const configured = process.env.EXPO_PUBLIC_API_URL;
function configuration() {
  try {
    if (!__DEV__ && !configured) throw new Error('Set EXPO_PUBLIC_API_URL to your HTTPS backend before creating a release build.');
    return { base: normalizeBase(configured || `http://${host || '10.0.2.2'}:5000/api`, __DEV__), error: '' };
  } catch (error) { return { base: 'https://not-configured.invalid/api', error: (error as Error).message }; }
}
const configuredApi = configuration();
export const configurationError = configuredApi.error;
export const API_BASE = configuredApi.base;
export const assetUrl = (value?: string) => !value ? '' : value.startsWith('/') ? API_BASE.replace(/\/api$/, '') + value : /^https?:\/\//i.test(value) ? value : '';
let token: string | null = null;
let onExpired: () => void = () => {};
export const session = { setToken: (value: string | null) => { token = value; }, onExpired: (fn: () => void) => { onExpired = fn; } };
export const request = createTransport(API_BASE, () => token, () => onExpired());
export const query = (values: Record<string, string | number | undefined>) => new URLSearchParams(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))).toString();
