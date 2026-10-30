import type { Express } from 'express';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import {
  adminProfileSchema,
  catalogueSchema,
  createDriverSchema,
  driverSchema,
  tollPointCreateSchema,
  tollPointSchema,
} from './schemas.js';
import { apiRoutes } from './routes.js';
import { adminPasswordResetSchema } from './validation/auth.js';
import { accountSchema, createAccountSchema, userIdSchema } from './validation/administration.js';
import { z } from 'zod';
const accountingMonthValue = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const clientPhoneSchema = z.string().regex(/^\d{9}$/);
const employeeProofUpdateSchema = z
  .object({
    kind: z.enum(['retrait', 'depot']).optional(),
    image: z
      .string()
      .max(7_000_000)
      .regex(/^(\/assets\/[a-z0-9-]+\.(png|jpg|jpeg|webp)|data:image\/(png|jpeg|webp);base64,)/i)
      .optional(),
    note: z.string().max(500).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Aucune modification à enregistrer.');
const inspectionItemUpdateSchema = z.object({
  key: z.enum(['engineOil', 'brakeFluid', 'coolant', 'washerFluid', 'fuel']),
  good: z.boolean(),
});
const clientUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().min(9).max(25),
  address: z.string().trim().max(300).default(''),
});
const accountingMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const accountingEntryFields = {
  label: z.string().trim().min(2).max(200),
  amount: z.number().int().positive().max(1_000_000_000),
  date: z.iso.date(),
};
const accountingEntrySchema = z.discriminatedUnion('type', [
  z.object({
    ...accountingEntryFields,
    type: z.literal('charge'),
    category: z.enum([
      'Salaires',
      'Manœuvres',
      'Menuisier',
      'Carburant',
      'Entretien véhicule',
      'Assurance',
      'Loyer',
      'Téléphone / Internet',
      'Publicité',
      'Péage / Parking',
      'Impôts et taxes',
      'Autre charge',
    ]),
  }),
  z.object({
    ...accountingEntryFields,
    type: z.literal('revenu'),
    category: z.enum(['Déménagement', 'Location véhicule', 'Autre revenu']),
  }),
]);
const accountingConfigurationSchema = z.object({
  regime: z.enum(['auto', 'informel', 'suarl']),
  suarlFrom: z.union([z.literal(''), accountingMonthValue]),
  isRate: z.number().min(0).max(100),
  start: accountingMonthValue,
  debt: z.number().int().min(0).max(10_000_000_000),
  debtMonths: z.number().int().min(1).max(600),
  fleetValue: z.number().int().min(0).max(10_000_000_000),
  fleetYears: z.number().int().min(1).max(100),
  newVehicleTarget: z.number().int().min(0).max(10_000_000_000),
  profitCapPercent: z.number().min(0).max(100),
  moverCostPerMove: z.number().int().min(0).max(1_000_000_000),
  menuPrices: z.record(
    z.string().max(80),
    z.object({
      local: z.number().int().min(0).max(1_000_000_000).optional(),
      import: z.number().int().min(0).max(1_000_000_000).optional(),
      sz: z
        .record(
          z.string().regex(/^\d{1,2}$/),
          z.object({
            local: z.number().int().min(0).max(1_000_000_000).optional(),
            import: z.number().int().min(0).max(1_000_000_000).optional(),
          }),
        )
        .optional(),
    }),
  ),
  salaries: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().trim().max(120),
        amount: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .max(100),
  annexes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().trim().max(120),
        value: z.number().int().min(0).max(10_000_000_000),
        years: z.number().int().min(1).max(100),
      }),
    )
    .max(100),
  vehiclePurchases: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        month: accountingMonthValue,
        price: z.number().int().min(0).max(10_000_000_000),
      }),
    )
    .max(100),
  advertising: z
    .record(
      accountingMonthValue,
      z.record(z.string().max(80), z.number().int().min(0).max(1_000_000_000)),
    )
    .refine(
      (entries) => Object.values(entries).every((value) => Object.keys(value).length <= 30),
      'Trop de canaux publicitaires pour un mois.',
    )
    .refine((entries) => Object.keys(entries).length <= 240, 'Trop de périodes publicitaires.'),
});
export function registerAdminRoutes(
  app: Express,
  deps: Pick<
    Dependencies,
    'administration' | 'catalogue' | 'drivers' | 'accounting' | 'vehicleReports'
  >,
  access: Pick<Access, 'authenticate' | 'admin'>,
) {
  const { authenticate, admin } = access;
  app.patch(apiRoutes.adminEmployeeProof, authenticate, admin, async (req, res) =>
    res.json(
      await deps.drivers.updateEmployeeProof(
        getActor(res),
        z.uuid().parse(req.params.bookingId),
        z.string().min(1).max(100).parse(req.params.proofId),
        employeeProofUpdateSchema.parse(req.body),
      ),
    ),
  );
  app.delete(apiRoutes.adminEmployeeProof, authenticate, admin, async (req, res) =>
    res.json(
      await deps.drivers.deleteEmployeeProof(
        getActor(res),
        z.uuid().parse(req.params.bookingId),
        z.string().min(1).max(100).parse(req.params.proofId),
      ),
    ),
  );
  app.patch(`${apiRoutes.adminVehicleInspection}/item`, authenticate, admin, async (req, res) => {
    const input = inspectionItemUpdateSchema.parse(req.body);
    res.json(
      await deps.vehicleReports.updateInspectionLevel(
        getActor(res),
        z.uuid().parse(req.params.id),
        input.key,
        input.good,
      ),
    );
  });
  app.delete(apiRoutes.adminVehicleInspection, authenticate, admin, async (req, res) => {
    await deps.vehicleReports.deleteInspection(getActor(res), z.uuid().parse(req.params.id));
    res.status(204).end();
  });
  app.get(apiRoutes.administration.accounting, authenticate, admin, async (req, res) => {
    const month =
      req.query.month === undefined ? undefined : accountingMonthSchema.parse(req.query.month);
    res.json(await deps.accounting.list(getActor(res), month));
  });
  app.get(
    apiRoutes.administration.accountingConfiguration,
    authenticate,
    admin,
    async (_req, res) => res.json(await deps.accounting.configuration(getActor(res))),
  );
  app.put(
    apiRoutes.administration.accountingConfiguration,
    authenticate,
    admin,
    async (req, res) => {
      await deps.accounting.saveConfiguration(
        getActor(res),
        accountingConfigurationSchema.parse(req.body),
      );
      res.status(204).end();
    },
  );
  app.post(apiRoutes.administration.accounting, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(await deps.accounting.create(getActor(res), accountingEntrySchema.parse(req.body))),
  );
  app.delete(
    `${apiRoutes.administration.accounting}/:id`,
    authenticate,
    admin,
    async (req, res) => {
      await deps.accounting.void(getActor(res), userIdSchema.parse(req.params.id));
      res.status(204).end();
    },
  );
  app.get(apiRoutes.administration.profile, authenticate, admin, async (_req, res) =>
    res.json(getActor(res)),
  );
  app.put(apiRoutes.administration.profile, authenticate, admin, async (req, res) =>
    res.json(
      await deps.administration.updateProfile(getActor(res), adminProfileSchema.parse(req.body)),
    ),
  );
  app.get(apiRoutes.administration.users, authenticate, admin, async (_req, res) =>
    res.json(await deps.administration.listUsers(getActor(res))),
  );
  app.get(apiRoutes.administration.clients, authenticate, admin, async (_req, res) =>
    res.json(await deps.administration.listClientProfiles(getActor(res))),
  );
  app.get(`${apiRoutes.administration.clients}/hidden`, authenticate, admin, async (_req, res) =>
    res.json(await deps.administration.listHiddenClients(getActor(res))),
  );
  app.patch(`${apiRoutes.administration.clients}/:phone`, authenticate, admin, async (req, res) => {
    const input = clientUpdateSchema.parse(req.body);
    await deps.administration.updateClient(
      getActor(res),
      clientPhoneSchema.parse(req.params.phone),
      input.name,
      input.phone,
      input.address,
    );
    res.status(204).end();
  });
  app.delete(`${apiRoutes.administration.clients}/:phone`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.administration.hideClient(
        getActor(res),
        clientPhoneSchema.parse(req.params.phone),
      ),
    ),
  );
  app.post(apiRoutes.administration.users, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.administration.createUser(getActor(res), createAccountSchema.parse(req.body)),
      ),
  );
  app.put(`${apiRoutes.administration.users}/:id`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.administration.updateUser(getActor(res), {
        ...accountSchema.parse(req.body),
        id: userIdSchema.parse(req.params.id),
      }),
    ),
  );
  app.post(apiRoutes.administration.userPasswordReset, authenticate, admin, async (req, res) => {
    const { password } = adminPasswordResetSchema.parse(req.body);
    await deps.administration.resetClientPassword(
      getActor(res),
      userIdSchema.parse(req.params.id),
      password,
    );
    res.status(204).end();
  });
  app.put(apiRoutes.catalogue, authenticate, admin, async (req, res) => {
    const p = catalogueSchema.parse(req.body);
    await deps.catalogue.update(getActor(res), p.vehicles, p.settings);
    res.json(await deps.catalogue.get());
  });
  app.delete(`${apiRoutes.catalogue}/vehicles/:id`, authenticate, admin, async (req, res) => {
    const id = z
      .string()
      .regex(/^[a-z0-9-]{1,30}$/)
      .parse(req.params.id);
    await deps.catalogue.removeVehicle(getActor(res), id);
    res.status(204).end();
  });
  app.post(apiRoutes.tollPoints, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.catalogue.createTollPoint(getActor(res), tollPointCreateSchema.parse(req.body)),
      ),
  );
  app.put(`${apiRoutes.tollPoints}/:id`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.catalogue.updateTollPoint(
        getActor(res),
        userIdSchema.parse(req.params.id),
        tollPointSchema.parse(req.body),
      ),
    ),
  );
  app.delete(`${apiRoutes.tollPoints}/:id`, authenticate, admin, async (req, res) => {
    await deps.catalogue.deleteTollPoint(getActor(res), userIdSchema.parse(req.params.id));
    res.status(204).end();
  });
  app.get(apiRoutes.administration.drivers, authenticate, admin, async (_req, res) =>
    res.json(await deps.drivers.list(getActor(res))),
  );
  app.post(apiRoutes.administration.drivers, authenticate, admin, async (req, res) =>
    res
      .status(201)
      .json(await deps.drivers.create(getActor(res), createDriverSchema.parse(req.body))),
  );
  app.put(`${apiRoutes.administration.drivers}/:id`, authenticate, admin, async (req, res) =>
    res.json(
      await deps.drivers.update(getActor(res), {
        ...driverSchema.parse(req.body),
        id: userIdSchema.parse(req.params.id),
      }),
    ),
  );
  app.delete(`${apiRoutes.administration.drivers}/:id`, authenticate, admin, async (req, res) =>
    res.json(await deps.drivers.remove(getActor(res), userIdSchema.parse(req.params.id))),
  );
}
