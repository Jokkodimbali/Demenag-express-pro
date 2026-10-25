import type { Catalogue, Driver, QuoteInput, User, Vehicle } from '../../domain/model';
import { messages } from '../../content/fr';
import { vehicleCapacity } from '../../domain/vehicle-capacity';
import { createLabourPriceMatrix, labourMatrixScenarios } from '../../domain/labour-price';
import type { SettingsSection } from '../../pages/Settings';

const role = (value: FormDataEntryValue | null): User['role'] =>
  value === 'admin' ? 'admin' : 'client';
const integer = (value: FormDataEntryValue | null) => Number(value);
const tuple = (values: number[]): [number, number, number] => [values[0], values[1], values[2]];

export function userFromForm(data: FormData): Omit<User, 'id'> {
  return {
    name: String(data.get('name')),
    phone: String(data.get('phone')),
    role: role(data.get('role')),
    active: data.get('active') === 'on',
  };
}

export function quoteFromForm(
  data: FormData,
  version: number,
  extraLines: QuoteInput['extraLines'],
  options: NonNullable<QuoteInput['options']>,
): QuoteInput {
  return {
    kind: data.get('kind') === 'final' ? 'final' : 'provisional',
    trips: integer(data.get('trips')),
    customPrice: data.get('customPrice') ? integer(data.get('customPrice')) : null,
    discount: integer(data.get('discount')),
    notes: String(data.get('notes')),
    extraLines,
    options,
    version,
  };
}

export async function dataUrl(file: FormDataEntryValue | null, fallback: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) return fallback;
  if (file.size > 2_500_000) throw new Error(messages.imageTropVolumineuse);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function driverFromForm(
  data: FormData,
  existing: Driver,
): Promise<Omit<Driver, 'userId'>> {
  const photo =
    data.get('removePhoto') === 'on' ? '' : await dataUrl(data.get('photo'), existing.photo ?? '');
  return {
    ...existing,
    name: String(data.get('name')),
    phone: String(data.get('phone')),
    photo: photo || null,
    active: data.get('active') === 'on',
    vehicleId: String(data.get('vehicleId')) || null,
  };
}

export async function vehicleFromForm(data: FormData, existing: Vehicle): Promise<Vehicle> {
  const length = String(data.get('length'));
  const height = String(data.get('height'));
  const width = String(data.get('width'));
  const wheelWidth = String(data.get('wheelWidth'));
  return {
    ...existing,
    name: String(data.get('name')),
    volume: vehicleCapacity(length, height, width, wheelWidth),
    length,
    height,
    width,
    wheelWidth,
    active: data.get('active') === 'on',
    image: await imageValue(data.get('image'), existing.image),
    interior: await imageValue(data.get('interior'), existing.interior),
  };
}

async function imageValue(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value === 'string') return value || fallback;
  return dataUrl(value, fallback);
}

export async function catalogueFromForm(
  data: FormData,
  catalogue: Catalogue,
  section: SettingsSection,
): Promise<Catalogue> {
  if (section === 'pricing') {
    const labourMatrix = createLabourPriceMatrix(catalogue.settings);
    for (const scenario of labourMatrixScenarios)
      for (let fromFloor = 0; fromFloor <= 5; fromFloor += 1)
        for (let toFloor = 0; toFloor <= 5; toFloor += 1) {
          const key = `labourMatrix.${scenario.id}.${fromFloor}.${toFloor}`;
          if (data.has(key)) labourMatrix[scenario.id][fromFloor][toFloor] = integer(data.get(key));
        }
    return {
      ...catalogue,
      vehicles: catalogue.vehicles.map((vehicle) => ({
        ...vehicle,
        prices: tuple([0, 1, 2].map((index) => integer(data.get(`${vehicle.id}-${index}`)))),
      })),
      settings: {
        ...catalogue.settings,
        distanceBounds: tuple([0, 1, 2].map((index) => integer(data.get(`distance-${index}`)))),
        labourPrice: labourMatrix.none[0][0],
        labourMatrix,
        movingLaborPlanning: {
          maxHandlingHours: Number(data.get('movingLaborPlanning.maxHandlingHours')),
          maxDayHours: Number(data.get('movingLaborPlanning.maxDayHours')),
          defaultStartHour: integer(data.get('movingLaborPlanning.defaultStartHour')),
          maxMoversPerVehicle: integer(data.get('movingLaborPlanning.maxMoversPerVehicle')),
          cubicMetersPerHourPerMover: Number(
            data.get('movingLaborPlanning.cubicMetersPerHourPerMover'),
          ),
          pauseMinutes: integer(data.get('movingLaborPlanning.pauseMinutes')),
        },
        assemblyPrice: integer(data.get('assembly')),
      },
    };
  }
  if (section === 'booking-rules')
    return {
      ...catalogue,
      settings: {
        ...catalogue.settings,
        bookingsEnabled: data.get('bookingsEnabled') === 'on',
        clientCancellation: data.get('clientCancellation') === 'on',
        enabledSlots: Array.from({ length: integer(data.get('slotCount')) }, (_, index) => ({
          label: String(data.get(`slotLabel-${index}`) ?? '').trim(),
          startHour: integer(data.get(`slotHour-${index}`)),
        })).filter((slot) => slot.label.length > 0),
        maxAdvanceDays: integer(data.get('maxAdvanceDays')),
        minNoticeHours: integer(data.get('minNoticeHours')),
        maxOptions: integer(data.get('maxOptions')),
        maxTrips: integer(data.get('maxTrips')),
        cancellationNoticeHours: integer(data.get('cancellationNoticeHours')),
      },
    };
  return {
    ...catalogue,
    settings: {
      ...catalogue.settings,
      businessPhone: String(data.get('phone')),
      whatsappPhone: String(data.get('whatsappPhone')),
      businessName: String(data.get('businessName')),
      businessAddress: String(data.get('businessAddress')),
      invoiceFooter: String(data.get('invoiceFooter')),
      tiktokUrl: String(data.get('tiktokUrl') || '').trim() || null,
      facebookUrl: String(data.get('facebookUrl') || '').trim() || null,
      instagramUrl: String(data.get('instagramUrl') || '').trim() || null,
      invoiceLogo:
        (await dataUrl(data.get('invoiceLogo'), catalogue.settings.invoiceLogo ?? '')) || null,
      invoiceStamp:
        (await dataUrl(data.get('invoiceStamp'), catalogue.settings.invoiceStamp ?? '')) || null,
      invoiceSignature:
        (await dataUrl(data.get('invoiceSignature'), catalogue.settings.invoiceSignature ?? '')) ||
        null,
    },
  };
}
