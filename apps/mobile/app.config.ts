import type { ExpoConfig } from 'expo/config';
if (process.env.EAS_BUILD === 'true' && !/^https:\/\//.test(process.env.EXPO_PUBLIC_API_URL ?? ''))
  throw Error(
    'La compilación instalable requiere EXPO_PUBLIC_API_URL con la dirección HTTPS de la API publicada.',
  );
const config: ExpoConfig = {
  name: 'BioAtlas',
  slug: 'bioatlas',
  owner: 'thecharles445',
  extra: { eas: { projectId: 'cd54013c-7066-4e18-a822-f1ce44688b87' } },
  version: '0.1.1',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: true, bundleIdentifier: 'cl.bioatlas.mobile' },
  android: { package: 'cl.bioatlas.mobile', versionCode: 2 },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'BioAtlas usa tu ubicación para centrar el mapa y ubicar tus avistamientos.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidMotionActivityEnabled: false,
        locationAlwaysPermission: false,
        locationAlwaysAndWhenInUsePermission: false,
        motionUsagePermission: false,
      },
    ],
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Permite seleccionar un video para publicarlo en BioAtlas.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    'expo-video',
  ],
};
export default config;
