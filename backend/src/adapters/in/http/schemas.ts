import { z } from 'zod';
import { messages } from '../../../domain/messages/fr.js';
import { phoneNumberSchema } from './validation/phone.js';
const imageSchema = z
  .string()
  .max(7_000_000)
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
const workAccessSchema = z.object({
  fromFloor: z.number().int().min(0).max(20),
  toFloor: z.number().int().min(0).max(20),
  fromLift: z.boolean(),
  toLift: z.boolean(),
});
const inventorySnapshotSchema = z.object({
  sourceInventory: z
    .object({
      dwellingType: z.string().max(80),
      annexOn: z.boolean().optional(),
      fromFloor: z.number().int().min(0).max(20),
      toFloor: z.number().int().min(0).max(20),
      fromLift: z.boolean(),
      toLift: z.boolean(),
      entries: z.record(
        z.string().max(100),
        z.object({
          quantity: z.number().int().min(0).max(999),
          size: z.number().finite().min(0).max(10000),
          format: z.enum(['small', 'medium', 'large']).optional(),
          dismantle: z.boolean(),
          menuisier: z.boolean().optional(),
          origin: z.enum(['local', 'import']).optional(),
        }),
      ),
      variants: z
        .array(
          z.object({
            id: z.string().max(100),
            itemKey: z.string().max(100),
            quantity: z.number().int().min(0).max(999),
            size: z.number().finite().min(0).max(10000),
            format: z.enum(['small', 'medium', 'large']).optional(),
            dismantle: z.boolean(),
            menuisier: z.boolean().optional(),
            origin: z.enum(['local', 'import']).optional(),
          }),
        )
        .max(500),
      flags: z.record(z.string().max(100), z.boolean()),
      ready: z.enum(['oui', 'non', '']).optional(),
      stairs: z.enum(['oui', 'non', 'balcon', 'verif', '']).optional(),
      balcPx: z.number().int().min(0).max(10000000).optional(),
      blanketLengthCm: z.number().finite().min(1).max(1000).optional(),
      blanketWidthCm: z.number().finite().min(1).max(1000).optional(),
      custom: z
        .array(
          z.object({
            id: z.string().max(100),
            typeKey: z.string().max(100).optional(),
            label: z.string().max(120),
            quantity: z.number().int().min(0).max(999),
            format: z.enum(['small', 'medium', 'large']).optional(),
            dismantle: z.boolean().optional(),
            origin: z.enum(['local', 'import']).optional(),
            cL: z.number().finite().min(0).max(100000).optional(),
            cW: z.number().finite().min(0).max(100000).optional(),
            cH: z.number().finite().min(0).max(100000).optional(),
            kg: z.number().finite().min(0).max(100000).optional(),
            mp: z.number().int().min(0).max(10000000).optional(),
            menuPriceLocal: z.number().int().min(0).max(10000000).optional(),
            menuPriceImport: z.number().int().min(0).max(10000000).optional(),
            like: z.string().max(100).optional(),
            up: z.boolean().optional(),
            frag: z.boolean().optional(),
            notop: z.boolean().optional(),
          }),
        )
        .max(500),
      crew: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  dwellingType: z.string().max(80),
  annexIncluded: z.boolean(),
  annexVolumeM3: z.number().finite().min(0).max(10000),
  fromFloor: z.number().int().min(0).max(20),
  toFloor: z.number().int().min(0).max(20),
  fromLift: z.boolean(),
  toLift: z.boolean(),
  ready: z.enum(['oui', 'non', '']),
  stairs: z.enum(['oui', 'non', 'balcon', 'verif', '']),
  balcPx: z.number().int().min(0).max(10000000).optional(),
  flags: z.array(z.string().trim().min(1).max(120)).max(30),
  items: z
    .array(
      z.object({
        section: z.string().trim().min(1).max(100),
        label: z.string().trim().min(1).max(120),
        quantity: z.number().int().min(1).max(999),
        details: z.string().max(250),
        volumeM3: z.number().finite().min(0).max(10000),
      }),
    )
    .max(500),
  itemCount: z.number().int().min(0).max(100000),
  totalVolumeM3: z.number().finite().min(0).max(100000),
  vehicleCapacityM3: z.number().finite().min(0).max(10000),
  fillRate: z.number().finite().min(0).max(1),
  estimatedTrips: z.number().int().min(0).max(10000),
  moverCount: z.number().int().min(0).max(100),
  carpenterCount: z.number().int().min(0).max(100),
  totalWeightKg: z.number().finite().min(0).max(100000).optional(),
  maxItemWeightKg: z.number().finite().min(0).max(100000).optional(),
  loadingMinutes: z.number().finite().min(0).max(100000),
  unloadingMinutes: z.number().finite().min(0).max(100000),
  packingMinutes: z.number().finite().min(0).max(100000),
  travelMinutes: z.number().finite().min(0).max(100000),
  travelLegMinutes: z.number().finite().min(0).max(100000).optional(),
  totalMinutes: z.number().finite().min(0).max(100000),
  lowDurationMinutes: z.number().finite().min(0).max(100000),
  highDurationMinutes: z.number().finite().min(0).max(100000),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
});
const measurementValue = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;
const clientQuestionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  group: z.string().trim().min(1).max(100),
  label: z.string().trim().min(3).max(500),
  hint: z.string().trim().max(1000).optional(),
  answerType: z.enum(['text', 'yes_no']),
  required: z.boolean(),
  active: z.boolean(),
});
const questionnaireAnswersSchema = z
  .array(
    z.object({
      questionId: z.string().min(1).max(64),
      group: z.string().trim().min(1).max(100),
      question: z.string().trim().min(3).max(500),
      answer: z.string().trim().max(1000),
    }),
  )
  .max(100)
  .default([]);
