import assert from 'node:assert/strict';
import test from 'node:test';
import { MovingService } from '../src/application/services/moving/moving.js';
import { defaultTaxiDistanceTariffs } from '../../shared/taxi-distance-tariffs.js';
import type {
  BookingRepository,
  CatalogueRepository,
  DriverRepository,
} from '../src/application/ports/index.js';
import type {
  Booking,
  BookingInput,
  BookingInventorySnapshot,
  BookingPricingSnapshot,
  Catalogue,
  Driver,
  Settings,
  User,
  TollPoint,
} from '../src/domain/shared/model.js';

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
  let catalogueVehiclePrices: [number, number, number] = [10000, 20000, 30000];
  let catalogueTollPoints: TollPoint[] = [];
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
  let settings: Settings = {
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
    get: async () =>
      ({
        vehicles: [{ ...booking.vehicle, prices: catalogueVehiclePrices }],
        settings,
      }) as Catalogue,
    listTollPoints: async () => catalogueTollPoints,
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
    setPricingSnapshot: (pricingSnapshot: BookingPricingSnapshot) => {
      booking = { ...booking, pricingSettings: settings, pricingSnapshot };
    },
    setCurrentVehiclePrices: (prices: [number, number, number]) => {
      catalogueVehiclePrices = prices;
    },
    setCurrentTollPoints: (points: TollPoint[]) => {
      catalogueTollPoints = points;
    },
    setDistance: (distanceKm: number) => {
      booking = { ...booking, distanceKm };
    },
    setOptions: (options: Booking['options']) => {
      booking = { ...booking, options };
    },
    setSettings: (next: Partial<Settings>) => {
      settings = { ...settings, ...next };
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

test('le backend applique les tarifs taxi avec la distance du devis et les rotations calculées', async () => {
  const { service, getBooking, setDistance, setOptions, setSettings } = harness();
  setDistance(70);
  setOptions({ labour: 5, desk: 0, wardrobe: 0, bed: 0 });
  setSettings({
    taxiFeeEnabled: true,
    taxiFeePerKm: 300,
    taxiDistanceTariffs: defaultTaxiDistanceTariffs,
    businessLatitude: 14.69,
    businessLongitude: -17.44,
  });
  const booking = getBooking();
  const saved = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 3,
    distanceKmOverride: 10,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [
      { label: 'Frais taxi · trajet simple', quantity: 5, unitPrice: 3_500 },
      { label: 'Frais taxi · approche entreprise', quantity: 1, unitPrice: 2_500 },
    ],
    taxiFeeApplied: true,
    taxiCompanyApproachDistanceKm: 5,
    options: booking.options,
    version: booking.version,
  });
  const quote = saved.quotes.at(-1);

  assert.equal(quote?.pricingInput?.taxiFeeAmount, 20_000);
  assert.equal(quote?.pricingInput?.distanceKmOverride, 10);
  assert.equal(quote?.pricingInput?.taxiCompanyApproachDistanceKm, 5);
  assert.equal(quote?.price.lines.filter((line) => line.label.startsWith('Manœuvre')).length, 1);
  assert.equal(quote?.price.lines.find((line) => line.label.startsWith('Manœuvre'))?.total, 45_000);
});

test('le backend refuse une ligne taxi dont les trajets ne correspondent pas aux rotations du devis', async () => {
  const { service, getBooking, setDistance, setOptions, setSettings } = harness();
  setDistance(10);
  setOptions({ labour: 2, desk: 0, wardrobe: 0, bed: 0 });
  setSettings({
    taxiFeeEnabled: true,
    taxiFeePerKm: 300,
    taxiDistanceTariffs: defaultTaxiDistanceTariffs,
    businessLatitude: 14.69,
    businessLongitude: -17.44,
  });
  const booking = getBooking();

  await assert.rejects(
    service.quote(admin, booking.id, {
      kind: 'provisional',
      trips: 3,
      customPrice: null,
      discount: 0,
      notes: '',
      extraLines: [
        { label: 'Frais taxi · trajet simple', quantity: 3, unitPrice: 3_500 },
        { label: 'Frais taxi · approche entreprise', quantity: 1, unitPrice: 2_500 },
      ],
      taxiFeeApplied: true,
      taxiCompanyApproachDistanceKm: 5,
      options: booking.options,
      version: booking.version,
    }),
    /détail des trajets taxi/u,
  );
});

