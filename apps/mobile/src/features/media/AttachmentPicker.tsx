import React, { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { validateAttachment } from './uploadMedia';

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} nativeControls style={{ height: 200, width: '100%' }} />;
}

export default function AttachmentPicker({
  asset,
  onChange,
  disabled,
}: {
  asset: ImagePicker.ImagePickerAsset | null;
  onChange: (asset: ImagePicker.ImagePickerAsset | null) => void;
  disabled: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  async function pick(source: 'photo' | 'video' | 'library') {
    setOpening(true);
    setError('');
    setSettings(false);
    try {
      if (source !== 'library') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setSettings(!permission.canAskAgain);
          throw Error(
            'Permite el acceso a la cámara para capturar el avistamiento. También puedes elegir un archivo de la galería.',
          );
        }
      }
      const result =
        source === 'library'
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images', 'videos'],
              quality: 0.8,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: source === 'photo' ? ['images'] : ['videos'],
              quality: 0.8,
              videoMaxDuration: 30,
            });
      if (!result.canceled) {
        validateAttachment(result.assets[0]);
        onChange(result.assets[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos abrir la cámara o galería.');
    } finally {
      setOpening(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontWeight: '700', color: '#203B30' }}>
        Foto o video del avistamiento (opcional)
      </Text>
      <Text>
        Adjunta un archivo antes de enviar. Fotos JPG/PNG hasta 10 MB y videos MP4 hasta 50 MB.
        Grabaciones de hasta 30 segundos.
      </Text>
      {(['photo', 'video', 'library'] as const).map((source) => (
        <Pressable
          key={source}
          accessibilityRole="button"
          disabled={disabled || opening}
          onPress={() => void pick(source)}
          style={{
            padding: 13,
            borderRadius: 10,
            backgroundColor: '#E3EEE6',
            opacity: disabled || opening ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#173C32', fontWeight: '700' }}>
            {source === 'photo'
              ? 'Tomar foto'
              : source === 'video'
                ? 'Grabar video'
                : 'Elegir de la galería'}
          </Text>
        </Pressable>
      ))}
      {asset && (
        <>
          {asset.type === 'video' ? (
            <VideoPreview key={asset.uri} uri={asset.uri} />
          ) : (
            <Image
              source={{ uri: asset.uri }}
              resizeMode="contain"
              style={{ height: 200, width: '100%' }}
            />
          )}
          <Text>{asset.fileName ?? 'Archivo adjunto'}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={disabled || opening}
            onPress={() => onChange(null)}
            style={{ padding: 12 }}
          >
            <Text>Quitar archivo</Text>
          </Pressable>
        </>
      )}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {settings && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings()}
          style={{ padding: 12 }}
        >
          <Text>Abrir permisos en Ajustes</Text>
        </Pressable>
      )}
    </View>
  );
}
