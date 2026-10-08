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
  useWindowDimensions,
} from 'react-native';
import Map, { initialBounds } from '../../Map';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { Bounds, Observation } from '@bioatlas/contracts';
import { getObservations } from '../../api';
import Icon from '../../ui/Icon';
import { colors, serif } from '../../ui/theme';

export default function ExplorerScreen({ mode }: { mode: 'map' | 'list' }) {
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 360 || fontScale > 1.3 ? 1 : width >= 700 ? 3 : 2;
  const [region, setRegion] = useState<Bounds>(initialBounds),
    [text, setText] = useState(''),
    [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Observation | null>(null);
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
      style={({ pressed }) => [
        s.card,
        { maxWidth: `${100 / columns}%` },
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => setSelected(item)}
      accessibilityRole="button"
      accessibilityLabel={`Ver ${item.commonName ?? item.scientificName}`}
    >
      <View style={s.cardTop}>
        <Icon name="atlas" />
        <Text style={s.recordLabel}>REGISTRO</Text>
      </View>
      <Text style={s.cardTitle}>{item.commonName ?? item.scientificName}</Text>
      <Text style={s.scientific}>{item.scientificName}</Text>
      <View style={s.cardBottom}>
        <Text style={s.sourceBadge}>{item.source}</Text>
        <Text style={s.arrow}>↗</Text>
      </View>
    </Pressable>
  );
  return (
    <SafeAreaView style={s.page} edges={['top', 'left', 'right']}>
      {mode === 'list' && (
        <View style={s.header}>
          <Text style={s.eyebrow}>BIOATLAS · VALDIVIA</Text>
          <Text style={s.title}>Atlas de especies</Text>
          <Text style={s.subtitle}>Descubre la biodiversidad de nuestros humedales.</Text>
        </View>
      )}
      <View style={s.content}>
        <View style={[s.toolbar, mode === 'map' && s.mapToolbar]}>
          <View style={s.searchBox}>
            <Icon name="search" color={colors.muted} />
            <TextInput
              style={s.search}
              value={text}
              maxLength={100}
              onChangeText={setText}
              placeholder="Buscar una especie…"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Buscar por nombre de especie"
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!text && (
              <Pressable
                onPress={() => setText('')}
                accessibilityRole="button"
                accessibilityLabel="Limpiar búsqueda"
                style={s.clear}
              >
                <Text style={s.arrow}>×</Text>
              </Pressable>
            )}
          </View>
          {mode === 'map' && (
            <View style={s.locationPill}>
              <Text style={[s.locationText, { color: colors.paper }]}>Humedales de Valdivia</Text>
            </View>
          )}
        </View>
        {mode === 'map' ? (
          <Map
            items={items}
            bounds={region}
            onBounds={setRegion}
            onSelect={(id) => setSelected(items.find((item) => item.id === id) ?? null)}
          />
        ) : (
          <FlatList
            key={columns}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? s.columns : undefined}
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
                <ActivityIndicator color={colors.green} />
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
      <View style={[s.footer, mode === 'map' && s.mapFooter]}>
        {mode === 'map' && <View style={s.handle} />}
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
            <Pressable
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              style={s.backButton}
            >
              <Text style={s.close}>‹ Volver al atlas</Text>
            </Pressable>
            <View style={s.detailBanner}>
              <Icon name="atlas" />
              <Text style={s.locationText}>Humedales de Valdivia</Text>
            </View>
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
  page: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20, gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: colors.muted },
  title: {
    fontFamily: serif,
    fontSize: 34,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.8,
  },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  toolbar: { paddingHorizontal: 20, paddingBottom: 18, gap: 12 },
  mapToolbar: { position: 'absolute', top: 18, left: 40, right: 40, zIndex: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 30,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 54,
    boxShadow: '0 3px 12px rgba(53,41,31,0.06)',
  },
  search: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.ink,
  },
  clear: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  locationPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  locationText: { color: colors.green, fontSize: 12, fontWeight: '600' },
  content: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  columns: { gap: 14 },
  card: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 12px rgba(53,41,31,0.05)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  recordLabel: { fontSize: 8, letterSpacing: 1.2, color: colors.muted },
  cardTitle: { fontFamily: serif, fontSize: 21, fontWeight: '700', color: colors.ink },
  scientific: { fontFamily: serif, fontSize: 16, fontStyle: 'italic', color: colors.muted },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 'auto',
    paddingTop: 14,
  },
  sourceBadge: {
    flexShrink: 1,
    overflow: 'hidden',
    backgroundColor: colors.sage,
    color: colors.green,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    fontSize: 10,
    fontWeight: '700',
  },
  arrow: { fontSize: 22, color: colors.green },
  meta: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  notice: {
    margin: 20,
    padding: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    gap: 10,
  },
  mapNotice: { position: 'absolute', bottom: 20, left: 0, right: 0 },
  noticeTitle: { fontFamily: serif, fontWeight: '700', fontSize: 20, color: colors.ink },
  button: {
    backgroundColor: colors.green,
    borderRadius: 30,
    padding: 17,
    minHeight: 52,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.paper, fontWeight: '700', fontSize: 15 },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 5,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  mapFooter: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12 },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  footerTitle: { fontSize: 14, fontWeight: '700', color: colors.green },
  detail: { padding: 24, gap: 14 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  close: { color: colors.muted, fontWeight: '600', fontSize: 15 },
  detailBanner: {
    backgroundColor: colors.sage,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  detailTitle: { fontFamily: serif, fontSize: 34, fontWeight: '700', color: colors.ink },
  field: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    gap: 6,
  },
  label: { fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { fontSize: 16, color: colors.ink },
  detailNote: { marginTop: 8, fontSize: 12, lineHeight: 19, color: colors.muted },
});
