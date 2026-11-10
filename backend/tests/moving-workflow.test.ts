import assert from 'node:assert/strict';
import test from 'node:test';
import { MovingService } from '../src/application/services/moving.js';
import type {
  BookingRepository,
  CatalogueRepository,
  DriverRepository,
} from '../src/application/ports/index.js';
import type {
  Booking,
  BookingInput,
  BookingInventorySnapshot,
  Catalogue,
  Driver,
  Settings,
  User,
} from '../src/domain/model.js';

const now = new Date('2026-10-22T12:00:00.000Z');
const admin: User = { id: 'admin-1', name: 'Admin', phone: '+221770000001', role: 'admin' };
const driverUser: User = {
  id: 'driver-user-1',
  name: 'Chauffeur',
  phone: '+221770000002',
  role: 'driver',
};
const client: User = { id: 'client-1', name: 'Client', phone: '+221770000003', role: 'client' };
const driver: Driver = {
  id: 'driver-1',
  userId: driverUser.id,
  name: driverUser.name,
  phone: driverUser.phone,
  photo: null,
  active: true,
  vehicleId: 'vehicle-1',
};

function harness() {
  let booking: Booking = {
    id: 'booking-1',
    reference: 'DEM-2026-BOOKING1',
    userId: client.id,
    driverId: driver.id,
    customerName: client.name,
    phone: client.phone,
    vehicle: {
      id: 'vehicle-1',
      name: 'Camion test',
      volume: '20 m³',
      length: '6 m',
      height: '3 m',
      width: '2 m',
      wheelWidth: '1 m',
      image: '',
      interior: '',
      prices: [10000, 20000, 30000],
    },
    fromAddress: 'Dakar',
    toAddress: 'Thiès',
    from: [14.7, -17.4],
    to: [14.8, -16.9],
    distanceKm: 70,
    date: '2026-10-22',
    timeSlot: '08:00',
    options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    notes: '',
    status: 'confirmed',
    estimate: { lines: [], total: 30000, discount: 0, tier: 1, trips: 1, currency: 'XOF' },
    quotes: [],
    trips: [],
    workPlan: [
      {
        id: 'plan-1',
        time: '08:00',
        title: 'Chargement',
        detail: 'Charger le mobilier',
        minutes: 90,
        review: { status: 'pending', reason: '', checkedAt: null, checkedBy: null },
      },
    ],
    createdAt: now.toISOString(),
    version: 1,
  };
  const bookings = {
    list: async () => [booking],
    find: async (id: string) => (id === booking.id ? booking : null),
    update: async (next: Booking, expectedVersion: number) => {
      assert.equal(booking.version, expectedVersion);
      booking = { ...next, version: expectedVersion + 1 };
      return booking;
    },
    startTrip: async (_id: string, photos: string[]) => {
      const sequence = (booking.trips?.length ?? 0) + 1;
      booking = {
        ...booking,
        trips: [
          ...(booking.trips ?? []),
          {
            id: `trip-${sequence}`,
            sequence,
            loadingPhotos: photos,
            unloadingPhotos: null,
            startedAt: now.toISOString(),
            finishedAt: null,
          },
        ],
      };
    },
    addTripLoadingPhotos: async (_id: string, photos: string[]) => {
      booking = {
        ...booking,
        trips: booking.trips?.map((trip) =>
          !trip.finishedAt ? { ...trip, loadingPhotos: photos } : trip,
        ),
      };
    },
    finishTrip: async (_id: string, photos: string[]) => {
      booking = {
        ...booking,
        trips: booking.trips?.map((trip) => ({
          ...trip,
          unloadingPhotos: photos,
          finishedAt: now.toISOString(),
        })),
      };
    },
  } as unknown as BookingRepository;
  const settings = {
    bookingsEnabled: true,
    maxAdvanceDays: 366,
    distanceBounds: [15, 25, 35],
    maxTrips: 20,
    maxOptions: 20,
    labourPrice: 5000,
    labourFloorPrice: 500,
    labourLiftPrice: 500,
    assemblyPrice: 5000,
    enabledSlots: [{ label: 'Matin', startHour: 9 }],
    minNoticeHours: 0,
    montageP: {},
  } as Settings;
  const catalogue = {
    get: async () => ({ vehicles: [booking.vehicle], settings }) as Catalogue,
    listTollPoints: async () => [],
  } as unknown as CatalogueRepository;
  const drivers = {
    findByUserId: async (userId: string) =>
      userId === driverUser.id ? driver : { ...driver, id: 'driver-other', userId },
    find: async () => driver,
  } as unknown as DriverRepository;
  const service = new MovingService(
    bookings,
    catalogue,
    {
      find: async (id: string) =>
        id === 'route-for-update'
          ? {
              id,
              from: booking.from,
              to: booking.to,
              distanceKm: booking.distanceKm,
              durationMinutes: 20,
              geometry: [booking.from, booking.to],
              expiresAt: new Date(now.getTime() + 60_000).toISOString(),
            }
          : null,
    } as never,
    {
      route: async (from: [number, number], to: [number, number]) => ({
        from,
        to,
        distanceKm: 10,
        durationMinutes: 20,
        geometry: [from, to],
      }),
      reverse: async (point: [number, number]) =>
        point[0] === 14.7 ? 'Nouvelle adresse de départ' : 'Thiès',
    } as never,
    drivers,
    { now: () => now },
    { next: () => 'generated-id' },
  );
  return {
    service,
    getBooking: () => booking,
    setInventorySnapshot: (inventorySnapshot: BookingInventorySnapshot) => {
      booking = { ...booking, inventorySnapshot };
    },
    setWorkPlan: (workPlan: Booking['workPlan']) => {
      booking = { ...booking, workPlan };
    },
    setQuotes: (quotes: Booking['quotes']) => {
      booking = { ...booking, quotes };
    },
    addFinalQuote: () => {
      booking = {
        ...booking,
        quotes: [
          {
            id: 'quote-1',
            reference: 'DV-2026-QUOTE1',
            kind: 'final',
            createdAt: now.toISOString(),
            price: { lines: [], total: 30000, discount: 0, tier: 1, trips: 1, currency: 'XOF' },
            notes: '',
          },
        ],
      };
    },
  };
}