test('le backend conserve les montants taxi modifiés et répartit le total sur les manœuvres', async () => {
  const { service, getBooking, setDistance, setOptions, setSettings } = harness();
  setDistance(10);
  setOptions({ labour: 6, desk: 0, wardrobe: 0, bed: 0 });
  setSettings({
    labourPrice: 6_500,
    taxiFeeEnabled: true,
    taxiDistanceTariffs: defaultTaxiDistanceTariffs,
    businessLatitude: 14.69,
    businessLongitude: -17.44,
  });
  const booking = getBooking();
  const saved = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 2,
    calcMode: 'manual',
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [
      { label: 'Frais taxi · montant par trajet modifié', quantity: 3, unitPrice: 13_650 },
      { label: 'Frais taxi · approche entreprise', quantity: 1, unitPrice: 930 },
    ],
    taxiFeeApplied: true,
    taxiPerLegAmountOverride: 13_650,
    taxiRoundTripAmountOverride: 13_650,
    taxiCompanyApproachAmountOverride: 930,
    options: booking.options,
    version: booking.version,
  });
  const quote = saved.quotes.at(-1);
  const manoeuvreLines = quote?.price.lines.filter((line) => line.label.startsWith('Manœuvre'));

  assert.equal(quote?.pricingInput?.taxiFeeAmount, 41_880);
  assert.equal(manoeuvreLines?.length, 1);
  assert.equal(manoeuvreLines?.[0]?.quantity, 6);
  assert.equal(manoeuvreLines?.[0]?.unitPrice, 13_480);
  assert.equal(manoeuvreLines?.[0]?.total, 80_880);
});

test('un changement de trajet recalcule les frais taxi du devis provisoire avec la nouvelle distance', async () => {
  const { service, getBooking, setOptions, setSettings } = harness();
  setOptions({ labour: 3, desk: 0, wardrobe: 0, bed: 0 });
  setSettings({
    taxiFeeEnabled: true,
    taxiDistanceTariffs: defaultTaxiDistanceTariffs,
    businessLatitude: 14.69,
    businessLongitude: -17.44,
  });
  const booking = getBooking();
  const created = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 2,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [
      { label: 'Frais taxi · trajet simple', quantity: 3, unitPrice: 30_000 },
      { label: 'Frais taxi · approche entreprise', quantity: 1, unitPrice: 30_000 },
    ],
    taxiFeeApplied: true,
    taxiCompanyApproachDistanceKm: 45,
    options: booking.options,
    version: booking.version,
  });
  assert.equal(created.quotes[0]?.pricingInput?.taxiFeeAmount, 120_000);

  const updated = await service.updateRoute(
    admin,
    booking.id,
    [14.6, -17.5],
    [14.8, -16.9],
    created.version,
  );
  const quote = updated.quotes[0];

  assert.equal(quote?.pricingInput?.taxiFeeAmount, 14_000);
  assert.equal(quote?.pricingInput?.taxiCompanyApproachDistanceKm, 10);
  assert.equal(quote?.price.lines.find((line) => line.label.startsWith('Manœuvre'))?.total, 29_000);
});

