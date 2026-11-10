import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { zoneDetailsSchema, type Zone } from '@bioatlas/contracts';
import { apiRequest } from '../../api';
import ZonePhotos from './ZonePhotos';
export const zoneSections = {
  photos: {
    title: 'Fotos de la zona',
    color: '#775B00',
    symbol: '📷',
    hint: 'Imágenes y créditos de iNaturalist',
  },
  culture: {
    title: 'Historia y cultura',
    color: '#93421F',
    symbol: '🏛️',
    hint: 'Historia, comunidad y patrimonio',
  },
  trees: {
    title: 'Árboles',
    color: '#24633E',
    symbol: '🌳',
    hint: 'Conoce los árboles del entorno',
  },
  flora: {
    title: 'Flora y hábitats',
    color: '#714184',
    symbol: '🌿',
    hint: 'Plantas y ambientes naturales',
  },
  observations: {
    title: 'Avistamientos',
    color: '#235E87',
    symbol: '📍',
    hint: 'Registros y organismos observados',
  },
};
export type ZoneSection = keyof typeof zoneSections;
function Accordion({
  title,
  kind,
  children,
  defaultOpen = false,
}: {
  title: string;
  kind: ZoneSection;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const appearance = zoneSections[kind];
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DEE5DA',
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={
          open ? 'Ocultar información de esta sección' : 'Mostrar información de esta sección'
        }
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => ({
          padding: 16,
          minHeight: 90,
          backgroundColor: appearance.color,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        })}
      >
        <Text accessible={false} style={{ fontSize: 26 }}>
          {appearance.symbol}
        </Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontWeight: '700', fontSize: 17, color: '#fff' }}>{title}</Text>
          <Text style={{ fontSize: 12, lineHeight: 17, color: '#fff' }}>
            {open ? 'Toca para cerrar' : appearance.hint}
          </Text>
        </View>
        <Text accessible={false} style={{ fontSize: 28, color: '#fff' }}>
          {open ? '−' : '+'}
        </Text>
      </Pressable>
      {open && <View style={{ padding: 16, gap: 12 }}>{children}</View>}
    </View>
  );
}
export default function ZoneInformation({
  zone,
  initialSection,
}: {
  zone: Zone;
  initialSection?: ZoneSection;
}) {
  const query = useQuery({
    queryKey: ['zone-details', zone.id],
    queryFn: async () => zoneDetailsSchema.parse(await apiRequest(`/v1/zones/${zone.id}/details`)),
    staleTime: 60000,
  });
  if (query.isPending) return <ActivityIndicator />;
  if (query.isError)
    return (
      <View>
        <Text>No pudimos cargar la informacion de esta zona.</Text>
        <Pressable accessibilityRole="button" onPress={() => void query.refetch()}>
          <Text style={{ padding: 12, color: '#245C50' }}>Reintentar</Text>
        </Pressable>
      </View>
    );
  const d = query.data;
  const photosSection = (
    <Accordion
      key={zone.id + 'photos' + initialSection}
      kind="photos"
      title="Fotos de avistamientos en la zona"
      defaultOpen={initialSection === 'photos'}
    >
      <ZonePhotos key={zone.id} zoneId={zone.id} />
    </Accordion>
  );
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#173C32' }}>Conoce esta zona</Text>
      <Text>Toca un botón de color para desplegar su información.</Text>
      {initialSection === 'photos' && photosSection}
      {d.guide?.sections
        .slice()
        .sort((a, b) => Number(b.id === initialSection) - Number(a.id === initialSection))
        .map((section) => (
          <Accordion
            key={zone.id + section.id + initialSection}
            kind={section.id}
            title={section.title}
            defaultOpen={initialSection === section.id}
          >
            <Text style={{ fontSize: 12, color: '#65736A' }}>
              {section.scope === 'sector'
                ? 'Información del lugar o sector'
                : 'Contexto general de Valdivia'}
            </Text>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>{section.heading}</Text>
            <Text style={{ lineHeight: 23, color: '#203B30' }}>{section.text}</Text>
            <Text style={{ fontWeight: '600' }}>Fuentes consultadas</Text>
            {section.sources.map((source) => (
              <Pressable
                key={source.url}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(source.url).catch(() => {})}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ color: '#245C50', textDecorationLine: 'underline' }}>
                  {source.title} ↗
                </Text>
              </Pressable>
            ))}
            <Text style={{ fontSize: 12, color: '#65736A' }}>
              Revisado el {d.guide?.reviewedAt}
            </Text>
          </Accordion>
        ))}
      <Accordion
        key={zone.id + 'observations' + initialSection}
        kind="observations"
        title="Avistamientos y biodiversidad"
        defaultOpen={initialSection === 'observations'}
      >
        <Text style={{ fontWeight: '700' }}>
          {zone.kind === 'macrozone'
            ? 'Macrozona'
            : zone.kind === 'reference_area'
              ? 'Área de referencia'
              : 'Biotopo'}
        </Text>
        {zone.kind !== 'biotope' && (
          <Text>
            Estos límites sirven para explorar el territorio; la delimitación de sus biotopos está
            pendiente de validación.
          </Text>
        )}
        <Text>Superficie aproximada: {d.areaKm2.toFixed(2)} km²</Text>
        <Text>
          {d.observationCount} registros cargados · {d.taxonCount} especies y otros grupos
          identificados
        </Text>
        {!!d.firstDate && (
          <Text>
            Fechas de avistamiento: {d.firstDate} a {d.lastDate}
          </Text>
        )}
        <Text style={{ fontWeight: '700' }}>De dónde vienen los registros</Text>
        {d.sources.length ? (
          d.sources.map((s) => (
            <Text key={s.source}>
              {s.source}: {s.count}
            </Text>
          ))
        ) : (
          <Text>Todavía no hay registros cargados dentro de esta zona.</Text>
        )}
        {!!d.taxa.length && (
          <>
            <Text style={{ fontWeight: '700' }}>Organismos con más registros en esta zona</Text>
            {d.taxa.map((t) => (
              <View key={t.scientificName}>
                <Text>
                  {t.commonName ?? t.scientificName} · {t.count} registros
                </Text>
                {!!t.commonName && (
                  <Text style={{ fontStyle: 'italic', color: '#65736A' }}>{t.scientificName}</Text>
                )}
              </View>
            ))}
          </>
        )}
        <Text style={{ fontSize: 12, color: '#65736A' }}>
          Resumen de los datos cargados en BioAtlas, no un inventario completo. Más registros no
          significa mayor abundancia. Puede haber coincidencias entre fuentes; estos datos no
          certifican que una especie sea nativa.
        </Text>
      </Accordion>
      {initialSection !== 'photos' && photosSection}
    </View>
  );
}