test('un devis final au-delà du dernier palier exige un prix de transport positif', async () => {
  const { service, getBooking } = harness();
  const booking = getBooking();
  const input = {
    kind: 'final' as const,
    trips: 1,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    tolls: [],
    options: booking.options,
    version: booking.version,
  };

  await assert.rejects(service.quote(admin, booking.id, input), /Distance au-delà de 35 km/u);
  assert.equal(getBooking().quotes.length, 0);

  const saved = await service.quote(admin, booking.id, { ...input, customPrice: 25000 });
  assert.equal(saved.quotes[0]?.price.lines[0]?.unitPrice, 25000);
  assert.equal(saved.quotes[0]?.price.total, 25000);
});

test('un devis provisoire conserve le supplément balcon à fixer comme dans la référence', async () => {
  const { service, getBooking, setInventorySnapshot } = harness();
  const booking = getBooking();
  setInventorySnapshot({
    sourceInventory: {
      dwellingType: '',
      fromFloor: 0,
      toFloor: 0,
      fromLift: false,
      toLift: false,
      ready: '',
      stairs: 'balcon',
      balcPx: 0,
      entries: {},
      variants: [],
      flags: {},
      custom: [],
    },
    dwellingType: '',
    annexIncluded: false,
    annexVolumeM3: 0,
    fromFloor: 0,
    toFloor: 0,
    fromLift: false,
    toLift: false,
    ready: '',
    stairs: 'balcon',
    balcPx: 0,
    flags: [],
    items: [],
    itemCount: 0,
    totalVolumeM3: 0,
    vehicleCapacityM3: 20,
    fillRate: 0.85,
    estimatedTrips: 1,
    moverCount: 0,
    carpenterCount: 0,
    loadingMinutes: 0,
    unloadingMinutes: 0,
    packingMinutes: 0,
    travelMinutes: 0,
    totalMinutes: 0,
    lowDurationMinutes: 0,
    highDurationMinutes: 0,
    startTime: '08:00',
    endTime: '08:00',
  });
  const updated = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 1,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    tolls: [],
    options: booking.options,
    version: booking.version,
  });

  assert.deepEqual(updated.quotes[0]?.price.lines.at(-1), {
    label: 'Supplément passage par le balcon (à fixer)',
    quantity: 1,
    unitPrice: 0,
    total: 0,
  });
});

