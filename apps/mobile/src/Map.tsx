import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { boundsSchema, type Bounds, type Observation } from '@bioatlas/contracts';
import { apiBase } from './api';
import { colors } from './ui/theme';

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
}: {
  items?: Observation[];
  bounds?: Bounds;
  onBounds?: (b: Bounds) => void;
  onSelect?: (id: string) => void;
  onPick?: (p: Point) => void;
  point?: Point;
}) {
  const ref = useRef<WebView>(null);
  const startBounds = useRef(bounds);
  const [ready, setReady] = useState(false),
    [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inject = (fn: string, value: unknown) =>
    ref.current?.injectJavaScript(
      `window.${fn}(${JSON.stringify(value).replace(/</g, '\\u003c')});true;`,
    );
  useEffect(() => {
    if (ready) inject('setRecords', items);
  }, [ready, items]);
  useEffect(() => {
    if (ready && point) inject('setPick', point);
  }, [ready, point]);
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
      {failed && (
        <View style={s.notice}>
          <Text style={{ color: colors.ink, lineHeight: 20 }}>
            No pudimos cargar el mapa. Comprueba la conexión.
          </Text>
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
  notice: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    padding: 12,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  retry: { color: colors.green, fontWeight: '700', paddingVertical: 12 },
});
