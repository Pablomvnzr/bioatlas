import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { apiBase } from '../../api';

export function validateAttachment(asset: ImagePickerAsset) {
  const mime = asset.mimeType;
  if (!mime || !['video/mp4', 'image/jpeg', 'image/png'].includes(mime))
    throw Error('Selecciona un video MP4 o una imagen JPG/PNG.');
  const limit = mime === 'video/mp4' ? 50 : 10;
  if (asset.fileSize && asset.fileSize > limit * 1024 * 1024)
    throw Error(`El archivo supera el máximo de ${limit} MB.`);
  return mime;
}

export async function uploadMedia(
  reportId: string,
  token: string,
  asset: ImagePickerAsset,
  title: string,
  description = '',
) {
  const mimeType = validateAttachment(asset);
  const params = new URLSearchParams({ title: title.trim(), description: description.trim() });
  const result = await FileSystem.uploadAsync(
    `${apiBase()}/v1/reports/${reportId}/media?${params}`,
    asset.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (result.status !== 201) {
    let message = 'No se pudo subir el archivo.';
    try {
      message = JSON.parse(result.body).message ?? message;
    } catch {}
    throw Error(message);
  }
}
