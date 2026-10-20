import { z } from 'zod';
import { messages } from '../../../domain/messages/fr.js';
const imageSchema = z
  .string()
  .max(4_000_000)
  .regex(/^(\/assets\/[a-z0-9-]+\.(png|jpg|jpeg|webp)|data:image\/(png|jpeg|webp);base64,)/i);
const socialUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => new URL(value).protocol === 'https:', 'Utilisez une adresse HTTPS.')
  .nullable()
  .optional()
  .default(null);
export const optionsSchema = z.object({
  labour: z.number().int().min(0).max(20),
  desk: z.number().int().min(0).max(20),
  wardrobe: z.number().int().min(0).max(20),
  bed: z.number().int().min(0).max(20),
});
export const pointSchema = z.tuple([z.number().min(12).max(17), z.number().min(-18.5).max(-11)]);
export const routeSchema = z.object({ from: pointSchema, to: pointSchema });
export const estimateSchema = z.object({
  vehicleId: z.string().min(1).max(30),
  routeId: z.uuid(),
  options: optionsSchema,
});
export const bookingSchema = estimateSchema
  .extend({
    customerName: z.string().trim().min(2).max(100),
    customerPhone: z.string().trim().min(9).max(25),
    fromAddress: z.string().trim().min(3).max(300),
    toAddress: z.string().trim().min(3).max(300),
    date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
      .transform((v) => v || null),
    timeSlot: z.string().max(50),
    notes: z.string().trim().max(2000).default(''),
    requestId: z.uuid(),
  })
  .superRefine((booking, context) => {
    if (booking.date && !/^([01]\d|2[0-3]):[0-5]\d$/.test(booking.timeSlot))
      context.addIssue({
        code: 'custom',
        path: ['timeSlot'],
        message: 'Saisissez une heure valide au format HH:mm.',
      });
  });
export const loginSchema = z.object({
  phone: z.string().min(9).max(25),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(10, messages.utilisezAuMoins10Caracteres).max(128),
});
export const statusSchema = z.object({
  status: z.enum(['confirmed', 'in_progress', 'completed', 'cancelled']),
  version: z.number().int().positive(),
});
export const tripPhotosSchema = z.object({ photos: z.array(imageSchema).min(1).max(5) });
export const driverAssignmentSchema = z.object({
  driverId: z.uuid().nullable(),
  version: z.number().int().positive(),
});
export const bookingRouteUpdateSchema = routeSchema.extend({
  version: z.number().int().positive(),
});
export const quoteSchema = z.object({
  kind: z.enum(['provisional', 'final']),
  trips: z.number().int().min(1).max(10000),
  customPrice: z.number().int().positive().max(10000000).nullable(),
  discount: z.number().int().min(0).max(10000000),
  notes: z.string().trim().max(2000),
  extraLines: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(100),
        quantity: z.number().int().min(1).max(100),
        unitPrice: z.number().int().positive().max(10000000),
      }),
    )
    .max(20)
    .default([]),
  options: optionsSchema.optional(),
  version: z.number().int().positive(),
});
export const driverSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(9).max(25),
  photo: imageSchema.nullable(),
  active: z.boolean(),
  vehicleId: z.string().min(1).max(30).nullable(),
});
export const createDriverSchema = driverSchema.extend({
  photo: imageSchema,
  password: z.string().min(10, messages.utilisezAuMoins10Caracteres).max(128),
});
export const driverProfileSchema = driverSchema.pick({ name: true, phone: true, photo: true });
export const vehicleInspectionSchema = z.object({
  levels: z.object({
    engineOil: z.enum(['good', 'low', 'empty']),
    coolant: z.enum(['good', 'low', 'empty']),
    brakeFluid: z.enum(['good', 'low', 'empty']),
    powerSteering: z.enum(['good', 'low', 'empty']),
    washerFluid: z.enum(['good', 'low', 'empty']),
  }),
  condition: z.enum(['good', 'attention', 'unsafe']),
  notes: z.string().trim().max(1500).default(''),
  photos: z
    .object({
      engineOil: imageSchema,
      coolant: imageSchema,
      brakeFluid: imageSchema,
      powerSteering: imageSchema,
      washerFluid: imageSchema,
      condition: z.array(imageSchema).min(1).max(5),
    })
    .transform((photos) => [
      photos.engineOil,
      photos.coolant,
      photos.brakeFluid,
      photos.powerSteering,
      photos.washerFluid,
      ...photos.condition,
    ]),
});
export const breakdownSchema = z.object({
  description: z.string().trim().min(5).max(1500),
  latitude: z.number().min(12).max(17),
  longitude: z.number().min(-18.5).max(-11),
  accuracy: z.number().nonnegative().max(100000).nullable(),
  photos: z.array(imageSchema).max(5).default([]),
});
export const adminProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(9).max(25),
  photo: imageSchema.nullable(),
});
export const catalogueSchema = z.object({
  vehicles: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{1,30}$/),
        volume: z.string().trim().min(1).max(30),
        length: z.string().trim().min(1).max(30),
        height: z.string().trim().min(1).max(30),
        width: z.string().trim().min(1).max(30),
        wheelWidth: z.string().trim().min(1).max(30),
        image: imageSchema,
        interior: imageSchema,
        active: z.boolean().default(true),
        name: z.string().trim().min(2).max(100),
        prices: z.tuple([
          z.number().int().positive().max(10000000),
          z.number().int().positive().max(10000000),
          z.number().int().positive().max(10000000),
        ]),
      }),
    )
    .min(1)
    .max(100)
    .refine(
      (v) => new Set(v.map((x) => x.id)).size === v.length,
      messages.chaqueVehiculeDoitEtrePresentUneFois,
    ),
  settings: z.object({
    distanceBounds: z
      .tuple([
        z.number().int().min(1).max(1000),
        z.number().int().min(2).max(1000),
        z.number().int().min(3).max(1000),
      ])
      .refine((v) => v[0] < v[1] && v[1] < v[2], messages.lesBornesDoiventEtreCroissantes),
    bookingsEnabled: z.boolean(),
    maxAdvanceDays: z.number().int().min(1).max(730),
    minNoticeHours: z.number().int().min(0).max(720),
    maxOptions: z.number().int().min(0).max(20),
    maxTrips: z.number().int().min(1).max(20),
    clientCancellation: z.boolean(),
    cancellationNoticeHours: z.number().int().min(0).max(720),
    enabledSlots: z
      .array(
        z.object({
          label: z.string().trim().min(2).max(100),
          startHour: z.number().int().min(0).max(23),
        }),
      )
      .min(0)
      .max(24)
      .refine((v) => new Set(v.map((slot) => slot.label)).size === v.length),
    labourPrice: z.number().int().min(0).max(1000000),
    assemblyPrice: z.number().int().min(0).max(1000000),
    businessPhone: z.string().regex(/^\+221[0-9]{9}$/),
    whatsappPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
    businessName: z.string().trim().min(2).max(100),
    businessAddress: z.string().trim().min(2).max(300),
    invoiceFooter: z.string().trim().min(2).max(500),
    tiktokUrl: socialUrlSchema,
    facebookUrl: socialUrlSchema,
    instagramUrl: socialUrlSchema,
    invoiceLogo: imageSchema.nullable(),
    invoiceStamp: imageSchema.nullable(),
    invoiceSignature: imageSchema.nullable(),
  }),
});
