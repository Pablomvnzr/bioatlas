import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'BioAtlas',
  slug: 'bioatlas',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: true, bundleIdentifier: 'cl.bioatlas.mobile' },
  android: { package: 'cl.bioatlas.mobile' },
  plugins: process.env.GOOGLE_MAPS_API_KEY
    ? [['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }]]
    : [],
};
export default config;
