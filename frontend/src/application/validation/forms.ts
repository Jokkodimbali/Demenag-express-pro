import type { Catalogue, Driver, QuoteInput, User, Vehicle } from '../../domain/model';
import { messages } from '../../content/fr';
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
  return {
    ...existing,
    name: String(data.get('name')),
    volume: String(data.get('volume')),
    length: String(data.get('length')),
    height: String(data.get('height')),
    width: String(data.get('width')),
    wheelWidth: String(data.get('wheelWidth')),
    active: data.get('active') === 'on',
    image: await dataUrl(data.get('image'), existing.image),
    interior: await dataUrl(data.get('interior'), existing.interior),
  };
}

export async function catalogueFromForm(
  data: FormData,
  catalogue: Catalogue,
  section: SettingsSection,
): Promise<Catalogue> {
  if (section === 'pricing')
    return {
      ...catalogue,
      vehicles: catalogue.vehicles.map((vehicle) => ({
        ...vehicle,
        prices: tuple([0, 1, 2].map((index) => integer(data.get(`${vehicle.id}-${index}`)))),
      })),
      settings: {
        ...catalogue.settings,
        distanceBounds: tuple([0, 1, 2].map((index) => integer(data.get(`distance-${index}`)))),
        labourPrice: integer(data.get('labour')),
        assemblyPrice: integer(data.get('assembly')),
      },
    };
  if (section === 'booking-rules')
    return {
      ...catalogue,
      settings: {
        ...catalogue.settings,
        bookingsEnabled: data.get('bookingsEnabled') === 'on',
        clientCancellation: data.get('clientCancellation') === 'on',
        enabledSlots: catalogue.settings.enabledSlots.flatMap((slot, index) =>
          data.get(`slotActive-${index}`) === 'on'
            ? [
                {
                  label: String(data.get(`slotLabel-${index}`)),
                  startHour: integer(data.get(`slotHour-${index}`)),
                },
              ]
            : [],
        ),
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
      invoiceLogo:
        (await dataUrl(data.get('invoiceLogo'), catalogue.settings.invoiceLogo ?? '')) || null,
    },
  };
}
