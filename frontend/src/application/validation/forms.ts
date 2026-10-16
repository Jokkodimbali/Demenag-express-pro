import type { Catalogue, QuoteInput, User, Vehicle } from '../../domain/model';

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

export function quoteFromForm(data: FormData, version: number): QuoteInput {
  return {
    kind: data.get('kind') === 'final' ? 'final' : 'provisional',
    trips: integer(data.get('trips')),
    customPrice: data.get('customPrice') ? integer(data.get('customPrice')) : null,
    discount: integer(data.get('discount')),
    notes: String(data.get('notes')),
    version,
  };
}

export function vehicleFromForm(data: FormData, existing: Vehicle): Vehicle {
  return {
    ...existing,
    name: String(data.get('name')),
    volume: String(data.get('volume')),
    length: String(data.get('length')),
    height: String(data.get('height')),
    width: String(data.get('width')),
    wheelWidth: String(data.get('wheelWidth')),
    active: data.get('active') === 'on',
  };
}

export function catalogueFromForm(data: FormData, catalogue: Catalogue): Catalogue {
  return {
    ...catalogue,
    vehicles: catalogue.vehicles.map((vehicle) => ({
      ...vehicle,
      name: String(data.get(`${vehicle.id}-name`)),
      active: data.get(`${vehicle.id}-active`) === 'on',
      prices: tuple([0, 1, 2].map((index) => integer(data.get(`${vehicle.id}-${index}`)))),
    })),
    settings: {
      ...catalogue.settings,
      distanceBounds: tuple([0, 1, 2].map((index) => integer(data.get(`distance-${index}`)))),
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
      labourPrice: integer(data.get('labour')),
      assemblyPrice: integer(data.get('assembly')),
      businessPhone: String(data.get('phone')),
    },
  };
}