test('seule l’administration peut enregistrer un rappel de réservation', async () => {
  const { service, getBooking } = harness();
  await assert.rejects(service.recordBookingReminder(client, 'booking-1'), (error: unknown) => {
    return error instanceof Error && 'status' in error && error.status === 403;
  });
  await assert.rejects(service.recordBookingReminder(driverUser, 'booking-1'), (error: unknown) => {
    return error instanceof Error && 'status' in error && error.status === 403;
  });

  const updated = await service.recordBookingReminder(admin, 'booking-1');
  assert.equal(updated.reminders?.length, 1);
  assert.equal(updated.reminders?.[0]?.daysBefore, 0);
  assert.equal(getBooking().reminders?.length, 1);
});

test('admin edit clears an emptied inventory snapshot and its work plan', async () => {
  const { service, getBooking, setInventorySnapshot } = harness();
  setInventorySnapshot({
    sourceInventory: {
      dwellingType: 'T2',
      fromFloor: 0,
      toFloor: 0,
      fromLift: false,
      toLift: false,
      entries: {},
      variants: [],
      flags: {},
      custom: [],
    },
    dwellingType: 'T2',
    annexIncluded: false,
    annexVolumeM3: 0,
    fromFloor: 0,
    toFloor: 0,
    fromLift: false,
    toLift: false,
    ready: '',
    stairs: '',
    flags: [],
    items: [],
    itemCount: 0,
    totalVolumeM3: 0,
    vehicleCapacityM3: 20,
    fillRate: 0,
    estimatedTrips: 1,
    moverCount: 0,
    carpenterCount: 0,
    loadingMinutes: 0,
    unloadingMinutes: 0,
    packingMinutes: 0,
    travelMinutes: 20,
    totalMinutes: 20,
    lowDurationMinutes: 20,
    highDurationMinutes: 20,
    startTime: '08:00',
    endTime: '08:20',
  });
  const booking = getBooking();
  const input: BookingInput = {
    vehicleId: booking.vehicle.id,
    routeId: 'route-for-update',
    trips: 1,
    customerName: booking.customerName,
    customerPhone: booking.phone,
    fromAddress: booking.fromAddress,
    toAddress: booking.toAddress,
    date: booking.date,
    month: '2026-10',
    timeSlot: booking.timeSlot,
    options: booking.options,
    notes: '',
    questionnaireAnswers: [],
    workPlan: [],
    inventorySnapshot: null,
    requestId: '00000000-0000-4000-8000-000000000001',
  };

  const updated = await service.updateAdminRequest(admin, booking.id, input, booking.version);

  assert.equal(updated.inventorySnapshot, undefined);
  assert.deepEqual(updated.workPlan, []);
});

test('admin route change recalculates the latest provisional quote and flags the changed address', async () => {
  const { service, getBooking, setQuotes } = harness();
  const options = { labour: 0, desk: 0, wardrobe: 0, bed: 0 };
  setQuotes([
    {
      id: 'quote-provisional',
      reference: 'DV-2026-PROVISIONAL',
      kind: 'provisional',
      createdAt: now.toISOString(),
      price: { lines: [], total: 30000, discount: 0, tier: 3, trips: 1, currency: 'XOF' },
      notes: '',
      options,
      pricingInput: {
        settings: {
          distanceBounds: [15, 25, 35],
          maxTrips: 20,
          maxOptions: 20,
          labourPrice: 5000,
          labourFloorPrice: 500,
          labourLiftPrice: 500,
          assemblyPrice: 5000,
          montageP: {},
        },
        trips: 1,
        customPrice: 30000,
        discount: 0,
        discountType: 'fcfa',
        discountReason: '',
        options,
        labourUnitPriceOverride: null,
        extraLines: [],
      },
    },
  ]);
  const originalVersion = getBooking().version;

  const updated = await service.updateRoute(
    admin,
    'booking-1',
    [14.7, -17.5],
    getBooking().to,
    originalVersion,
  );

  assert.equal(updated.fromAddress, 'Nouvelle adresse de départ');
  assert.equal(updated.distanceKm, 10);
  assert.equal(updated.quotes[0]?.reference, 'DV-2026-PROVISIONAL');
  assert.equal(updated.quotes[0]?.price.total, 10000);
  assert.deepEqual(updated.crewAddressChange, { from: true, to: false, at: now.toISOString() });
});

