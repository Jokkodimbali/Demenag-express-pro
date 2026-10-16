import type { Catalogue, Options, Point, RouteTicket } from '../domain/model';
export type Draft = {
  vehicleId: string;
  fromAddress: string;
  toAddress: string;
  from: Point | null;
  to: Point | null;
  route: RouteTicket | null;
  date: string;
  timeSlot: string;
  options: Options;
  notes: string;
  requestId: string;
};
export const blankDraft = (catalogue?: Catalogue): Draft => ({
  vehicleId: catalogue?.vehicles.find((vehicle) => vehicle.active !== false)?.id ?? '',
  fromAddress: '',
  toAddress: '',
  from: null,
  to: null,
  route: null,
  date: '',
  timeSlot: catalogue?.settings.enabledSlots[0]?.label ?? '',
  options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
  notes: '',
  requestId: crypto.randomUUID(),
});
