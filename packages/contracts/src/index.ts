import { z } from 'zod';

export const boundsSchema = z
  .object({
    west: z.coerce.number().min(-180).max(180),
    south: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
    north: z.coerce.number().min(-90).max(90),
  })
  .refine((b) => b.west < b.east && b.south < b.north, 'Límites geográficos inválidos');
export const searchSchema = boundsSchema.safeExtend({
  q: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(300).default(300),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export const observationSchema = z.object({
  id: z.string(),
  scientificName: z.string().min(1),
  commonName: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.string(),
  sourceUrl: z.url().nullable(),
  license: z.string().nullable(),
  eventDate: z.string().nullable(),
});
export const resultsSchema = z.object({ items: z.array(observationSchema), hasMore: z.boolean() });
export type Bounds = z.infer<typeof boundsSchema>;
export type Search = z.infer<typeof searchSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Results = z.infer<typeof resultsSchema>;