test('le devis utilise les tarifs figés puis les remplace uniquement sur action explicite', async () => {
  const { service, getBooking, setPricingSnapshot, setCurrentVehiclePrices, setDistance } =
    harness();
  setDistance(20);
  setPricingSnapshot({
    capturedAt: now.toISOString(),
    vehiclePrices: { 'vehicle-1': [11000, 22000, 33000] },
    tollPoints: [],
    accounting: null,
  });
  const booking = getBooking();
  const quote = await service.quote(admin, booking.id, {
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
  assert.equal(quote.quotes[0]?.price.lines[0]?.unitPrice, 22000);

  setCurrentVehiclePrices([12000, 24000, 36000]);
  const updated = await service.applyCurrentPricingSnapshot(admin, booking.id, quote.version);
  assert.deepEqual(updated.pricingSnapshot?.vehiclePrices['vehicle-1'], [12000, 24000, 36000]);
  assert.deepEqual(updated.vehicle.prices, [12000, 24000, 36000]);
  assert.equal(
    updated.estimate.lines.find((line) => line.label.startsWith('Transport'))?.unitPrice,
    24000,
  );
  assert.equal(updated.version, quote.version + 1);
});

test('les trois services de montage sont enregistrés une fois chacun avec leur montant', async () => {
  const { service, getBooking, setDistance } = harness();
  setDistance(10);
  const booking = getBooking();
  const saved = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 1,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    tolls: [],
    billingMode: 'complete',
    options: { labour: 0, desk: 1, wardrobe: 1, bed: 1 },
    version: booking.version,
  });
  const lines = saved.quotes[0]?.price.lines.filter((line) => line.label.startsWith('Menuisier'));
  assert.equal(lines?.length, 3);
  assert.deepEqual(
    lines?.map((line) => line.total),
    [6500, 5200, 3900],
  );
  assert.equal(new Set(lines?.map((line) => line.label)).size, 3);
  assert.equal(saved.quotes[0]?.price.total, 25600);
});

test('un devis provisoire sans tarif transport conserve ses services et enregistre le total comme sur devis', async () => {
  const { service, getBooking } = harness();
  const booking = getBooking();
  const saved = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 2,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [{ label: 'Protection spéciale', quantity: 1, unitPrice: 3_000 }],
    tolls: [],
    options: { labour: 2, desk: 0, wardrobe: 0, bed: 0 },
    version: booking.version,
  });
  const price = saved.quotes[0]?.price;

  assert.equal(price?.tier, 3);
  assert.equal(price?.total, null);
  assert.equal(price?.lines.find((line) => line.label.startsWith('Transport'))?.total, 0);
  assert.equal(price?.lines.find((line) => line.label.startsWith('Manœuvre'))?.total, 10_000);
  assert.equal(price?.lines.find((line) => line.label === 'Protection spéciale')?.total, 3_000);
  assert.equal(saved.estimate.total, null);
});

test('le montage choisi dans l’inventaire ne double pas les trois options du devis', async () => {
  const { service, getBooking, setDistance, setInventorySnapshot } = harness();
  setDistance(10);
  setInventorySnapshot({
    sourceInventory: {
      dwellingType: '',
      fromFloor: 0,
      toFloor: 0,
      fromLift: false,
      toLift: false,
      entries: {
        bureau: { quantity: 1, size: 1, dismantle: true, origin: 'local' },
        armoire: { quantity: 1, size: 3, dismantle: true, origin: 'local' },
        lit: { quantity: 1, size: 2, dismantle: true, origin: 'local' },
      },
      variants: [],
      flags: {},
      custom: [],
    },
  } as unknown as BookingInventorySnapshot);
  const booking = getBooking();
  const saved = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 1,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    tolls: [],
    billingMode: 'complete',
    options: { labour: 0, desk: 1, wardrobe: 1, bed: 1 },
    version: booking.version,
  });
  const lines = saved.quotes[0]?.price.lines.filter((line) => line.label.startsWith('Menuisier'));
  assert.equal(lines?.length, 3);
  assert.ok(lines?.every((line) => line.label.includes('démontage / montage')));
  assert.equal(new Set(lines?.map((line) => line.label)).size, 3);
  assert.equal(
    saved.quotes[0]?.price.total,
    10_000 + (lines?.reduce((sum, line) => sum + line.total, 0) ?? 0),
  );
});

