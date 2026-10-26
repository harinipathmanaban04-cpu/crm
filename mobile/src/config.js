import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiBase } from './utils/urls';

const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
export const API_BASE = resolveApiBase({ envUrl: process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl, hostUri, isDev: __DEV__, platform: Platform.OS });
export const API_URL = `${API_BASE}/api`;
export const SOCKET_URL = API_BASE;
export const DEFAULT_COUNTRY_CODE = '91'; // used for WhatsApp when a lead has a 10-digit number
