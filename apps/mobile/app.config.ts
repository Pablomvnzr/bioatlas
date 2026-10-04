import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'BioAtlas',
  slug: 'bioatlas',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: true, bundleIdentifier: 'cl.bioatlas.mobile' },
  android: { package: 'cl.bioatlas.mobile' },
  plugins: ['expo-secure-store'],
};
export default config;
