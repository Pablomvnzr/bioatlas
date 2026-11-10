import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { VideoView, useVideoPlayer } from 'expo-video';
import { mediaListSchema, type Media } from '@bioatlas/contracts';
import { apiBase, apiRequest } from '../../api';
import { useSession } from '../../Session';

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
      style={{
        padding: 12,
        backgroundColor: '#E3EEE6',
        borderRadius: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: '#173C32', fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}
function Video({ uri, headers }: { uri: string; headers?: Record<string, string> }) {
  const player = useVideoPlayer({ uri, headers });
  return <VideoView player={player} nativeControls style={{ height: 230, width: '100%' }} />;
}
function MediaCard({ item, refresh }: { item: Media; refresh: () => Promise<unknown> }) {
  const { session } = useSession();
  const [uri, setUri] = useState(''),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
    }
  }
  const headers =
    uri.startsWith(apiBase() + '/') && session
      ? { Authorization: `Bearer ${session.token}` }
      : undefined;
  return (
    <View style={{ gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 10 }}>
      <Text style={{ fontWeight: '700' }}>{item.title}</Text>
      <Text>
        {item.author} ·{' '}
        {item.status === 'pending'
          ? 'Pendiente de revisión'
          : item.status === 'approved'
            ? 'Publicado'
            : 'No aceptado'}
      </Text>
      {!!item.description && <Text>{item.description}</Text>}
      {!!item.reviewNote && <Text>Revisión: {item.reviewNote}</Text>}
      {uri &&
        (item.kind === 'video' ? (
          <Video key={uri} uri={uri} headers={headers} />
        ) : (
          <Image
            source={{ uri, headers }}
            resizeMode="contain"
            style={{ height: 240, width: '100%' }}
            onError={() => setError('No se pudo cargar la imagen. Intenta abrirla nuevamente.')}
          />
        ))}
      <Button
        disabled={busy}
        title={uri ? 'Volver a cargar' : item.kind === 'video' ? 'Ver video' : 'Ver foto'}
        onPress={() =>
          void act(async () => {
            const data = await apiRequest(`/v1/media/${item.id}/playback`, session?.token);
            setUri(data.url.startsWith('/') ? apiBase() + data.url : data.url);
          })
        }
      />
      {session?.user.role === 'admin' && item.status === 'pending' && (
        <>
          <TextInput
            accessibilityLabel="Nota de revisión del archivo"
            placeholder="Motivo de la revisión (mínimo 3 caracteres)"
            value={note}
            onChangeText={setNote}
            style={{ padding: 12, borderWidth: 1, borderColor: '#ccc' }}
          />
          {(['approved', 'rejected'] as const).map((status) => (
            <Button
              key={status}
              title={status === 'approved' ? 'Aceptar archivo' : 'No aceptar archivo'}
              disabled={busy || note.trim().length < 3}
              onPress={() =>
                void act(async () => {
                  await apiRequest(`/v1/media/${item.id}/review`, session.token, 'PATCH', {
                    status,
                    note,
                  });
                  await refresh();
                })
              }
            />
          ))}
        </>
      )}
      {item.canDelete && (
        <Button
          title="Eliminar archivo"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              'Eliminar archivo',
              'Se eliminará la foto o el video de este avistamiento.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar',
                  style: 'destructive',
                  onPress: () =>
                    void act(async () => {
                      await apiRequest(`/v1/media/${item.id}`, session?.token, 'DELETE');
                      await refresh();
                    }),
                },
              ],
            )
          }
        />
      )}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
    </View>
  );
}
export default function MediaGallery({
  reportId,
  zoneId,
  canUpload = false,
  moderation = false,
}: {
  reportId?: string;
  zoneId?: string;
  canUpload?: boolean;
  moderation?: boolean;
}) {
  const { session } = useSession();
  const client = useQueryClient();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const path = moderation
    ? '/v1/admin/media'
    : reportId
      ? `/v1/reports/${reportId}/media`
      : `/v1/zones/${zoneId}/media`;
  const query = useQuery({
    queryKey: ['media', path, session?.user.id],
    queryFn: async () =>
      mediaListSchema.parse(
        await apiRequest(path, reportId || moderation ? session?.token : undefined),
      ),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['media'] });
  async function pick() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 1,
      });
      if (!result.canceled) {
        setAsset(result.assets[0]);
        setMessage('');
      }
    } catch {
      setMessage('No pudimos abrir la galería del teléfono.');
    }
  }
  async function upload() {
    if (!asset || !session || !reportId) return;
    const mime = asset.mimeType;
    const limit = mime === 'video/mp4' ? 50 : 10;
    if (!mime || !['video/mp4', 'image/jpeg', 'image/png'].includes(mime)) {
      setMessage('Selecciona un video MP4 o una imagen JPG/PNG.');
      return;
    }
    if (asset.fileSize && asset.fileSize > limit * 1024 * 1024) {
      setMessage(`El archivo supera el máximo de ${limit} MB.`);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ title: title.trim(), description: description.trim() });
      const result = await FileSystem.uploadAsync(`${apiBase()}${path}?${params}`, asset.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: mime,
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (result.status !== 201) {
        let message = 'No se pudo subir el archivo.';
        try {
          message = JSON.parse(result.body).message ?? message;
        } catch {}
        throw Error(message);
      }
      setAsset(null);
      setTitle('');
      setDescription('');
      setMessage(
        'Archivo enviado. Será visible públicamente cuando se acepten el archivo y el avistamiento.',
      );
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Fotos y videos</Text>
      {query.isPending ? (
        <ActivityIndicator />
      ) : query.isError ? (
        <>
          <Text>No pudimos cargar los archivos.</Text>
          <Button title="Reintentar" onPress={() => void query.refetch()} />
        </>
      ) : (
        <>
          {!query.data.enabled && (
            <Text>La carga de archivos todavía no está disponible en el servidor.</Text>
          )}
          {!query.data.items.length && <Text>Aún no hay fotos o videos disponibles.</Text>}
          {query.data.items.map((item) => (
            <MediaCard key={item.id} item={item} refresh={refresh} />
          ))}
          {canUpload && session && query.data.enabled && (
            <>
              <Text>
                Sube material propio del avistamiento. Fotos JPG/PNG de hasta 10 MB o videos MP4 de
                hasta 50 MB. Los archivos se revisan antes de publicarse.
              </Text>
              <Button
                title="Seleccionar foto o video"
                disabled={busy}
                onPress={() => void pick()}
              />
              {asset && (
                <>
                  <Text>{asset.fileName ?? 'Archivo seleccionado'}</Text>
                  <TextInput
                    accessibilityLabel="Título del archivo"
                    placeholder="Título del archivo"
                    maxLength={160}
                    value={title}
                    onChangeText={setTitle}
                    style={{ padding: 12, backgroundColor: '#fff' }}
                  />
                  <TextInput
                    accessibilityLabel="Descripción del archivo"
                    placeholder="Descripción (opcional)"
                    maxLength={2000}
                    value={description}
                    onChangeText={setDescription}
                    style={{ padding: 12, backgroundColor: '#fff' }}
                  />
                  <Button
                    title={busy ? 'Subiendo…' : 'Subir archivo'}
                    disabled={busy || title.trim().length < 3}
                    onPress={() => void upload()}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
    </View>
  );
}
