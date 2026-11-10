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
import { zonesSchema, type Zone, type Bounds, type Observation } from '@bioatlas/contracts';
import { apiRequest, getObservations } from '../../api';
import MediaGallery from '../media/MediaGallery';
import ZoneInformation, { zoneSections, type ZoneSection } from './ZoneInformation';
import BiotopeMap from './BiotopeMap';

export default function ExplorerScreen() {
  const [biotopeMap, setBiotopeMap] = useState(false);
  const [guideSection, setGuideSection] = useState<ZoneSection | undefined>();
  const [region, setRegion] = useState<Bounds>(initialBounds),
    [text, setText] = useState(''),
    [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Observation | null>(null),
    [mode, setMode] = useState<'map' | 'list' | 'zones'>('map');
  const [zone, setZone] = useState<Zone | null>(null),
    [zoneDetails, setZoneDetails] = useState(false);
  const [focusBounds, setFocusBounds] = useState<Bounds | undefined>();
  const [overview, setOverview] = useState(initialBounds);
  const zones = useQuery({
    queryKey: ['zones'],
    queryFn: async () => zonesSchema.parse(await apiRequest('/v1/zones')),
    staleTime: 60000,
  });
  function exploreZone(id: string) {
    const next = zones.data?.items.find((z) => z.id === id);
    if (!next) return;
    if (!zone) setOverview(region);
    setZone(next);
    setGuideSection(undefined);
    setZoneDetails(true);
    setRegion(next.bounds);
    setBounds(next.bounds);
    setFocusBounds(next.bounds);
    setMode('map');
  }
  const [bounds, setBounds] = useState(initialBounds);
  useEffect(() => {
    const timer = setTimeout(() => {
      setBounds(region);
      setQuery(text.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [region, text]);
  const result = useQuery({
    queryKey: ['observations', bounds, query, zone?.id],
    queryFn: ({ signal }) => getObservations(bounds, query, signal, zone?.id),
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
          {(['map', 'list', 'zones'] as const).map((value) => (
            <Pressable
              key={value}
              style={[s.tab, mode === value && s.activeTab]}
              onPress={() => setMode(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === value }}
            >
              <Text style={[s.tabText, mode === value && s.activeText]}>
                {value === 'map' ? 'Mapa' : value === 'list' ? 'Lista' : 'Zonas'}
              </Text>
            </Pressable>
          ))}
        </View>
        {zone && (
          <View style={{ gap: 6 }}>
            <Text
              style={[
                s.cardTitle,
                { borderLeftWidth: 6, borderLeftColor: zone.color, paddingLeft: 8 },
              ]}
            >
              {zone.name}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(zoneSections) as ZoneSection[]).map((kind) => {
                const section = zoneSections[kind];
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="button"
                    accessibilityLabel={`${section.title} de ${zone.name}`}
                    onPress={() => {
                      setGuideSection(kind);
                      setZoneDetails(true);
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: section.color,
                      borderRadius: 10,
                      padding: 12,
                      minHeight: 48,
                      width: '48%',
                      justifyContent: 'center',
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      {section.symbol} {section.title} +
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setZone(null);
                  setRegion(overview);
                  setBounds(overview);
                  setFocusBounds(overview);
                }}
              >
                <Text style={{ color: '#245C50', fontWeight: '700', paddingVertical: 8 }}>
                  ← Volver al mapa general
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <View style={s.content}>
        {mode === 'map' ? (
          <Map
            items={items}
            bounds={region}
            onBounds={setRegion}
            onSelect={(id) => setSelected(items.find((item) => item.id === id) ?? null)}
            zones={zones.data?.items}
            selectedZoneId={zone?.id}
            onExploreZone={exploreZone}
            focusBounds={focusBounds}
          />
        ) : mode === 'zones' ? (
          <ScrollView contentContainerStyle={s.list}>
            <Text style={s.noticeTitle}>Explora las zonas de Valdivia</Text>
            <Text style={s.meta}>
              Los colores identifican macrozonas. Las áreas de referencia de iNaturalist requieren
              validación para clasificarlas como biotopos.
            </Text>
            {zones.isPending ? (
              <ActivityIndicator />
            ) : zones.isError ? (
              <Pressable accessibilityRole="button" onPress={() => void zones.refetch()}>
                <Text>No pudimos cargar las zonas. Toca para reintentar.</Text>
              </Pressable>
            ) : !zones.data.items.length ? (
              <Text>No hay zonas cargadas todavía.</Text>
            ) : (
              zones.data.items.map((item) => (
                <View
                  key={item.id}
                  style={[s.card, { borderLeftWidth: 7, borderLeftColor: item.color }]}
                >
                  <Text style={s.cardTitle}>{item.name}</Text>
                  <Text style={s.meta}>
                    {item.kind === 'macrozone'
                      ? 'Macrozona'
                      : item.kind === 'biotope'
                        ? 'Biotopo'
                        : 'Área de referencia'}{' '}
                    · {item.observationCount} registros
                  </Text>
                  <Pressable
                    style={s.button}
                    accessibilityRole="button"
                    onPress={() => exploreZone(item.id)}
                  >
                    <Text style={s.buttonText}>Ver cultura, árboles y flora →</Text>
                  </Pressable>
                </View>
              ))
            )}
            {zones.data?.hasMore && <Text>Se muestran las primeras 200 zonas.</Text>}
          </ScrollView>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={row}
            contentContainerStyle={s.list}
          />
        )}
        {mode !== 'zones' && (result.isPending || result.isError || items.length === 0) && (
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
        visible={zoneDetails && zone !== null}
        animationType="slide"
        onRequestClose={() => setZoneDetails(false)}
      >
        <SafeAreaView style={s.page}>
          <ScrollView contentContainerStyle={s.detail}>
            <Pressable accessibilityRole="button" onPress={() => setZoneDetails(false)}>
              <Text style={s.close}>Cerrar ✕</Text>
            </Pressable>
            <Text style={s.detailTitle}>{zone?.name}</Text>
            <Pressable
              accessibilityRole="button"
              style={[s.button, { backgroundColor: '#235E87' }]}
              onPress={() => {
                setZoneDetails(false);
                setBiotopeMap(true);
              }}
            >
              <Text style={s.buttonText}>🗺 Explorar biotopos · Mapa de detalle</Text>
            </Pressable>
            {zone && (
              <ZoneInformation
                key={zone.id + guideSection}
                zone={zone}
                initialSection={guideSection}
              />
            )}
            <Text style={s.value}>{zone?.description}</Text>
            <Pressable
              accessibilityRole="button"
              style={s.button}
              onPress={() => setZoneDetails(false)}
            >
              <Text style={s.buttonText}>Explorar esta zona en el mapa</Text>
            </Pressable>
            <Text style={s.meta}>Fuente: {zone?.source}</Text>
            {zone?.sourceUrl?.startsWith('https://') && (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(zone.sourceUrl!).catch(() => {})}
              >
                <Text style={s.close}>Consultar fuente de los límites ↗</Text>
              </Pressable>
            )}
            {zone && <MediaGallery zoneId={zone.id} />}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={biotopeMap && zone !== null}
        animationType="slide"
        onRequestClose={() => {
          setBiotopeMap(false);
          setZoneDetails(true);
        }}
      >
        {zone && (
          <BiotopeMap
            zone={zone}
            onClose={() => {
              setBiotopeMap(false);
              setZoneDetails(true);
            }}
          />
        )}
      </Modal>
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
            {selected?.reportId && <MediaGallery reportId={selected.reportId} />}
            {selected &&
              [
                ['Fecha', selected.eventDate ?? 'No disponible'],
                ['Fuente', selected.source],
                ['Observador', selected.observerName ?? 'No disponible'],
                ...(selected.qualityGrade
                  ? [
                      [
                        'Revisión en la fuente',
                        selected.qualityGrade === 'research'
                          ? 'Grado de investigación en iNaturalist'
                          : selected.qualityGrade,
                      ],
                    ]
                  : []),
                ...(selected.accuracyM != null
                  ? [['Precisión indicada', `${selected.accuracyM} metros`]]
                  : []),
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
