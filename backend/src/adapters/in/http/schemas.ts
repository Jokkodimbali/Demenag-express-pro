import { z } from 'zod';
import { messages } from '../../../domain/messages/fr.js';
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
export const bookingSchema = estimateSchema.extend({
  fromAddress: z.string().trim().min(3).max(300),
  toAddress: z.string().trim().min(3).max(300),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().max(50),
  notes: z.string().trim().max(2000).default(''),
  requestId: z.uuid(),
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
  status: z.enum(['confirmed', 'in_progress', 'cancelled']),
  version: z.number().int().positive(),
});
export const quoteSchema = z.object({
  kind: z.enum(['provisional', 'final']),
  trips: z.number().int().min(1).max(20),
  customPrice: z.number().int().positive().max(10000000).nullable(),
  discount: z.number().int().min(0).max(10000000),
  notes: z.string().trim().max(2000),
  version: z.number().int().positive(),
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
        image: z.string().regex(/^\/assets\/(sprinter|trafic|master)-profil\.png$/),
        interior: z.string().regex(/^\/assets\/(sprinter|trafic|master)-interieur\.png$/),
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
          label: z.string().trim().min(2).max(50),
          startHour: z.number().int().min(0).max(23),
        }),
      )
      .min(1)
      .max(3)
      .refine((v) => new Set(v.map((slot) => slot.label)).size === v.length),
    labourPrice: z.number().int().min(0).max(1000000),
    assemblyPrice: z.number().int().min(0).max(1000000),
    businessPhone: z.string().regex(/^\+221[0-9]{9}$/),
  }),
});
