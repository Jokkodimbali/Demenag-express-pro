import type {
  Booking,
  BookingInput,
  BookingStatus,
  Catalogue,
  Driver,
  Options,
  Point,
  Price,
  QuoteInput,
  RouteTicket,
  Settings,
  User,
  Vehicle,
} from '../../domain/model.js';
import type { BreakdownInput, VehicleInspectionInput, VehicleReportRecord } from './index.js';
export type AuthSession = { user: User; token: string };
export interface AuthUseCases {
  register(name: string, phone: string, password: string): Promise<AuthSession>;
  login(phone: string, password: string): Promise<AuthSession>;
  current(token?: string): Promise<User | null>;
  logout(token?: string): Promise<void>;
  changePassword(user: User, oldPassword: string, newPassword: string): Promise<AuthSession>;
}
export interface MovingUseCases {
  route(from: Point, to: Point): Promise<RouteTicket>;
  search(query: string): Promise<{ label: string; point: Point }[]>;
  estimate(vehicleId: string, routeId: string, options: Options): Promise<Price>;
  create(user: User, input: BookingInput): Promise<Booking>;
  list(user: User): Promise<Booking[]>;
  get(user: User, id: string): Promise<Booking>;
  status(user: User, id: string, next: BookingStatus, version: number): Promise<Booking>;
  schedule(user: User, id: string, date: string | null, timeSlot: string, version: number): Promise<Booking>;
  assignDriver(user: User, id: string, driverId: string | null, version: number): Promise<Booking>;
  quote(user: User, id: string, input: QuoteInput): Promise<Booking>;
  delete(user: User, id: string): Promise<void>;
}
export interface AdministrationUseCases {
  listUsers(actor: User): Promise<User[]>;
  updateUser(actor: User, user: User): Promise<User>;
  createUser(actor: User, input: Omit<User, 'id'> & { password: string }): Promise<User>;
  updateProfile(actor: User, input: Pick<User, 'name' | 'phone' | 'photo'>): Promise<User>;
}
export interface CatalogueUseCases {
  get(): Promise<Catalogue>;
  update(actor: User, vehicles: Vehicle[], settings: Settings): Promise<void>;
}
export type DriverCreation = {
  name: string;
  phone: string;
  password: string;
  photo: string | null;
  vehicleId: string | null;
};
export type DriverUpdate = Omit<Driver, 'userId'>;
export interface DriverUseCases {
  list(actor: User): Promise<Driver[]>;
  create(actor: User, input: DriverCreation): Promise<Driver>;
  update(actor: User, driver: DriverUpdate): Promise<Driver>;
  profile(actor: User): Promise<Driver>;
  updateProfile(actor: User, input: Pick<Driver, 'name' | 'phone' | 'photo'>): Promise<Driver>;
  bookings(actor: User): Promise<Booking[]>;
}
export interface VehicleReportUseCases {
  submitInspection(actor: User, input: VehicleInspectionInput): Promise<VehicleReportRecord>;
  reportBreakdown(actor: User, input: BreakdownInput): Promise<VehicleReportRecord>;
  driverReports(actor: User): Promise<{ inspections: VehicleReportRecord[]; breakdowns: VehicleReportRecord[] }>;
  adminReports(actor: User): Promise<{ inspections: VehicleReportRecord[]; breakdowns: VehicleReportRecord[] }>;
}
export interface NotificationUseCases {
  list(actor: User): Promise<{ items: import('./index.js').Notification[]; unreadCount: number }>;
  markRead(actor: User, id: string): Promise<void>;
  markAllRead(actor: User): Promise<void>;
  announce(actor: User, title: string, message: string): Promise<void>;
}
