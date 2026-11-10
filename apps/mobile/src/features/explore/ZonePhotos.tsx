import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { zonePhotosSchema, type ZonePhoto } from '@bioatlas/contracts';
import { apiBase, apiRequest } from '../../api';
function Photo({ item, large = false }: { item: ZonePhoto; large?: boolean }) {
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  return (
    <View
      style={{
        height: large ? 380 : 190,
        backgroundColor: '#E6ECE2',
        justifyContent: 'center',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {failed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
          style={{ padding: 16 }}
        >
          <Text>No pudimos cargar esta foto. Toca para reintentar.</Text>
        </Pressable>
      ) : (
        <Image
          key={attempt}
          accessibilityLabel={`Fotografía de ${item.commonName ?? item.scientificName}`}
          source={{
            uri: `${apiBase()}/v1/observation-photos/${item.observationId}/${item.photoId}?retry=${attempt}`,
          }}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
function Credits({ item }: { item: ZonePhoto }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, color: '#53665A' }}>{item.attribution}</Text>
      <Text style={{ fontSize: 12, color: '#53665A' }}>
        Licencia: {item.license.toUpperCase()}
        {item.license.includes('-nc') ? ' · Uso no comercial' : ''}
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          void Linking.openURL(`https://www.inaturalist.org/photos/${item.photoId}`).catch(() => {})
        }
      >
        <Text style={{ color: '#245C50', paddingVertical: 6 }}>Créditos y foto original ↗</Text>
      </Pressable>
    </View>
  );
}
export default function ZonePhotos({ zoneId }: { zoneId: string }) {
  const [group, setGroup] = useState('all'),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<ZonePhoto | null>(null);
  const query = useQuery({
    queryKey: ['zone-photos', zoneId, group, offset],
    queryFn: async () =>
      zonePhotosSchema.parse(
        await apiRequest(`/v1/zones/${zoneId}/photos?group=${group}&offset=${offset}`),
      ),
    staleTime: 60000,
  });
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#173C32' }}>
        Fotos de avistamientos en esta zona
      </Text>
      <Text>
        Fotografías de organismos registrados dentro del área seleccionada. Toca una foto para
        ampliarla.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          ['all', 'Todas'],
          ['plants', 'Plantas'],
          ['animals', 'Animales'],
          ['fungi', 'Hongos'],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: group === value }}
            onPress={() => {
              setGroup(value);
              setOffset(0);
            }}
            style={{
              padding: 12,
              borderRadius: 9,
              backgroundColor: group === value ? '#245C50' : '#E6ECE2',
            }}
          >
            <Text style={{ color: group === value ? '#fff' : '#203B30', fontWeight: '600' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {query.isPending ? (
        <ActivityIndicator />
      ) : query.isError ? (
        <Pressable accessibilityRole="button" onPress={() => void query.refetch()}>
          <Text>No pudimos cargar la galería. Toca para reintentar.</Text>
        </Pressable>
      ) : (
        <>
          {!query.data.items.length && (
            <Text>Aún no hay fotos con licencia disponible para este filtro en esta zona.</Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ gap: 12, paddingBottom: 10 }}
          >
            {query.data.items.map((item) => (
              <View
                key={item.observationId + '-' + item.photoId}
                style={{
                  width: 260,
                  padding: 12,
                  gap: 8,
                  backgroundColor: '#fff',
                  borderRadius: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ampliar foto de ${item.commonName ?? item.scientificName}`}
                  onPress={() => setSelected(item)}
                >
                  <Photo item={item} />
                </Pressable>
                <Text style={{ fontWeight: '700' }}>{item.commonName ?? item.scientificName}</Text>
                <Text style={{ fontStyle: 'italic' }}>{item.scientificName}</Text>
                <Text>{item.eventDate ?? 'Fecha no disponible'} · iNaturalist</Text>
                <Credits item={item} />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {offset > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setOffset((o) => Math.max(0, o - 12))}
              >
                <Text style={{ padding: 12, color: '#245C50' }}>← Anteriores</Text>
              </Pressable>
            )}
            {query.data.hasMore && (
              <Pressable accessibilityRole="button" onPress={() => setOffset((o) => o + 12)}>
                <Text style={{ padding: 12, color: '#245C50' }}>Más fotos →</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
      <Modal
        visible={selected !== null}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5EE' }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)}>
              <Text style={{ paddingVertical: 12, color: '#245C50', fontWeight: '700' }}>
                ← Volver a la zona
              </Text>
            </Pressable>
            {selected && (
              <>
                <Text style={{ fontSize: 24, fontWeight: '700' }}>
                  {selected.commonName ?? selected.scientificName}
                </Text>
                <Photo item={selected} large />
                <Text style={{ fontStyle: 'italic' }}>{selected.scientificName}</Text>
                <Credits item={selected} />
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(selected.sourceUrl).catch(() => {})}
                >
                  <Text style={{ padding: 12, color: '#245C50' }}>Ver avistamiento original ↗</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
