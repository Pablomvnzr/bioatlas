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

export const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(10).max(128),
});
export const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
});
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  role: z.enum(['member', 'admin']),
});
export const sessionSchema = z.object({ token: z.string(), user: userSchema });
export const reportInputSchema = z.object({
  scientificName: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(2000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  eventDate: z.iso
    .date()
    .refine(
      (date) => date <= new Date().toISOString().slice(0, 10),
      'La fecha no puede estar en el futuro',
    ),
});
export const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().min(3).max(1000),
});
export const reportSchema = reportInputSchema.extend({
  id: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewNote: z.string().nullable(),
  createdAt: z.string(),
});
export const reportsSchema = z.object({ items: z.array(reportSchema), hasMore: z.boolean() });
export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;
export type Report = z.infer<typeof reportSchema>;