test('la formule standard ne facture pas le montage personnalisé enregistré', async () => {
  const { service, getBooking, setDistance } = harness();
  setDistance(10);
  const booking = getBooking();
  const saved = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 1,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    customLines: [
      { label: 'Montage/démontage bureau', quantity: 1, unitPrice: 5000 },
      { label: 'Protection spéciale', quantity: 2, unitPrice: 1500 },
    ],
    tolls: [],
    billingMode: 'standard',
    options: { labour: 0, desk: 1, wardrobe: 0, bed: 0 },
    version: booking.version,
  });
  const quote = saved.quotes[0];
  assert.equal(
    quote?.price.lines.some((line) => /montage|menuisier/iu.test(line.label)),
    false,
  );
  assert.equal(
    quote?.price.lines.find((line) => line.label === 'Protection spéciale')?.total,
    3000,
  );
  assert.equal(quote?.price.total, 13000);
});

test('ajouter un service à un ancien devis conserve ses montants déjà enregistrés', async () => {
  const { service, getBooking, setDistance, setQuotes } = harness();
  setDistance(10);
  setQuotes([
    {
      id: 'legacy-quote',
      reference: 'DV-LEGACY',
      kind: 'provisional',
      createdAt: now.toISOString(),
      price: {
        lines: [
          { label: 'Transport Camion test', quantity: 5, unitPrice: 28_000, total: 140_000 },
          { label: 'Manœuvre', quantity: 3, unitPrice: 6_500, total: 19_500 },
        ],
        total: 159_500,
        discount: 0,
        tier: 0,
        trips: 5,
        currency: 'XOF',
      },
      notes: '',
      options: { labour: 3, desk: 0, wardrobe: 0, bed: 0 },
    },
  ]);
  const booking = getBooking();
  const saved = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 5,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    customLines: [{ label: 'Frais d’emballage', quantity: 2, unitPrice: 1500 }],
    preserveSavedCustomLines: true,
    tolls: [],
    options: booking.options,
    version: booking.version,
  });
  const quote = saved.quotes.at(-1);
  assert.equal(quote?.price.total, 162_500);
  assert.deepEqual(quote?.price.lines.slice(0, 2), booking.quotes[0]?.price.lines);
  assert.equal(quote?.price.lines.at(-1)?.total, 3000);
  assert.equal(saved.quotes.length, 1);
  assert.equal(quote?.id, 'legacy-quote');

  const changedQuantity = await service.quote(admin, saved.id, {
    kind: 'provisional',
    trips: 5,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    customLines: [{ label: 'Frais d’emballage', quantity: 1, unitPrice: 1500 }],
    preserveSavedCustomLines: true,
    tolls: [],
    options: saved.options,
    version: saved.version,
  });
  assert.equal(changedQuantity.quotes[0]?.price.total, 161_000);
  assert.equal(changedQuantity.quotes[0]?.price.lines.at(-1)?.quantity, 1);
  assert.equal(changedQuantity.quotes.length, 1);

  const removed = await service.quote(admin, changedQuantity.id, {
    kind: 'provisional',
    trips: 5,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    customLines: [],
    preserveSavedCustomLines: true,
    tolls: [],
    options: changedQuantity.options,
    version: changedQuantity.version,
  });
  assert.equal(removed.quotes[0]?.price.total, 159_500);
  assert.deepEqual(removed.quotes[0]?.price.lines, booking.quotes[0]?.price.lines);
});

