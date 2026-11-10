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
  zoneId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,80}$/)
    .optional(),
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
  reportId: z.string().nullable().optional(),
  observerName: z.string().nullable().optional(),
  qualityGrade: z.string().nullable().optional(),
  accuracyM: z.number().nullable().optional(),
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

const positionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const ringSchema = z
  .array(positionSchema)
  .min(4)
  .max(100000)
  .refine(
    (r) => r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1],
    'El anillo debe estar cerrado',
  );
export const geometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(ringSchema).min(1).max(1000)).min(1).max(1000),
});
export const zonePropertiesSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(4000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(['macrozone', 'biotope', 'reference_area']),
  parentId: z.string().nullable(),
  source: z.string().min(1).max(300),
  sourceUrl: z.url().nullable(),
});
export const zoneFeatureSchema = z.object({
  type: z.literal('Feature'),
  properties: zonePropertiesSchema,
  geometry: geometrySchema,
});
export const zoneImportSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(zoneFeatureSchema).min(1).max(200),
});
export const zoneSchema = zonePropertiesSchema.extend({
  geometry: geometrySchema,
  bounds: boundsSchema,
  observationCount: z.number().int().nonnegative(),
});
export const zonesSchema = z.object({ items: z.array(zoneSchema), hasMore: z.boolean() });
export type Zone = z.infer<typeof zoneSchema>;
export const zoneReviewInputSchema = z
  .object({
    status: z.enum(['proposed', 'in_review', 'validated']),
    habitat: z.string().trim().max(300),
    evidenceUrl: z.union([z.literal(''), z.url().startsWith('https://')]),
    reviewer: z.string().trim().max(160),
    notes: z.string().trim().min(10).max(3000),
    boundaryChecked: z.boolean(),
    habitatChecked: z.boolean(),
    fieldChecked: z.boolean(),
    version: z.number().int().nonnegative(),
  })
  .refine(
    (v) =>
      v.status !== 'validated' ||
      (v.boundaryChecked &&
        v.habitatChecked &&
        v.fieldChecked &&
        v.habitat.length >= 3 &&
        v.evidenceUrl !== '' &&
        v.reviewer.length >= 3),
    'Para validar indica hábitat, fuente, revisor y las tres comprobaciones.',
  );
export const zoneReviewSchema = z.object({
  status: z.enum(['proposed', 'in_review', 'validated']),
  habitat: z.string(),
  evidenceUrl: z.string(),
  reviewer: z.string(),
  notes: z.string(),
  boundaryChecked: z.boolean(),
  habitatChecked: z.boolean(),
  fieldChecked: z.boolean(),
  version: z.number().int(),
  updatedAt: z.string().nullable(),
});
export const biotopeDetailSchema = z.object({
  review: zoneReviewSchema,
  children: z.array(zoneSchema),
});
export type ZoneReview = z.infer<typeof zoneReviewSchema>;
export const zoneGuideSchema = z.object({
  reviewedAt: z.string(),
  sections: z.array(
    z.object({
      id: z.enum(['culture', 'trees', 'flora']),
      title: z.string(),
      heading: z.string(),
      text: z.string(),
      scope: z.enum(['sector', 'commune']),
      sources: z.array(z.object({ title: z.string(), url: z.url() })).min(1),
    }),
  ),
});
export type ZoneGuide = z.infer<typeof zoneGuideSchema>;
export const zonePhotoSchema = z.object({
  observationId: z.string(),
  photoId: z.string(),
  scientificName: z.string(),
  commonName: z.string().nullable(),
  taxonGroup: z.string().nullable(),
  attribution: z.string(),
  license: z.string(),
  sourceUrl: z.url(),
  eventDate: z.string().nullable(),
});
export const zonePhotosSchema = z.object({ items: z.array(zonePhotoSchema), hasMore: z.boolean() });
export type ZonePhoto = z.infer<typeof zonePhotoSchema>;
export const zoneDetailsSchema = z.object({
  guide: zoneGuideSchema.optional(),
  areaKm2: z.number().nonnegative(),
  observationCount: z.number().int().nonnegative(),
  taxonCount: z.number().int().nonnegative(),
  firstDate: z.string().nullable(),
  lastDate: z.string().nullable(),
  sources: z.array(z.object({ source: z.string(), count: z.number().int() })),
  taxa: z.array(
    z.object({
      scientificName: z.string(),
      commonName: z.string().nullable(),
      count: z.number().int(),
    }),
  ),
});
export const mediaSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
  size: z.number(),
  author: z.string(),
  kind: z.enum(['image', 'video']),
  mime: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewNote: z.string().nullable(),
  canDelete: z.boolean(),
});
export const mediaListSchema = z.object({ enabled: z.boolean(), items: z.array(mediaSchema) });
export type Media = z.infer<typeof mediaSchema>;

export const inaturalistRecordSchema = z.object({
  id: z.number().int().positive(),
  geojson: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
  taxon: z.object({
    name: z.string().min(1),
    preferred_common_name: z.string().optional(),
    iconic_taxon_name: z.string().nullable().optional(),
  }),
  photos: z.array(z.unknown()).optional(),
  user: z.object({ login: z.string().min(1) }),
  license_code: z.enum(['cc0', 'cc-by', 'cc-by-nc']),
  quality_grade: z.literal('research'),
  obscured: z.literal(false),
  geoprivacy: z.enum(['open']).nullable(),
  taxon_geoprivacy: z.enum(['open']).nullable(),
  observed_on: z.string().nullable(),
  positional_accuracy: z.number().nonnegative().nullable(),
});
export const inaturalistPhotoSchema = z.object({
  id: z.number().int().positive(),
  url: z.url(),
  attribution: z.string().min(1),
  license_code: z.enum(['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa']),
  hidden: z.literal(false),
  flags: z.array(z.unknown()).max(0),
  moderator_actions: z.array(z.unknown()).max(0),
});
