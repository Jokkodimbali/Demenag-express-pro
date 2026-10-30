import { z } from 'zod';
import { messages } from '../../../domain/messages/fr.js';
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
      stairs: z.enum(['oui', 'non', 'verif', '']).optional(),
      custom: z
        .array(
          z.object({
            id: z.string().max(100),
            label: z.string().max(120),
            quantity: z.number().int().min(0).max(999),
            format: z.enum(['small', 'medium', 'large']).optional(),
            dismantle: z.boolean().optional(),
            origin: z.enum(['local', 'import']).optional(),
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
  stairs: z.enum(['oui', 'non', 'verif', '']),
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
});
export const adminEstimateSchema = estimateSchema.extend({
  distanceKmOverride: z.number().min(0).max(100000),
});
export const bookingSchema = estimateSchema
  .extend({
    distanceKmOverride: z.number().min(0).max(100000).nullable().optional(),
    customerName: z.string().trim().min(2).max(100),
    customerPhone: z.string().trim().min(9).max(25),
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
    inventorySnapshot: inventorySnapshotSchema.optional(),
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
export const loginSchema = z.object({
  phone: z.string().min(9).max(25),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema
  .extend({
    name: z.string().trim().min(2).max(100),
    password: z
      .string()
      .min(
        8,
        'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.',
      )
      .max(128),
  })
  .refine((input) => /[a-zA-Z]/.test(input.password) && /\d/.test(input.password), {
    path: ['password'],
    message:
      'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.',
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
        quantity: z.number().int().min(1).max(100),
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
  phone: z.string().trim().min(9).max(25),
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
  password: z.string().min(10, messages.utilisezAuMoins10Caracteres).max(128).optional(),
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
      })
      .default({
        maxHandlingHours: 3,
        maxDayHours: 8,
        defaultStartHour: 8,
        maxMoversPerVehicle: 6,
        cubicMetersPerHourPerMover: 2.5,
        pauseMinutes: 30,
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
    businessPhone: z.string().regex(/^\+221[0-9]{9}$/),
    whatsappPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
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
        'Bonjour {nom}, votre déménagement est terminé. Voici votre devis final Demenag Express {num} : {total} ({allers} aller(s)-retour(s), {vehicule}). Le PDF est disponible dans votre espace client. Merci !',
      ),
    businessName: z.string().trim().min(2).max(100),
    businessAddress: z.string().trim().min(2).max(300),
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
