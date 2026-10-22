import type { Catalogue, Options, Point, RouteTicket } from '../domain/model';
import { blankInventory, type Inventory } from '../domain/inventory';
export type Draft = {
  vehicleId: string;
  customerName: string;
  customerPhone: string;
  fromAddress: string;
  toAddress: string;
  from: Point | null;
  to: Point | null;
  route: RouteTicket | null;
  date: string;
  timeSlot: string;
  options: Options;
  notes: string;
  inventory: Inventory;
  requestId: string;
};
export const blankDraft = (catalogue?: Catalogue): Draft => ({
  vehicleId: catalogue?.vehicles.find((vehicle) => vehicle.active !== false)?.id ?? '',
  customerName: '',
  customerPhone: '',
  fromAddress: '',
  toAddress: '',
  from: null,
  to: null,
  route: null,
  date: '',
  timeSlot: '',
  options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
  notes: '',
  inventory: blankInventory(),
  requestId: crypto.randomUUID(),
});
