import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Map, { initialBounds } from '../../Map';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { Bounds, Observation } from '@bioatlas/contracts';
import { getObservations } from '../../api';

export default function ExplorerScreen() {
  const [region, setRegion] = useState<Bounds>(initialBounds),
    [text, setText] = useState(''),
    [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Observation | null>(null),
    [mode, setMode] = useState<'map' | 'list'>('map');
  const [bounds, setBounds] = useState(initialBounds);
  useEffect(() => {
    const timer = setTimeout(() => {
      setBounds(region);
      setQuery(text.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [region, text]);
  const result = useQuery({
    queryKey: ['observations', bounds, query],
    queryFn: ({ signal }) => getObservations(bounds, query, signal),
  });
  const items = result.data?.items ?? [];
  const row = ({ item }: { item: Observation }) => (
    <Pressable
      style={s.card}
      onPress={() => setSelected(item)}
      accessibilityRole="button"
      accessibilityLabel={`Ver ${item.commonName ?? item.scientificName}`}
    >
      <Text style={s.cardTitle}>{item.commonName ?? item.scientificName}</Text>
      <Text style={s.scientific}>{item.scientificName}</Text>
      <Text style={s.meta}>{item.source} · Ver registro →</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={s.page}>
      <View style={s.header}>
        <Text style={s.eyebrow}>HUMEDALES DE VALDIVIA</Text>
        <Text style={s.title}>
          BioAtlas<Text style={s.dot}>.</Text>
        </Text>
        <Text style={s.subtitle}>Conoce la vida que te rodea.</Text>
      </View>
      <View style={s.toolbar}>
        <TextInput
          style={s.search}
          value={text}
          maxLength={100}
          onChangeText={setText}
          placeholder="Buscar una especie…"
          accessibilityLabel="Buscar por nombre de especie"
          autoCorrect={false}
          returnKeyType="search"
        />
        <View style={s.tabs}>
          {(['map', 'list'] as const).map((value) => (
            <Pressable
              key={value}
              style={[s.tab, mode === value && s.activeTab]}
              onPress={() => setMode(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === value }}
            >
              <Text style={[s.tabText, mode === value && s.activeText]}>
                {value === 'map' ? 'Mapa' : 'Lista'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.content}>
        {mode === 'map' ? (
          <Map
            items={items}
            bounds={region}
            onBounds={setRegion}
            onSelect={(id) => setSelected(items.find((item) => item.id === id) ?? null)}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={row}
            contentContainerStyle={s.list}
          />
        )}
        {(result.isPending || result.isError || items.length === 0) && (
          <View style={[s.notice, mode === 'map' && s.mapNotice]}>
            {result.isPending ? (
              <>
                <ActivityIndicator color="#245C50" />
                <Text style={s.noticeTitle}>Explorando la zona…</Text>
              </>
            ) : result.isError ? (
              <>
                <Text style={s.noticeTitle}>No pudimos conectar</Text>
                <Text style={s.meta}>{result.error.message}</Text>
                <Pressable
                  onPress={() => void result.refetch()}
                  accessibilityRole="button"
                  style={s.button}
                >
                  <Text style={s.buttonText}>Reintentar</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.noticeTitle}>Sin registros en esta búsqueda</Text>
                <Text style={s.meta}>
                  Prueba otro nombre o explora una zona diferente del mapa.
                </Text>
              </>
            )}
          </View>
        )}
      </View>
      <View style={s.footer}>
        <Text style={s.footerTitle}>
          {items.length} registros en la zona
          {result.isFetching && !result.isPending ? ' · Actualizando…' : ''}
        </Text>
        <Text style={s.meta}>
          {result.data?.hasMore
            ? 'Hay más resultados. Acerca el mapa o filtra por nombre.'
            : 'Datos de biodiversidad · Cada registro conserva su fuente.'}
        </Text>
      </View>
      <Modal
        visible={selected !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={s.page}>
          <ScrollView contentContainerStyle={s.detail}>
            <Pressable onPress={() => setSelected(null)} accessibilityRole="button">
              <Text style={s.close}>Cerrar ✕</Text>
            </Pressable>
            <Text style={s.eyebrow}>REGISTRO DE BIODIVERSIDAD</Text>
            <Text style={s.detailTitle}>{selected?.commonName ?? selected?.scientificName}</Text>
            <Text style={s.scientific}>{selected?.scientificName}</Text>
            {selected &&
              [
                ['Fecha', selected.eventDate ?? 'No disponible'],
                ['Fuente', selected.source],
                ['Licencia', selected.license ?? 'No disponible'],
                [
                  'Coordenadas',
                  `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`,
                ],
              ].map(([label, value]) => (
                <View style={s.field} key={label}>
                  <Text style={s.label}>{label}</Text>
                  <Text style={s.value}>{value}</Text>
                </View>
              ))}
            {selected?.sourceUrl && /^https:\/\//.test(selected.sourceUrl) && (
              <Pressable
                style={s.button}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(selected.sourceUrl!).catch(() => {})}
              >
                <Text style={s.buttonText}>Consultar fuente original ↗</Text>
              </Pressable>
            )}
            <Text style={s.detailNote}>
              Un registro de presencia no determina por sí solo si una especie es nativa.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F5EE' },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#557667', marginBottom: 6 },
  title: { fontSize: 38, fontWeight: '800', color: '#173C32', letterSpacing: -1.5 },
  dot: { color: '#B49240' },
  subtitle: { fontSize: 14, color: '#65736A', marginTop: 4 },
  toolbar: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  search: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DEE5DA',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#203B30',
  },
  tabs: { flexDirection: 'row', backgroundColor: '#E6ECE2', borderRadius: 10, padding: 4 },
  tab: { flex: 1, padding: 9, borderRadius: 7, alignItems: 'center' },
  activeTab: { backgroundColor: '#245C50' },
  tabText: { color: '#4C6357', fontWeight: '600' },
  activeText: { color: '#FFF' },
  content: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#E3EBDD',
  },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 18, gap: 5 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#203B30' },
  scientific: { fontSize: 15, fontStyle: 'italic', color: '#65736A' },
  meta: { fontSize: 12, color: '#65736A', lineHeight: 18 },
  notice: { margin: 20, padding: 20, backgroundColor: '#FFFFFFF2', borderRadius: 16, gap: 10 },
  mapNotice: { position: 'absolute', top: 45, left: 0, right: 0 },
  noticeTitle: { fontWeight: '700', fontSize: 16, color: '#203B30' },
  button: {
    backgroundColor: '#245C50',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#FFF', fontWeight: '700' },
  footer: { padding: 18, gap: 4 },
  footerTitle: { fontSize: 14, fontWeight: '700', color: '#203B30' },
  detail: { padding: 24, gap: 12 },
  close: { textAlign: 'right', color: '#245C50', fontWeight: '700', paddingBottom: 24 },
  detailTitle: { fontSize: 29, fontWeight: '800', color: '#173C32' },
  field: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#DBE3D7', gap: 6 },
  label: { fontSize: 12, color: '#65736A' },
  value: { fontSize: 16, color: '#203B30' },
  detailNote: { marginTop: 16, fontSize: 12, lineHeight: 19, color: '#65736A' },
});
