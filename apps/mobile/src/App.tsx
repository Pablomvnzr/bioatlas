import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import ExplorerScreen from './features/explore/ExplorerScreen';
import CommunityScreen from './features/community/CommunityScreen';
import { SessionProvider } from './Session';
import Icon from './ui/Icon';
import { colors } from './ui/theme';

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });
const tabs = [
  { id: 'map', label: 'Mapa', icon: 'map' },
  { id: 'list', label: 'Explorar', icon: 'atlas' },
  { id: 'community', label: 'Mi Atlas', icon: 'community' },
] as const;
function Shell() {
  const [tab, setTab] = useState<'map' | 'list' | 'community'>('map');
  const insets = useSafeAreaInsets();
  return (
    <View style={s.page}>
      <View style={s.body}>
        {tab === 'community' ? <CommunityScreen /> : <ExplorerScreen mode={tab} />}
      </View>
      <View
        style={[
          s.navigation,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            paddingLeft: insets.left + 12,
            paddingRight: insets.right + 12,
          },
        ]}
      >
        {tabs.map(({ id, label, icon }) => (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab === id }}
            onPress={() => setTab(id)}
            style={({ pressed }) => [s.tab, pressed && { opacity: 0.6 }]}
          >
            <View style={[s.icon, tab === id && s.selected]}>
              <Icon name={icon} color={tab === id ? colors.green : colors.muted} />
            </View>
            <Text style={[s.label, tab === id && s.activeLabel]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <SessionProvider>
          <Shell />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  navigation: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 58 },
  icon: { paddingHorizontal: 18, paddingVertical: 4, borderRadius: 20 },
  selected: { backgroundColor: colors.sage },
  label: { fontSize: 12, color: colors.muted },
  activeLabel: { color: colors.green, fontWeight: '700' },
});
