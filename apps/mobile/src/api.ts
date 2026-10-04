import { resultsSchema, type Bounds } from '@bioatlas/contracts';
export function apiBase() {
  return (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
}
export async function apiRequest(
  path: string,
  token?: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
) {
  if (!apiBase()) throw Error('La conexión al servidor todavía no está configurada.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiBase() + path, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(Error(data.message ?? 'No pudimos completar la solicitud.'), {
        status: response.status,
      });
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw Error('El servidor tardó demasiado. Inténtalo nuevamente.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
export async function getObservations(bounds: Bounds, q: string, signal: AbortSignal) {
  const params = new URLSearchParams({
    ...Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, String(value)])),
    q,
  });
  return resultsSchema.parse(
    await apiRequest(`/v1/observations?${params}`, undefined, 'GET', undefined, signal),
  );
}
