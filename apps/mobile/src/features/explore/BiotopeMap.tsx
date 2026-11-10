import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  biotopeDetailSchema,
  zoneReviewSchema,
  type Zone,
  type ZoneReview,
} from '@bioatlas/contracts';
import Map from '../../Map';
import { apiRequest, getObservations } from '../../api';
import { useSession } from '../../Session';

const labels = {
  proposed: 'Propuesta',
  in_review: 'En revisión',
  validated: 'Validado por el equipo',
};
function Button({
  title,
  onPress,
  color = '#245C50',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={s.white}>{title}</Text>
    </Pressable>
  );
}
function Review({
  zone,
  review,
  onSaved,
}: {
  zone: Zone;
  review: ZoneReview;
  onSaved: () => Promise<unknown>;
}) {
  const { session } = useSession(),
    admin = session?.user.role === 'admin';
  const [draft, setDraft] = useState(review),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState('');
  async function save(status: ZoneReview['status']) {
    if (!session) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = zoneReviewSchema.parse(
        await apiRequest(`/v1/zones/${zone.id}/review`, session.token, 'PATCH', {
          ...draft,
          status,
        }),
      );
      setDraft(saved);
      await onSaved();
      setMessage('Ficha guardada.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No pudimos guardar.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={s.panel}>
      <Text style={s.title}>Validación: {labels[draft.status]}</Text>
      <Text>
        Esta revisión corresponde al equipo del proyecto; no es una certificación oficial. Los
        registros de especies no delimitan por sí solos un biotopo.
      </Text>
      {zone.kind !== 'biotope' && (
        <Text>
          Este contorno es un área de referencia. Primero hay que delimitar y documentar los
          biotopos interiores.
        </Text>
      )}
      {(
        [
          ['habitat', 'Hábitat identificado'],
          ['evidenceUrl', 'Enlace HTTPS a la evidencia'],
          ['reviewer', 'Persona revisora y especialidad'],
          [
            'notes',
            'Observaciones, fecha de visita y método de delimitación (mínimo 10 caracteres)',
          ],
        ] as const
      ).map(([key, label]) => (
        <View key={key}>
          <Text style={s.label}>{label}</Text>
          <TextInput
            accessibilityLabel={label}
            editable={admin && !saving}
            style={s.input}
            value={draft[key]}
            multiline={key === 'notes'}
            autoCapitalize={key === 'evidenceUrl' ? 'none' : 'sentences'}
            onChangeText={(value) => setDraft({ ...draft, [key]: value })}
          />
        </View>
      ))}
      {draft.evidenceUrl.startsWith('https://') && (
        <Button
          title="Consultar evidencia ↗"
          onPress={() =>
            void Linking.openURL(draft.evidenceUrl).catch(() =>
              setMessage('No se pudo abrir el enlace.'),
            )
          }
        />
      )}
      {(
        [
          ['boundaryChecked', 'Límites contrastados con una fuente identificable'],
          ['habitatChecked', 'Hábitat revisado por una persona con conocimiento del sector'],
          ['fieldChecked', 'Comprobación en terreno documentada'],
        ] as const
      ).map(([key, label]) => (
        <View key={key} style={s.check}>
          <Text style={{ flex: 1 }}>{label}</Text>
          <Switch
            accessibilityLabel={label}
            disabled={!admin || saving}
            value={draft[key]}
            onValueChange={(value) => setDraft({ ...draft, [key]: value })}
          />
        </View>
      ))}
      {admin ? (
        <>
          <Button
            disabled={saving}
            title="Guardar propuesta"
            color="#775B00"
            onPress={() => void save('proposed')}
          />
          <Button
            disabled={saving}
            title="Enviar a revisión"
            color="#235E87"
            onPress={() => void save('in_review')}
          />
          {zone.kind === 'biotope' && draft.status === 'in_review' && (
            <Button
              disabled={saving}
              title="Confirmar validación"
              onPress={() => void save('validated')}
            />
          )}
        </>
      ) : (
        <Text>Un administrador puede registrar la revisión y sus evidencias.</Text>
      )}
      {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    </View>
  );
}
export default function BiotopeMap({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const [selected, setSelected] = useState(zone),
    [showReview, setShowReview] = useState(false),
    [record, setRecord] = useState<string | null>(null);
  const root = useQuery({
    queryKey: ['biotopes', zone.id],
    queryFn: async () =>
      biotopeDetailSchema.parse(await apiRequest(`/v1/zones/${zone.id}/biotopes`)),
  });
  const detail = useQuery({
    queryKey: ['biotopes', selected.id],
    queryFn: async () =>
      biotopeDetailSchema.parse(await apiRequest(`/v1/zones/${selected.id}/biotopes`)),
  });
  const observations = useQuery({
    queryKey: ['biotope-observations', selected.id],
    queryFn: ({ signal }) => getObservations(selected.bounds, '', signal, selected.id),
  });
  const items = observations.data?.items ?? [],
    chosen = items.find((item) => item.id === record);
  const children = root.data?.children ?? [];
  return (
    <SafeAreaView style={s.page}>
      <View style={s.panel}>
        <Button title="← Volver a la ficha de la zona" onPress={onClose} />
        <Text style={s.title}>{zone.name}</Text>
        <Text>Mapa de detalle · {selected.name}</Text>
      </View>
      {showReview ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <Button title="← Volver al mapa de detalle" onPress={() => setShowReview(false)} />
          {detail.data && (
            <Review
              key={selected.id}
              zone={selected}
              review={detail.data.review}
              onSaved={() => detail.refetch()}
            />
          )}
        </ScrollView>
      ) : (
        <>
          <View style={{ flex: 1, minHeight: 220 }}>
            <Map
              items={items}
              bounds={zone.bounds}
              focusBounds={selected.bounds}
              zones={[zone, ...children]}
              selectedZoneId={selected.id}
              onSelect={setRecord}
              onExploreZone={(id) => {
                const next = [zone, ...children].find((z) => z.id === id);
                if (next) {
                  setSelected(next);
                  setRecord(null);
                }
              }}
            />
          </View>
          <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={s.panel}>
            {(root.isPending || detail.isPending || observations.isPending) && (
              <ActivityIndicator />
            )}
            {(root.isError || detail.isError || observations.isError) && (
              <Button
                title="No se pudieron cargar todos los datos. Reintentar"
                onPress={() => {
                  void root.refetch();
                  void detail.refetch();
                  void observations.refetch();
                }}
              />
            )}
            {root.isSuccess && !children.length && (
              <Text>
                Aún no hay biotopos interiores delimitados. El contorno mostrado es el área de
                referencia; no representa una validación ecológica.
              </Text>
            )}
            {children.length > 0 && (
              <>
                <Text style={s.label}>Selecciona un sector para acercar el mapa</Text>
                <Button title="Ver toda la zona" onPress={() => setSelected(zone)} />
                {children.map((child) => (
                  <Button
                    key={child.id}
                    title={child.name}
                    color={child.color}
                    onPress={() => {
                      setSelected(child);
                      setRecord(null);
                    }}
                  />
                ))}
              </>
            )}
            {detail.data && (
              <Button
                title={`Ficha de validación · ${labels[detail.data.review.status]}`}
                color="#235E87"
                onPress={() => setShowReview(true)}
              />
            )}
            <Text>
              {items.length} avistamientos mostrados
              {observations.data?.hasMore ? ' · Hay más registros en la zona.' : ''}
            </Text>
            {chosen && (
              <View>
                <Text style={s.label}>{chosen.commonName ?? chosen.scientificName}</Text>
                <Text>
                  {chosen.scientificName} · {chosen.source}
                </Text>
                {chosen.sourceUrl?.startsWith('https://') && (
                  <Button
                    title="Ver registro original ↗"
                    onPress={() => void Linking.openURL(chosen.sourceUrl!).catch(() => {})}
                  />
                )}
              </View>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F5EE' },
  panel: { padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#173C32' },
  label: { fontWeight: '700', marginBottom: 6 },
  button: { padding: 13, borderRadius: 10, minHeight: 46 },
  white: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#AAB9AF',
    borderRadius: 8,
    padding: 10,
    color: '#203B30',
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