export const pointSchema = z.tuple([z.number().min(12).max(17), z.number().min(-18.5).max(-11)]);
export const tollPointSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    region: z.string().trim().max(80).default(''),
    axis: z.string().trim().max(120).default(''),
    heavyPrice: z.number().int().nonnegative().max(10000000),
    vehiclePrices: z
      .record(z.string().min(1).max(30), z.number().int().nonnegative().max(10000000))
      .default({}),
    latitude: z.number().min(12).max(17).nullable(),
    longitude: z.number().min(-18.5).max(-11).nullable(),
  })
  .refine((point) => (point.latitude === null) === (point.longitude === null), {
    message: 'Renseignez les deux coordonnées du péage.',
    path: ['latitude'],
  });
export const tollPointCreateSchema = tollPointSchema.refine(
  (point) => point.latitude !== null && point.longitude !== null,
  { message: 'Placez le point de péage sur la carte.', path: ['latitude'] },
);
export const routeSchema = z.object({ from: pointSchema, to: pointSchema });
export const estimateSchema = z.object({
  vehicleId: z.string().min(1).max(30),
  routeId: z.uuid(),
  options: optionsSchema,
  trips: z.number().int().min(1).max(20).optional(),
  workAccess: workAccessSchema.optional(),
  workDate: z.iso.date().nullable().optional(),
});
export const adminEstimateSchema = estimateSchema.extend({
  distanceKmOverride: z.number().min(0).max(100000),
});
export const bookingSchema = estimateSchema
  .extend({
    distanceKmOverride: z.number().min(0).max(100000).nullable().optional(),
    customerName: z.string().trim().min(2).max(100),
    customerPhone: phoneNumberSchema,
    source: z
      .enum([
        '',
        'Facebook',
        'YouTube',
        'Instagram',
        'Snapchat',
        'TikTok',
        'Autre pub',
        'Bouche-à-oreille',
        'Client fidèle',
        'Autre',
      ])
      .optional(),
    fromAddress: z.string().trim().min(3).max(300),
    toAddress: z.string().trim().min(3).max(300),
    date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
      .transform((v) => v || null),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    timeSlot: z.union([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), z.literal('')]),
    notes: z.string().trim().max(10000).default(''),
    workAccess: workAccessSchema.optional(),
    questionnaireAnswers: questionnaireAnswersSchema.optional(),
    workPlan: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
          time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
          title: z.string().trim().min(1).max(120),
          detail: z.string().trim().max(500),
          minutes: z.number().int().min(0).max(1440),
        }),
      )
      .max(50)
      .optional(),
    inventorySnapshot: inventorySnapshotSchema.nullable().optional(),
    requestId: z.uuid(),
  })
  .refine((booking) => !booking.date || Boolean(booking.timeSlot), {
    path: ['timeSlot'],
    message: messages.creneauInvalide,
  });
