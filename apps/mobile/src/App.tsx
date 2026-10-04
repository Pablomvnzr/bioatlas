import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import ExplorerScreen from './features/explore/ExplorerScreen';
import CommunityScreen from './features/community/CommunityScreen';
import { SessionProvider } from './Session';
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });
export default function App() {
  const [tab, setTab] = useState<'explore' | 'community'>('explore');
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <SessionProvider>
          <View style={{ flex: 1 }}>
            {tab === 'explore' ? <ExplorerScreen /> : <CommunityScreen />}
          </View>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#fff',
              padding: 12,
              gap: 12,
              paddingBottom: 24,
            }}
          >
            {(['explore', 'community'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === value }}
                onPress={() => setTab(value)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: tab === value ? '#245C50' : '#E6ECE2',
                }}
              >
                <Text style={{ fontWeight: '700', color: tab === value ? '#fff' : '#245C50' }}>
                  {value === 'explore' ? 'Explorar' : 'Comunidad'}
                </Text>
              </Pressable>
            ))}
          </View>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
