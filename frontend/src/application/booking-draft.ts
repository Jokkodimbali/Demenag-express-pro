import type { Catalogue, Options, Point, RouteTicket } from '../domain/model';
import { blankInventory, type Inventory } from '../domain/inventory';
export type Draft = {
  vehicleId: string;
  customerName: string;
  customerPhone: string;
  source: string;
  fromAddress: string;
  toAddress: string;
  fromNote: string;
  toNote: string;
  from: Point | null;
  to: Point | null;
  route: RouteTicket | null;
  distanceKmOverride?: number | null;
  date: string;
  noDate?: boolean;
  month: string;
  timeSlot: string;
  estimatedTrips: number;
  options: Options;
  notes: string;
  inventory: Inventory;
  questionnaireAnswers: Record<string, string>;
  requestId: string;
};
export const blankDraft = (catalogue?: Catalogue): Draft => ({
  vehicleId: catalogue?.vehicles.find((vehicle) => vehicle.active !== false)?.id ?? '',
  customerName: '',
  customerPhone: '',
  source: '',
  fromAddress: '',
  toAddress: '',
  fromNote: '',
  toNote: '',
  from: null,
  to: null,
  route: null,
  distanceKmOverride: null,
  date: '',
  noDate: false,
  month: new Date().toISOString().slice(0, 7),
  timeSlot: '',
  estimatedTrips: 1,
  options: { labour: 0, desk: 0, wardrobe: 0, bed: 0 },
  notes: '',
  inventory: blankInventory(),
  questionnaireAnswers: {},
  requestId: crypto.randomUUID(),
});
