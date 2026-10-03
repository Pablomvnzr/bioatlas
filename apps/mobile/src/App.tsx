import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import ExplorerScreen from './features/explore/ExplorerScreen';
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <ExplorerScreen />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