export const workPlanReviewSchema = z.object({
  status: z.enum(['pending', 'respected', 'late', 'not_respected']),
  reason: z.string().max(1000),
  actualTime: z.union([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), z.literal('')]).optional(),
  photo: z
    .union([
      z
        .string()
        .regex(/^data:image\/(?:jpeg|png|webp);base64,/)
        .max(5_500_000),
      z.literal(''),
    ])
    .optional(),
  cause: z
    .enum([
      '',
      'Qualité',
      'Sécurité',
      'Environnement',
      'Client',
      'Véhicule',
      'Équipe',
      'Circulation',
    ])
    .optional(),
  severity: z.enum(['', 'min', 'maj', 'cri']).optional(),
  correctiveAction: z.string().max(1000).optional(),
  version: z.number().int().positive(),
});
const loginFields = z.object({
  identifier: z.string().trim().min(3).max(254).optional(),
  phone: phoneNumberSchema.optional(),
  password: z.string().max(128).optional(),
});
export const loginSchema = loginFields.refine((input) => Boolean(input.identifier || input.phone), {
  path: ['identifier'],
  message: 'Saisissez votre numéro de téléphone ou votre email administrateur.',
});
export const registerSchema = z
  .object({
    role: z.literal('client').default('client'),
    phone: phoneNumberSchema,
    name: z.string().trim().min(2).max(100).optional(),
    password: z.string().max(128).optional(),
  })
  .superRefine((input, context) => {
    if (!input.name)
      context.addIssue({ code: 'custom', path: ['name'], message: 'Saisissez votre nom complet.' });
    if (
      !input.password ||
      input.password.length < 8 ||
      !/[a-zA-Z]/.test(input.password) ||
      !/\d/.test(input.password)
    )
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message:
          'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.',
      });
  });
export const statusSchema = z.object({
  status: z.enum(['confirmed', 'in_progress', 'completed', 'cancelled']),
  version: z.number().int().positive(),
});
export const tripPhotosSchema = z.object({ photos: z.array(imageSchema).max(5).default([]) });
export const driverAssignmentSchema = z.object({
  driverId: z.uuid().nullable(),
  version: z.number().int().positive(),
});
export const bookingCrewSchema = z.object({
  crew: z.object({
    chauffeur: z.array(z.uuid()).max(20),
    menuisier: z.array(z.uuid()).max(20),
    manoeuvre: z.array(z.uuid()).max(30),
    chef: z.union([z.literal(''), z.uuid()]),
  }),
  crewBriefs: z.record(z.string().uuid(), z.iso.datetime()),
  crewRefusedBy: z.array(z.string().uuid()).max(100),
  crewReplies: z.record(z.string().uuid(), z.enum(['ok', 'no'])),
  crewMessages: z.record(z.string().uuid(), z.string().max(5000)),
  version: z.number().int().positive(),
});
export const bookingRouteUpdateSchema = routeSchema.extend({
  version: z.number().int().positive(),
});
export const quoteSchema = z.object({
  kind: z.enum(['provisional', 'final']),
  trips: z.number().int().min(1).max(10000),
  customPrice: z.number().int().nonnegative().max(10000000).nullable(),
  labourUnitPriceOverride: z.number().int().positive().max(10000000).nullable().optional(),
  discount: z.number().int().min(0).max(10000000),
  discountType: z.enum(['fcfa', 'pct']).optional(),
  discountReason: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(10000),
  extraLines: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(100),
        quantity: z.number().min(0.5).multipleOf(0.5).max(100),
        unitPrice: z.number().int().positive().max(10000000),
      }),
    )
    .max(20)
    .default([]),
  tolls: z
    .array(
      z.object({
        tollPointId: z.string().trim().min(1).max(100),
        direction: z.enum(['one-way', 'round-trip']),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .max(50)
    .default([]),
  options: optionsSchema.optional(),
  version: z.number().int().positive(),
  billingMode: z.enum(['complete', 'standard', 'driver-rental']).default('complete'),
  menuIncluded: z.boolean().default(false),
  rentalKit: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(0).max(10000),
        image: z.string().max(2000).optional(),
      }),
    )
    .max(100)
    .default([]),
  overtimeMinutes: z.number().int().min(0).max(100000).default(0),
  providedCrew: z.number().int().min(0).max(100).default(0),
});
export const driverAvailabilitySchema = z
  .array(
    z.object({
      available: z.boolean(),
      startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    }),
  )
  .length(7)
  .refine(
    (days) => days.every((day) => !day.available || day.endTime > day.startTime),
    'L’heure de fin doit être après l’heure de début.',
  );
