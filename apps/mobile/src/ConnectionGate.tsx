import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { apiBase } from './api';

export default function ConnectionGate({ children }: React.PropsWithChildren) {
  const [ready, setReady] = useState(false),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(''),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setError('');
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    void (async () => {
      if (!apiBase()) {
        setError('Falta configurar la conexión de esta versión.');
        clearInterval(timer);
        return;
      }
      const deadline = Date.now() + 90000;
      while (!cancelled && Date.now() < deadline) {
        const attemptController = new AbortController();
        const cancelAttempt = () => attemptController.abort();
        controller.signal.addEventListener('abort', cancelAttempt);
        const timeout = setTimeout(cancelAttempt, 10000);
        try {
          const response = await fetch(apiBase() + '/health', { signal: attemptController.signal });
          if (response.ok && (await response.json()).status === 'ok') {
            if (!cancelled) setReady(true);
            clearInterval(timer);
            return;
          }
        } catch {
          /* A free server may still be starting. */
        } finally {
          clearTimeout(timeout);
          controller.signal.removeEventListener('abort', cancelAttempt);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled)
        setError('No pudimos conectar. Comprueba tu internet e inténtalo nuevamente.');
      clearInterval(timer);
    })();
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [attempt]);
  if (ready) return <>{children}</>;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 28,
        gap: 18,
        backgroundColor: '#F5F5EE',
      }}
    >
      <Text style={{ fontSize: 32, fontWeight: '800', color: '#173C32' }}>BioAtlas</Text>
      {!error && <ActivityIndicator size="large" color="#245C50" />}
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 17, color: '#203B30' }}>
        {error ||
          (seconds < 10
            ? 'Conectando con BioAtlas…'
            : 'El servidor está iniciando. La primera conexión puede tardar alrededor de un minuto.')}
      </Text>
      {!!error && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAttempt((n) => n + 1)}
          style={{ padding: 16, borderRadius: 12, backgroundColor: '#245C50' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
            Reintentar conexión
          </Text>
        </Pressable>
      )}
    </View>
  );
}