test('les péages existants gardent leur tarif figé et les nouveaux utilisent le tarif courant', async () => {
  const { service, getBooking, setPricingSnapshot, setCurrentTollPoints } = harness();
  const oldPoint: TollPoint = {
    id: 'old',
    name: 'Ancien',
    region: 'Dakar',
    axis: 'A1',
    heavyPrice: 100,
    vehiclePrices: { 'vehicle-1': 100 },
    latitude: null,
    longitude: null,
  };
  setPricingSnapshot({
    capturedAt: now.toISOString(),
    vehiclePrices: { 'vehicle-1': [10000, 20000, 30000] },
    tollPoints: [oldPoint],
    accounting: null,
  });
  setCurrentTollPoints([
    { ...oldPoint, heavyPrice: 500, vehiclePrices: { 'vehicle-1': 500 } },
    {
      ...oldPoint,
      id: 'new',
      name: 'Nouveau',
      heavyPrice: 700,
      vehiclePrices: { 'vehicle-1': 700 },
    },
  ]);
  const booking = getBooking();
  const result = await service.quote(admin, booking.id, {
    kind: 'provisional',
    trips: 1,
    customPrice: null,
    discount: 0,
    notes: '',
    extraLines: [],
    options: booking.options,
    version: booking.version,
    tolls: [
      { tollPointId: 'old', direction: 'one-way', quantity: 1 },
      { tollPointId: 'new', direction: 'one-way', quantity: 1 },
    ],
  });
  assert.deepEqual(
    result.quotes[0]?.tolls?.map((line) => line.unitPrice),
    [100, 700],
  );
});

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

test('un devis existant bascule en final puis en provisoire sans créer de doublon', async () => {
  const { service, getBooking, setQuotes } = harness();
  setQuotes([
    {
      id: 'quote-1',
      reference: 'DV-2026-QUOTE1',
      kind: 'provisional',
      createdAt: '2026-10-20T10:00:00.000Z',
      price: { lines: [], total: 30000, discount: 0, tier: 1, trips: 1, currency: 'XOF' },
      notes: '',
    },
  ]);

  const finalized = await service.updateQuoteKind(
    admin,
    'booking-1',
    'quote-1',
    'final',
    getBooking().version,
  );
  assert.equal(finalized.status, 'completed');
  assert.equal(finalized.quotes.length, 1);
  assert.equal(finalized.quotes[0]?.kind, 'final');
  assert.equal(finalized.quotes[0]?.reference, 'DV-2026-QUOTE1');
  assert.equal(finalized.quotes[0]?.createdAt, now.toISOString());

  const provisional = await service.updateQuoteKind(
    admin,
    'booking-1',
    'quote-1',
    'provisional',
    finalized.version,
  );
  assert.equal(provisional.status, 'pending');
  assert.equal(provisional.quotes.length, 1);
  assert.equal(provisional.quotes[0]?.id, 'quote-1');
  assert.equal(provisional.quotes[0]?.kind, 'provisional');
  assert.deepEqual(provisional.estimate, provisional.quotes[0]?.price);
});

test('la validation du formulaire final met à jour le devis provisoire en place', async () => {
  const { service, getBooking, setQuotes, setDistance } = harness();
  setDistance(20);
  const initial = getBooking();
  setQuotes([
    {
      id: 'quote-1',
      reference: 'DV-2026-QUOTE1',
      kind: 'provisional',
      createdAt: '2026-10-20T10:00:00.000Z',
      price: initial.estimate,
      notes: '',
    },
  ]);

  const finalized = await service.quote(
    admin,
    'booking-1',
    {
      kind: 'final',
      trips: 1,
      customPrice: null,
      discount: 0,
      notes: 'Formulaire final enregistré',
      extraLines: [],
      tolls: [],
      options: initial.options,
      version: getBooking().version,
    },
    'quote-1',
  );

  assert.equal(finalized.status, 'completed');
  assert.equal(finalized.quotes.length, 1);
  assert.equal(finalized.quotes[0]?.id, 'quote-1');
  assert.equal(finalized.quotes[0]?.reference, 'DV-2026-QUOTE1');
  assert.equal(finalized.quotes[0]?.kind, 'final');
  assert.equal(finalized.quotes[0]?.notes, 'Formulaire final enregistré');
});

