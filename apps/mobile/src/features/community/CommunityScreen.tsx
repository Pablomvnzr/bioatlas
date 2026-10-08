import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportInputSchema, reportsSchema, sessionSchema, type Report } from '@bioatlas/contracts';
import { useSession } from '../../Session';
import { apiRequest } from '../../api';
import Map from '../../Map';
import { colors, serif } from '../../ui/theme';

function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.button, (disabled || pressed) && { opacity: 0.5 }]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  secure = false,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.green}
        accessibilityLabel={label}
        style={[s.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
        multiline={multiline}
        maxLength={multiline ? 2000 : 254}
      />
    </View>
  );
}
const statusLabels = {
  pending: 'Pendiente de revisión',
  approved: 'Aceptado para el catálogo',
  rejected: 'No aceptado',
};
export default function CommunityScreen() {
  const { session, loading, save } = useSession();
  const client = useQueryClient();
  const [register, setRegister] = useState(false),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [tab, setTab] = useState<'mine' | 'new' | 'admin'>('mine'),
    [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [species, setSpecies] = useState(''),
    [description, setDescription] = useState(''),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [latitude, setLatitude] = useState(''),
    [longitude, setLongitude] = useState('');
  const [reviewing, setReviewing] = useState<Report | null>(null),
    [note, setNote] = useState('');
  const reports = useQuery({
    queryKey: ['reports', session?.user.id, tab, offset],
    enabled: !!session && tab !== 'new',
    queryFn: async () =>
      reportsSchema.parse(
        await apiRequest(
          `${tab === 'admin' ? '/v1/admin/reports' : '/v1/reports/mine'}?offset=${offset}`,
          session?.token,
        ),
      ),
  });
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      if ((error as { status?: number }).status === 401 && session) await save(null);
      setMessage(error instanceof Error ? error.message : 'No pudimos completar la solicitud.');
    } finally {
      setBusy(false);
    }
  }
  async function authenticate() {
    await perform(async () => {
      const result = sessionSchema.parse(
        await apiRequest(`/v1/auth/${register ? 'register' : 'login'}`, undefined, 'POST', {
          email: email.trim().toLowerCase(),
          password,
          ...(register ? { name } : {}),
        }),
      );
      await save(result);
      setPassword('');
      setTab('mine');
      setOffset(0);
    });
  }
  async function submit() {
    await perform(async () => {
      if (!latitude.trim() || !longitude.trim())
        throw Error('Toca el mapa para elegir la ubicación o escribe las coordenadas.');
      const input = reportInputSchema.safeParse({
        scientificName: species,
        description,
        eventDate: date,
        latitude: Number(latitude.replace(',', '.')),
        longitude: Number(longitude.replace(',', '.')),
      });
      if (!input.success)
        throw Error(
          'Revisa los campos: descripción de al menos 10 caracteres, fecha válida sin futuro y coordenadas válidas.',
        );
      await apiRequest('/v1/reports', session!.token, 'POST', input.data);
      setSpecies('');
      setDescription('');
      setLatitude('');
      setLongitude('');
      setTab('mine');
      setOffset(0);
      await client.invalidateQueries({ queryKey: ['reports'] });
      setMessage('Avistamiento enviado. Quedó pendiente de revisión.');
    });
  }
  async function review(status: 'approved' | 'rejected') {
    await perform(async () => {
      if (note.trim().length < 3) throw Error('Escribe una nota para explicar la decisión.');
      await apiRequest(`/v1/admin/reports/${reviewing!.id}`, session!.token, 'PATCH', {
        status,
        note,
      });
      setReviewing(null);
      setNote('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['reports'] }),
        client.invalidateQueries({ queryKey: ['observations'] }),
      ]);
      setMessage('Revisión guardada.');
    });
  }
  function changeTab(value: typeof tab) {
    setTab(value);
    setOffset(0);
    setMessage('');
    setReviewing(null);
  }
  const point =
    latitude &&
    longitude &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : undefined;
  return (
    <SafeAreaView style={s.page} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <View style={s.header}>
            <Text style={s.eyebrow}>BIOATLAS · COMUNIDAD</Text>
            <Text style={s.title}>
              {session
                ? tab === 'new'
                  ? 'Nuevo avistamiento'
                  : tab === 'admin'
                    ? 'Revisar aportes'
                    : 'Mi Atlas'
                : 'Tu cuenta'}
            </Text>
            <Text style={s.muted}>Comparte lo que observas en los humedales de Valdivia.</Text>
          </View>
          {loading ? (
            <ActivityIndicator />
          ) : !session ? (
            <>
              <Text style={s.heading}>{register ? 'Crear cuenta' : 'Iniciar sesión'}</Text>
              {register && <Field label="Nombre" value={name} onChange={setName} />}
              <Field label="Correo electrónico" value={email} onChange={setEmail} />
              <Field
                label="Contraseña (mínimo 10 caracteres)"
                value={password}
                onChange={setPassword}
                secure
              />
              <Button
                title={busy ? 'Un momento…' : register ? 'Crear cuenta' : 'Entrar'}
                disabled={busy}
                onPress={() => void authenticate()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRegister(!register);
                  setMessage('');
                }}
              >
                <Text style={s.link}>{register ? 'Ya tengo cuenta' : 'Quiero registrarme'}</Text>
              </Pressable>
              <Text style={s.muted}>
                El catálogo es público. Los avistamientos se revisan antes de publicarse; tu correo
                no se muestra en el catálogo.
              </Text>
            </>
          ) : (
            <>
              <View style={s.profile}>
                <View style={s.avatar}>
                  <Text style={s.initial}>{session.user.name.trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.heading}>{session.user.name}</Text>
                  <Text style={s.muted}>
                    {session.user.role === 'admin'
                      ? 'Revisión de la comunidad'
                      : 'Comunidad naturalista'}
                  </Text>
                </View>
              </View>
              <View style={s.tabs}>
                {(
                  ['mine', 'new', ...(session.user.role === 'admin' ? ['admin'] : [])] as const
                ).map((value) => (
                  <Pressable
                    key={value}
                    style={[s.tab, tab === value && s.active]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: tab === value }}
                    onPress={() => changeTab(value as typeof tab)}
                  >
                    <Text
                      style={{
                        color: tab === value ? colors.paper : colors.muted,
                        fontWeight: '600',
                      }}
                    >
                      {value === 'mine' ? 'Mis registros' : value === 'new' ? 'Avistar' : 'Revisar'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {tab === 'new' ? (
                <>
                  <Text style={s.heading}>Tu observación</Text>
                  <Field label="Especie observada" value={species} onChange={setSpecies} />
                  <Field label="Fecha (AAAA-MM-DD)" value={date} onChange={setDate} />
                  <Field
                    label="Notas de campo"
                    value={description}
                    onChange={setDescription}
                    multiline
                  />
                  <Text style={s.label}>Toca el mapa para ubicar el avistamiento</Text>
                  <View style={{ height: 240, borderRadius: 12, overflow: 'hidden' }}>
                    <Map
                      point={point}
                      onPick={(p) => {
                        setLatitude(p.latitude.toFixed(6));
                        setLongitude(p.longitude.toFixed(6));
                      }}
                    />
                  </View>
                  <Field label="Latitud" value={latitude} onChange={setLatitude} numeric />
                  <Field label="Longitud" value={longitude} onChange={setLongitude} numeric />
                  <Text style={s.muted}>
                    Envía observaciones propias. Evita publicar ubicaciones sensibles. La ubicación
                    y descripción podrán consultarse durante la revisión.
                  </Text>
                  <Button
                    title={busy ? 'Enviando…' : 'Enviar a revisión'}
                    disabled={busy}
                    onPress={() => void submit()}
                  />
                </>
              ) : (
                <>
                  {reports.isPending ? (
                    <ActivityIndicator />
                  ) : reports.isError ? (
                    <>
                      <Text>No pudimos cargar los avistamientos.</Text>
                      <Button title="Reintentar" onPress={() => void reports.refetch()} />
                    </>
                  ) : (
                    <>
                      {!reports.data.items.length && (
                        <Text style={s.muted}>
                          {tab === 'admin'
                            ? 'No hay avistamientos pendientes.'
                            : 'Todavía no tienes avistamientos en esta página.'}
                        </Text>
                      )}
                      {reports.data.items.map((report) => (
                        <View key={report.id} style={s.card}>
                          <Text style={s.heading}>{report.scientificName}</Text>
                          <Text
                            style={[
                              s.badge,
                              report.status === 'approved'
                                ? s.approved
                                : report.status === 'rejected'
                                  ? s.rejected
                                  : s.pending,
                            ]}
                          >
                            {statusLabels[report.status]}
                          </Text>
                          <Text style={s.body}>{report.description}</Text>
                          <Text style={s.muted}>
                            {report.eventDate} · {report.latitude.toFixed(5)},{' '}
                            {report.longitude.toFixed(5)}
                          </Text>
                          {report.reviewNote && (
                            <Text style={s.body}>Revisión: {report.reviewNote}</Text>
                          )}
                          {tab === 'admin' && (
                            <Button
                              title="Revisar avistamiento"
                              onPress={() => {
                                setReviewing(report);
                                setNote('');
                              }}
                            />
                          )}
                        </View>
                      ))}
                      <View style={s.tabs}>
                        {offset > 0 && (
                          <Button
                            title="Anterior"
                            onPress={() => setOffset((n) => Math.max(0, n - 50))}
                          />
                        )}
                        {reports.data.hasMore && (
                          <Button title="Siguiente" onPress={() => setOffset((n) => n + 50)} />
                        )}
                      </View>
                      <Button
                        title="Actualizar"
                        disabled={reports.isFetching}
                        onPress={() => void reports.refetch()}
                      />
                    </>
                  )}
                  {reviewing && (
                    <View style={s.card}>
                      <Text style={s.heading}>Revisar: {reviewing.scientificName}</Text>
                      <Field label="Nota de revisión" value={note} onChange={setNote} multiline />
                      <Text style={s.muted}>
                        Aceptar publica el registro como aporte comunitario. No certifica que la
                        especie sea nativa ni constituye validación científica.
                      </Text>
                      <Button
                        title="Aceptar y publicar"
                        disabled={busy}
                        onPress={() => void review('approved')}
                      />
                      <Button
                        title="No aceptar"
                        disabled={busy}
                        onPress={() => void review('rejected')}
                      />
                      <Button
                        title="Cancelar revisión"
                        disabled={busy}
                        onPress={() => setReviewing(null)}
                      />
                    </View>
                  )}
                </>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  Alert.alert('Cerrar sesión', 'Se cerrará tu sesión en este teléfono.', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Cerrar sesión',
                      onPress: () =>
                        void perform(async () => {
                          await apiRequest('/v1/auth/logout', session.token, 'POST');
                          await save(null);
                          setTab('mine');
                        }),
                    },
                  ])
                }
              >
                <Text style={s.link}>Cerrar sesión</Text>
              </Pressable>
            </>
          )}
          {!!message && (
            <Text accessibilityRole="alert" style={s.message}>
              {message}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    gap: 18,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: { gap: 8, paddingBottom: 6 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: colors.muted },
  title: {
    fontFamily: serif,
    fontSize: 34,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.8,
  },
  heading: { fontFamily: serif, fontSize: 22, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 23 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { fontFamily: serif, fontSize: 28, color: colors.green, fontWeight: '700' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    color: colors.ink,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.green,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 52,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.paper, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  link: { color: colors.green, paddingVertical: 14, fontWeight: '600' },
  message: {
    padding: 18,
    backgroundColor: colors.sage,
    borderRadius: 14,
    color: colors.green,
    lineHeight: 21,
  },
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingVertical: 4 },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: { backgroundColor: colors.green, borderColor: colors.green },
  card: {
    padding: 18,
    gap: 12,
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  approved: { color: colors.green, backgroundColor: colors.sage },
  pending: { color: colors.amber, backgroundColor: colors.amberLight },
  rejected: { color: colors.red, backgroundColor: colors.redLight },
});