test('admin cannot change a route after a final quote exists', async () => {
  const { service, getBooking, addFinalQuote } = harness();
  addFinalQuote();

  await assert.rejects(
    service.updateRoute(admin, 'booking-1', [14.7, -17.5], getBooking().to, getBooking().version),
    /devis final/u,
  );
});

test('admin can review a reference fallback step when no work plan was saved', async () => {
  const { service, getBooking, setWorkPlan } = harness();
  setWorkPlan([]);
  const updated = await service.reviewWorkPlan(
    admin,
    'booking-1',
    'fallback-1',
    'late',
    'Retard au départ',
    getBooking().version,
    '08:20',
  );
  assert.equal(updated.workPlan?.length, 3);
  assert.deepEqual(
    updated.workPlan?.map((step) => step.title),
    ['Arrivée au départ', 'Déménagement', 'Vérification finale'],
  );
  assert.equal(updated.workPlan?.[0]?.review.status, 'late');
  assert.equal(updated.workPlan?.[0]?.review.actualTime, '08:20');
});

test('admin can start and finish courses without photos, then close with a final quote', async () => {
  const scenario = harness();
  const { service, getBooking, addFinalQuote } = scenario;

  await assert.rejects(
    service.status(admin, 'booking-1', 'in_progress', getBooking().version),
    /Démarrez une course depuis les actions/u,
  );
  await service.startTrip(admin, 'booking-1', []);
  assert.equal(getBooking().status, 'in_progress');
  assert.deepEqual(getBooking().trips?.[0]?.loadingPhotos, []);

  await assert.rejects(service.startTrip(driverUser, 'booking-1', ['/loading.jpg']));
  await service.startTrip(admin, 'booking-1', ['/admin-loading.jpg']);
  await assert.rejects(service.startTrip(admin, 'booking-1', []), /Une course est déjà en cours/u);

  await assert.rejects(service.finishTrip(driverUser, 'booking-1', ['/unloading.jpg']));
  await service.finishTrip(admin, 'booking-1', []);
  await assert.rejects(service.finishDriverWork(driverUser, 'booking-1'));
  await service.finishDriverWork(admin, 'booking-1');
  assert.ok(getBooking().driverFinishedAt);
  assert.deepEqual(getBooking().trips?.[0]?.unloadingPhotos, []);

  await assert.rejects(service.status(admin, 'booking-1', 'completed', getBooking().version));
  addFinalQuote();
  const completed = await service.status(admin, 'booking-1', 'completed', getBooking().version);
  assert.equal(completed.status, 'completed');
});

test('driver cannot change reservation status or course history; admin controls course progression', async () => {
  const { service } = harness();
  await assert.rejects(
    service.status(driverUser, 'booking-1', 'cancelled', 1),
    (error: unknown) =>
      error instanceof Error &&
      'status' in error &&
      error.status === 403 &&
      /Le chauffeur ne peut pas modifier la réservation/u.test(error.message),
  );
  await assert.rejects(service.startTrip(driverUser, 'booking-1', ['/loading.jpg']));
  await assert.rejects(service.finishTrip(driverUser, 'booking-1', ['/unloading.jpg']));
  await assert.rejects(service.finishDriverWork(driverUser, 'booking-1'));
  await assert.rejects(service.startTrip(client, 'booking-1', []), /réservée à l’administration/u);
});

test('un client ne peut pas créer ou modifier une réservation sans date', async () => {
  const { service } = harness();
  const input: BookingInput = {
    vehicleId: 'vehicle-1',
    routeId: 'route-for-update',
    customerName: 'Client test',
    customerPhone: '+221770000003',
    fromAddress: 'Dakar',
    toAddress: 'Thiès',
    date: null,
    timeSlot: '',
    options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
    notes: '',
    requestId: '123e4567-e89b-42d3-a456-426614174000',
  };
  await assert.rejects(service.create(client, input), /Choisissez une date/u);
  await assert.rejects(
    service.create(client, { ...input, date: '2026-10-23', timeSlot: '08:00' }),
    /créneau n’est plus disponible/u,
  );
  await assert.rejects(
    service.updateClientRequest(client, 'booking-1', input, 1),
    /Choisissez une date/u,
  );
});