test('le basculement provisoire/final sauvegarde le formulaire courant dans la même opération', async () => {
  const { service, getBooking, setQuotes, setDistance } = harness();
  setDistance(20);
  const initial = getBooking();
  setQuotes([
    {
      id: 'quote-1',
      reference: 'DV-2026-QUOTE1',
      kind: 'provisional',
      createdAt: '2026-10-20T10:00:00.000Z',
      price: initial.estimate,
      notes: '',
    },
  ]);
  const bookingInput: BookingInput = {
    vehicleId: initial.vehicle.id,
    routeId: 'route-for-update',
    trips: 1,
    customerName: 'Client modifié',
    customerPhone: initial.phone,
    fromAddress: initial.fromAddress,
    toAddress: initial.toAddress,
    date: initial.date,
    month: '2026-10',
    timeSlot: '09:00',
    options: initial.options,
    notes: 'Notes du formulaire mises à jour',
    questionnaireAnswers: [],
    workPlan: [],
    inventorySnapshot: null,
    requestId: '00000000-0000-4000-8000-000000000001',
  };
  const finalQuote = {
    kind: 'final' as const,
    trips: 1,
    customPrice: null,
    discount: 0,
    discountType: 'fcfa' as const,
    notes: 'Devis final recalculé',
    extraLines: [],
    tolls: [],
    options: bookingInput.options,
    version: initial.version,
  };

  const finalized = await service.updateQuoteStage(
    admin,
    initial.id,
    'quote-1',
    bookingInput,
    finalQuote,
  );
  assert.equal(finalized.status, 'completed');
  assert.equal(finalized.customerName, 'Client modifié');
  assert.equal(finalized.timeSlot, '09:00');
  assert.equal(finalized.quotes.length, 1);
  assert.equal(finalized.quotes[0]?.kind, 'final');
  assert.equal(finalized.quotes[0]?.notes, 'Devis final recalculé');

  const provisional = await service.updateQuoteStage(
    admin,
    initial.id,
    'quote-1',
    { ...bookingInput, customerName: 'Client provisoire', timeSlot: '10:00' },
    {
      ...finalQuote,
      kind: 'provisional',
      notes: 'Devis provisoire recalculé',
      version: finalized.version,
    },
  );
  assert.equal(provisional.status, 'pending');
  assert.equal(provisional.customerName, 'Client provisoire');
  assert.equal(provisional.timeSlot, '10:00');
  assert.equal(provisional.quotes.length, 1);
  assert.equal(provisional.quotes[0]?.id, 'quote-1');
  assert.equal(provisional.quotes[0]?.kind, 'provisional');
  assert.equal(provisional.quotes[0]?.notes, 'Devis provisoire recalculé');
  assert.deepEqual(provisional.estimate, provisional.quotes[0]?.price);
  assert.deepEqual(provisional.crew, { chauffeur: [], menuisier: [], manoeuvre: [], chef: '' });
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

test('admin quote edit preserves its saved date unless date removal is explicit', async () => {
  const { service, getBooking } = harness();
  const booking = getBooking();
  const input: BookingInput = {
    vehicleId: booking.vehicle.id,
    routeId: 'route-for-update',
    trips: 1,
    customerName: booking.customerName,
    customerPhone: booking.phone,
    fromAddress: booking.fromAddress,
    toAddress: booking.toAddress,
    date: null,
    noDate: false,
    month: '2026-10',
    timeSlot: '',
    options: booking.options,
    notes: booking.notes,
    requestId: '00000000-0000-4000-8000-000000000001',
  };

  const preserved = await service.updateAdminRequest(admin, booking.id, input, booking.version);
  assert.equal(preserved.date, booking.date);
  assert.equal(preserved.timeSlot, booking.timeSlot);

  const cleared = await service.updateAdminRequest(
    admin,
    booking.id,
    { ...input, noDate: true, month: '2026-12' },
    preserved.version,
  );
  assert.equal(cleared.date, null);
  assert.equal(cleared.timeSlot, '');
  assert.equal(cleared.month, '2026-12');
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
