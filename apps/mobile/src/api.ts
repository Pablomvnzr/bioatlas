import { resultsSchema, type Bounds } from '@bioatlas/contracts';
export async function getObservations(bounds: Bounds, q: string, signal: AbortSignal) {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) throw Error('La conexión al catálogo todavía no está configurada.');
  const params = new URLSearchParams({
    ...Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, String(value)])),
    q,
  });
  const response = await fetch(`${base.replace(/\/$/, '')}/v1/observations?${params}`, { signal });
  if (!response.ok) throw Error('No pudimos cargar el catálogo. Inténtalo nuevamente.');
  return resultsSchema.parse(await response.json());
}