test('driver can access and manage only bookings assigned to their employee profile', async () => {
  const { service } = harness();
  assert.deepEqual(await service.list(driverUser), [await service.get(driverUser, 'booking-1')]);
  assert.equal((await service.get(driverUser, 'booking-1')).id, 'booking-1');
  await assert.rejects(
    service.create(driverUser, {} as BookingInput),
    /création d’une réservation est réservée/u,
  );
  const otherDriver = { ...driverUser, id: 'other-driver' };
  assert.deepEqual(await service.list(otherDriver), []);
  await assert.rejects(service.get(otherDriver, 'booking-1'));
  await assert.rejects(service.startTrip(otherDriver, 'booking-1', ['/loading.jpg']));
  await assert.rejects(
    service.reviewWorkPlan(otherDriver, 'booking-1', 'plan-1', 'respected', '', 1),
  );
});

test('client can change only the schedule of their own open reservation', async () => {
  const { service, getBooking, addFinalQuote } = harness();
  const changed = await service.schedule(client, 'booking-1', '2026-10-25', '09:00', 1);
  assert.equal(changed.date, '2026-10-25');
  assert.equal(changed.timeSlot, '09:00');
  await assert.rejects(
    service.schedule(
      { ...client, id: 'another-client' },
      'booking-1',
      '2026-10-26',
      '10:00',
      getBooking().version,
    ),
  );
  await assert.rejects(
    service.schedule(driverUser, 'booking-1', '2026-10-26', '10:00', getBooking().version),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 403,
  );
  addFinalQuote();
  await assert.rejects(
    service.schedule(client, 'booking-1', '2026-10-26', '10:00', getBooking().version),
  );
});

test('client can update their own open reservation notes only', async () => {
  const { service, getBooking, addFinalQuote } = harness();
  const changed = await service.updateNotes(client, 'booking-1', 'Précisions client', 1);
  assert.equal(changed.notes, 'Précisions client');
  await assert.rejects(
    service.updateNotes(
      { ...client, id: 'another-client' },
      'booking-1',
      'Refusé',
      getBooking().version,
    ),
  );
  await assert.rejects(
    service.updateNotes(driverUser, 'booking-1', 'Refusé', getBooking().version),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 403,
  );
  addFinalQuote();
  await assert.rejects(service.updateNotes(client, 'booking-1', 'Refusé', getBooking().version));
});

test('seule l’administration peut modifier le suivi du planning', async () => {
  const { service, getBooking } = harness();
  await assert.rejects(
    service.reviewWorkPlan(driverUser, 'booking-1', 'plan-1', 'not_respected', 'Retard.', 1),
    /Action réservée à l’administration/u,
  );

  const adminChecked = await service.reviewWorkPlan(
    admin,
    'booking-1',
    'plan-1',
    'respected',
    '',
    getBooking().version,
  );
  assert.equal(adminChecked.workPlan?.[0]?.review.status, 'respected');
  assert.equal(adminChecked.workPlan?.[0]?.review.reason, '');
  assert.equal(adminChecked.workPlan?.[0]?.review.checkedBy, admin.name);
  const late = await service.reviewWorkPlan(
    admin,
    'booking-1',
    'plan-1',
    'late',
    '',
    getBooking().version,
    '09:15',
    'data:image/jpeg;base64,AA==',
  );
  assert.equal(late.workPlan?.[0]?.review.status, 'late');
  assert.equal(late.workPlan?.[0]?.review.actualTime, '09:15');
  assert.equal(late.workPlan?.[0]?.review.photo, 'data:image/jpeg;base64,AA==');
  const qhse = await service.reviewWorkPlan(
    admin,
    'booking-1',
    'plan-1',
    'late',
    'Circulation ralentie',
    getBooking().version,
    '09:15',
    undefined,
    { cause: 'Circulation', severity: 'maj', correctiveAction: 'Prévoir un départ plus tôt' },
  );
  assert.equal(qhse.workPlan?.[0]?.review.cause, 'Circulation');
  assert.equal(qhse.workPlan?.[0]?.review.severity, 'maj');
  assert.equal(qhse.workPlan?.[0]?.review.correctiveAction, 'Prévoir un départ plus tôt');
  const pending = await service.reviewWorkPlan(
    admin,
    'booking-1',
    'plan-1',
    'pending',
    '',
    getBooking().version,
  );
  assert.equal(pending.workPlan?.[0]?.review.status, 'pending');
  assert.equal(pending.workPlan?.[0]?.review.actualTime, '09:15');
  await assert.rejects(
    service.reviewWorkPlan(client, 'booking-1', 'plan-1', 'respected', '', getBooking().version),
    /réservée/u,
  );
});