export const driverSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneNumberSchema,
  photo: imageSchema.nullable(),
  active: z.boolean(),
  vehicleId: z.string().min(1).max(30).nullable(),
  availability: driverAvailabilitySchema.optional(),
  role: z.enum(['chauffeur', 'menuisier', 'manoeuvre']).optional(),
  authorizedVehicleIds: z.array(z.string().min(1).max(30)).max(30).optional(),
  address: z.string().trim().max(300).optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  geocodedAddress: z.string().max(300).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  notes: z.string().max(2000).optional(),
  refusals: z
    .array(
      z.object({
        ref: z.string().max(50),
        at: z.iso.datetime(),
      }),
    )
    .max(500)
    .optional(),
  clearedRefusals: z.number().int().min(0).max(500).optional(),
});
export const createDriverSchema = driverSchema.extend({
  active: z.boolean().optional().default(true),
  photo: imageSchema.nullable(),
});
export const driverProfilePhotoSchema = z.object({ photo: imageSchema.nullable() });
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
  phone: phoneNumberSchema,
  email: z
    .union([z.literal(''), z.email()])
    .nullable()
    .optional(),
  photo: imageSchema.nullable(),
});
export const catalogueSchema = z.object({
  vehicles: z
    .array(
      z
        .object({
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
          shortName: z.string().trim().min(1).max(50).optional(),
          prices: z.tuple([
            z.number().int().min(0).max(10000000),
            z.number().int().min(0).max(10000000),
            z.number().int().min(0).max(10000000),
          ]),
        })
        .superRefine((vehicle, context) => {
          const length = measurementValue(vehicle.length);
          const height = measurementValue(vehicle.height);
          const wheelWidth = measurementValue(vehicle.wheelWidth);
          if (
            [length, height, measurementValue(vehicle.width), wheelWidth].some(
              (value) => value <= 0,
            )
          ) {
            context.addIssue({
              code: 'custom',
              message: 'Les quatre dimensions doivent être positives.',
            });
          }
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
    labourFloorPrice: z.number().int().min(0).max(1000000).default(500),
    labourLiftPrice: z.number().int().min(0).max(1000000).default(500),
    labourMatrix: z
      .object({
        none: z.array(z.array(z.number().int().min(0).max(1000000)).length(6)).length(6),
        from: z.array(z.array(z.number().int().min(0).max(1000000)).length(6)).length(6),
        to: z.array(z.array(z.number().int().min(0).max(1000000)).length(6)).length(6),
        both: z.array(z.array(z.number().int().min(0).max(1000000)).length(6)).length(6),
      })
      .optional(),
    movingLaborPlanning: z
      .object({
        maxHandlingHours: z.number().min(0.5).max(12),
        maxDayHours: z.number().min(1).max(16),
        defaultStartHour: z.number().int().min(0).max(23),
        maxMoversPerVehicle: z.number().int().min(2).max(20),
        cubicMetersPerHourPerMover: z.number().min(0.1).max(50),
        pauseMinutes: z.number().int().min(0).max(180),
        teamVolumePerMover: z.number().min(1).max(100).default(6),
        tripSetupMinutes: z.number().int().min(0).max(180).default(15),
        handlingCalibration: z.number().min(0.5).max(5).default(1),
        carryDistanceMeters: z.number().int().min(1).max(200).default(15),
        heat: z.number().int().min(0).max(1).optional(),
        wbgtAdj: z.number().min(-10).max(10).optional(),
        maxTotalHours: z.number().min(1).max(48).default(12),
        metabolicReference: z.number().min(50).max(1000).default(200),
        effortGround: z.number().min(50).max(1000).default(200),
        effortLift: z.number().min(50).max(1000).default(210),
        effortStairs: z.number().min(50).max(1000).default(230),
        effortPerFloor: z.number().min(0).max(200).default(12),
        effortMaximum: z.number().min(50).max(1500).default(290),
        followingTripDiscountPercent: z.number().int().min(10).max(100).default(60),
        lowDemandDiscountPercent: z.number().int().min(0).max(50).default(10),
        manoeuvreOvertimeThresholdHours: z.number().min(1).max(24).default(8),
        manoeuvreOvertimeHourlyRate: z.number().int().min(0).max(10000000).default(0),
        blanketLengthCm: z.number().int().min(50).max(400).optional(),
        blanketWidthCm: z.number().int().min(50).max(400).optional(),
        blanketStock: z.number().int().min(0).optional(),
      })
      .default({
        maxHandlingHours: 3,
        maxDayHours: 8,
        defaultStartHour: 8,
        maxMoversPerVehicle: 6,
        cubicMetersPerHourPerMover: 2.7,
        pauseMinutes: 30,
        teamVolumePerMover: 6,
        tripSetupMinutes: 15,
        handlingCalibration: 1,
        carryDistanceMeters: 15,
        heat: 1,
        wbgtAdj: 0,
        maxTotalHours: 12,
        metabolicReference: 200,
        effortGround: 200,
        effortLift: 210,
        effortStairs: 230,
        effortPerFloor: 12,
        effortMaximum: 290,
        followingTripDiscountPercent: 60,
        lowDemandDiscountPercent: 10,
        manoeuvreOvertimeThresholdHours: 8,
        manoeuvreOvertimeHourlyRate: 0,
      }),
    assemblyPrice: z.number().int().min(0).max(1000000),
    montageP: z
      .record(
        z.string().min(1).max(60),
        z.union([
          z.number().int().min(0).max(10000000),
          z.object({
            local: z.number().int().min(0).max(10000000).optional(),
            import: z.number().int().min(0).max(10000000).optional(),
            u: z.number().int().min(0).max(10000000).optional(),
            uI: z.number().int().min(0).max(10000000).optional(),
            sz: z
              .record(
                z.string(),
                z.object({
                  local: z.number().int().min(0).max(10000000).optional(),
                  import: z.number().int().min(0).max(10000000).optional(),
                }),
              )
              .optional(),
          }),
        ]),
      )
      .default({}),
    businessPhone: z.union([z.literal(''), phoneNumberSchema]).default(''),
    whatsappPhone: phoneNumberSchema,
    whatsappCountryCode: z
      .string()
      .regex(/^[1-9][0-9]{0,3}$/)
      .default('221'),
    whatsappMode: z.enum(['api', 'wame', 'web', 'app']).default('api'),
    whatsappQuoteTemplate: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .default(
        'Bonjour {nom},\n\nVoici votre devis final Demenag Express n° {num} :\n- Date : {date}{heure}\n- Trajet : {trajet}\n- Véhicule : {vehicule}, {voyages}\n- Montant total : {total}\n\nCe montant est définitif.\nJe vous envoie le PDF du devis final juste après ce message.\n\nMerci pour votre confiance.',
      ),
    whatsappProvisionalTemplate: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .default(
        'Bonjour {nom},\n\nMerci pour votre demande. Voici votre devis provisoire Demenag Express n° {num} :\n- Date : {date}{heure}\n- Trajet : {trajet}\n- Véhicule : {vehicule}, {voyages}\n- Montant estimé : {total}\n\nCe montant est une estimation établie d’après votre inventaire. Il sera confirmé par le devis final.\nJe vous envoie le PDF du devis juste après ce message.\n\nPour confirmer ou modifier votre demande, répondez simplement ici.',
      ),
    contactFirstTemplate: z.string().max(200).default('{ref} {prenom}'),
    contactLastTemplate: z.string().max(200).default('{nom} · {date}'),
    businessName: z.string().trim().min(2).max(100),
    businessAddress: z.string().trim().max(300).default(''),
    businessEmail: z.string().trim().max(200).default(''),
    businessNinea: z.string().trim().max(100).default(''),
    businessRccm: z.string().trim().max(100).default(''),
    quoteValidityDays: z.number().int().min(0).max(365).default(15),
    bookingDepositPercent: z.number().int().min(0).max(100).default(0),
    quoteTerms: z.string().max(10000).default(''),
    quoteTermsEnabled: z.boolean().default(true),
    rentalOvertimeHourlyRate: z.number().int().min(0).max(10000000).default(10000),
    rentalKitConfiguration: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          label: z.string().trim().min(1).max(200),
          rule: z.enum([
            'vehicle',
            'one',
            'blankets',
            'liftingStraps',
            'gloves',
            'tieDownStraps',
            'fixed',
          ]),
          quantity: z.number().int().min(0).max(10000).optional(),
          image: z.string().max(3000000).optional(),
        }),
      )
      .max(100)
      .default([]),
    invoiceFooter: z.string().trim().min(2).max(500),
    tiktokUrl: socialUrlSchema,
    facebookUrl: socialUrlSchema,
    instagramUrl: socialUrlSchema,
    invoiceLogo: imageSchema.nullable(),
    invoiceStamp: imageSchema.nullable(),
    invoiceSignature: imageSchema.nullable(),
    paymentWave: z.boolean().default(true),
    paymentCash: z.boolean().default(true),
    paymentQr: imageSchema.nullable().default('/assets/wave-qr.png'),
    questionnaire: z
      .array(clientQuestionSchema)
      .max(100)
      .refine(
        (questions) => new Set(questions.map((question) => question.id)).size === questions.length,
      )
      .default([]),
    customInventoryTypes: z
      .array(
        z.object({
          k: z.string().regex(/^u[a-z0-9-]{1,40}$/),
          n: z.string().trim().min(1).max(100),
          p: z.string().trim().max(120).optional(),
          sec: z.string().trim().min(1).max(80),
          like: z.string().max(100).optional(),
          L: z.number().finite().min(0).max(100000).or(z.literal('')).optional(),
          W: z.number().finite().min(0).max(100000).or(z.literal('')).optional(),
          H: z.number().finite().min(0).max(100000).or(z.literal('')).optional(),
          kg: z.number().finite().min(0).max(100000).or(z.literal('')).optional(),
          menuPriceLocal: z.number().int().min(0).max(10000000).or(z.literal('')).optional(),
          menuPriceImport: z.number().int().min(0).max(10000000).or(z.literal('')).optional(),
          dm: z.boolean().optional(),
          up: z.boolean().optional(),
          frag: z.boolean().optional(),
          notop: z.boolean().optional(),
        }),
      )
      .max(100)
      .optional(),
    hiddenInventoryKeys: z.array(z.string().max(100)).max(100).optional(),
  }),
});

export const employeeProofSchema = z.object({
  kind: z.enum(['retrait', 'depot']),
  photos: z.array(imageSchema).min(1).max(20),
});
const employeeCheckItem = z.object({ image: imageSchema, ok: z.boolean() });
export const employeeInspectionSchema = z
  .object({
    vehicleId: z.string().min(1),
    items: z.object({
      engineOil: employeeCheckItem,
      brakeFluid: employeeCheckItem,
      coolant: employeeCheckItem,
      washerFluid: employeeCheckItem,
      fuel: employeeCheckItem,
    }),
  })
  .transform(({ vehicleId, items }) => ({
    vehicleId,
    reference: true,
    levels: Object.fromEntries(
      Object.entries(items).map(([key, item]) => [
        key,
        item.ok ? ('good' as const) : ('low' as const),
      ]),
    ),
    condition: Object.values(items).every((item) => item.ok)
      ? ('good' as const)
      : ('attention' as const),
    notes: '',
    photos: Object.values(items).map((item) => item.image),
  }));
