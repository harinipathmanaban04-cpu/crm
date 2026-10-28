// Dynamic Expo config. The API URL comes from EXPO_PUBLIC_API_URL (see .env.example / eas.json).
const api = process.env.EXPO_PUBLIC_API_URL || '';
const secure = api.startsWith('https://');

module.exports = {
  expo: {
    owner: 'eco-friendly-tech-solutions',
    name: 'CRM',
    slug: 'eco-crm-sales',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'ecocrmsales',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#FFFFFF' },
    android: {
      package: 'com.ecofriendlytech.crmsales',
      versionCode: 2,
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#FFFFFF' },
      softwareKeyboardLayoutMode: 'resize',
    },
    plugins: [
      'expo-secure-store',
      // Plain-HTTP API (LAN testing) needs cleartext traffic; an https:// production URL turns it off.
      ['expo-build-properties', { android: { usesCleartextTraffic: !secure } }],
    ],
   extra: {
  apiUrl: api,
  eas: {
    projectId: 'dbe859a0-f349-4d6a-aa95-58024d7d10b4',
  },
},
  },
};
