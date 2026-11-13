import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { boundsSchema, type Bounds, type Observation, type Zone } from '@bioatlas/contracts';
import { apiBase } from './api';

export const initialBounds: Bounds = {
  west: -73.3159,
  east: -73.1759,
  south: -39.8742,
  north: -39.7542,
};
type Point = { latitude: number; longitude: number };
export default function Map({
  items = [],
  bounds = initialBounds,
  onBounds,
  onSelect,
  onPick,
  point,
  zones = [],
  selectedZoneId,
  onExploreZone,
  focusBounds,
}: {
  items?: Observation[];
  bounds?: Bounds;
  onBounds?: (b: Bounds) => void;
  onSelect?: (id: string) => void;
  onPick?: (p: Point) => void;
  point?: Point;
  zones?: Zone[];
  selectedZoneId?: string;
  onExploreZone?: (id: string) => void;
  focusBounds?: Bounds;
}) {
  const ref = useRef<WebView>(null);
  const startBounds = useRef(bounds);
  const [ready, setReady] = useState(false),
    [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [gpsPoint, setGpsPoint] = useState<Point>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function locate() {
    if (locating) return;
    setLocating(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) {
        Alert.alert(
          'Permiso de ubicación',
          'Puedes seguir usando el mapa sin GPS. Para usar tu ubicación, permite el acceso en los ajustes de BioAtlas.',
          permission.canAskAgain
            ? [{ text: 'Entendido' }]
            : [
                { text: 'Ahora no', style: 'cancel' },
                {
                  text: 'Abrir ajustes',
                  onPress: () => {
                    void Linking.openSettings();
                  },
                },
              ],
        );
        return;
      }
      if (!(await Location.hasServicesEnabledAsync()))
        throw Error('Activa la ubicación del teléfono y vuelve a intentarlo.');
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                Error('El GPS está tardando. Acércate a una ventana o elige el punto en el mapa.'),
              ),
            20000,
          );
        }),
      ]);
      if (!mounted.current) return;
      const position = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setGpsPoint(position);
      onPick?.(position);
    } catch (error) {
      if (mounted.current)
        Alert.alert(
          'No pudimos obtener tu ubicación',
          error instanceof Error
            ? error.message
            : 'Inténtalo nuevamente o elige el punto en el mapa.',
        );
    } finally {
      if (timer) clearTimeout(timer);
      if (mounted.current) setLocating(false);
    }
  }
  const inject = (fn: string, value: unknown) =>
    ref.current?.injectJavaScript(
      `window.${fn}(${JSON.stringify(value).replace(/</g, '\\u003c')});true;`,
    );
  useEffect(() => {
    if (ready) inject('setRecords', items);
  }, [ready, items]);
  useEffect(() => {
    if (ready) inject('setAreas', { items: zones, selected: selectedZoneId });
  }, [ready, zones, selectedZoneId]);
  useEffect(() => {
    if (ready && focusBounds) inject('setZone', focusBounds);
  }, [ready, focusBounds]);
  useEffect(() => {
    if (ready && point) inject('setPick', point);
  }, [ready, point]);
  useEffect(() => {
    if (!ready || !gpsPoint) return;
    inject('setZone', {
      south: Math.max(-90, gpsPoint.latitude - 0.005),
      north: Math.min(90, gpsPoint.latitude + 0.005),
      west: Math.max(-180, gpsPoint.longitude - 0.005),
      east: Math.min(180, gpsPoint.longitude + 0.005),
    });
    inject('setPick', gpsPoint);
  }, [ready, gpsPoint]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) setFailed(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [attempt, loaded]);
  const url = `${apiBase()}/map`;
  return (
    <View style={{ flex: 1 }}>
      <WebView
        key={attempt}
        ref={ref}
        source={{ uri: url }}
        style={{ flex: 1 }}
        javaScriptEnabled
        webviewDebuggingEnabled={__DEV__}
        cacheEnabled
        applicationNameForUserAgent="BioAtlas/0.1"
        mixedContentMode="never"
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url === url || request.url === 'about:blank') return true;
          if (request.url === 'https://www.openstreetmap.org/copyright')
            void Linking.openURL(request.url).catch(() => {});
          return false;
        }}
        onMessage={({ nativeEvent }) => {
          try {
            const data = JSON.parse(nativeEvent.data);
            if (data.type === 'ready') {
              inject('setZone', startBounds.current);
              setReady(true);
            }
            if (data.type === 'loaded') {
              setLoaded(true);
              setFailed(false);
            }
            if (data.type === 'error') setFailed(true);
            if (data.type === 'bounds') {
              const parsed = boundsSchema.safeParse(data.bounds);
              if (parsed.success) onBounds?.(parsed.data);
            }
            if (data.type === 'select' && typeof data.id === 'string') onSelect?.(data.id);
            if (data.type === 'exploreZone' && typeof data.id === 'string')
              onExploreZone?.(data.id);
            if (
              data.type === 'pick' &&
              Number.isFinite(data.latitude) &&
              Number.isFinite(data.longitude) &&
              Math.abs(data.latitude) <= 90 &&
              Math.abs(data.longitude) <= 180
            )
              onPick?.({ latitude: data.latitude, longitude: data.longitude });
          } catch {
            setFailed(true);
          }
        }}
      />
      <Pressable
        style={[s.gps, locating && { opacity: 0.65 }]}
        accessibilityRole="button"
        accessibilityLabel={
          onPick ? 'Usar mi ubicación para este avistamiento' : 'Centrar mapa en mi ubicación'
        }
        accessibilityState={{ disabled: locating, busy: locating }}
        disabled={locating}
        onPress={() => void locate()}
      >
        <Text style={s.gpsText}>{locating ? 'Buscando GPS…' : '◎ Mi ubicación'}</Text>
      </Pressable>
      {failed && (
        <View style={s.notice}>
          <Text>No pudimos cargar el mapa. Comprueba la conexión.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFailed(false);
              setLoaded(false);
              setReady(false);
              setAttempt((n) => n + 1);
            }}
          >
            <Text style={s.retry}>Reintentar mapa</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  gps: {
    position: 'absolute',
    right: 12,
    bottom: 30,
    backgroundColor: '#245C50',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 24,
    elevation: 4,
  },
  gpsText: { color: '#fff', fontWeight: '700' },
  notice: {
    position: 'absolute',
    top: 12,
    left: 50,
    right: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  retry: { color: '#245C50', fontWeight: '700', paddingTop: 8 },
});
