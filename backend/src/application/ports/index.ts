import type {
  Booking,
  Catalogue,
  Driver,
  Route,
  RouteTicket,
  Role,
  Settings,
  TollPoint,
  TollPointInput,
  User,
  UserCredentials,
  Vehicle,
} from '../../domain/model.js';
export type Notification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  bookingId?: string;
  readAt?: string | null;
};
export type AccountingEntry = {
  id: string;
  type: 'charge' | 'revenu';
  category: string;
  label: string;
  amount: number;
  date: string;
  automatic: boolean;
  bookingId?: string;
  reference?: string;
  bookingReference?: string;
};
export type ManualAccountingInput = Omit<
  AccountingEntry,
  'id' | 'automatic' | 'bookingId' | 'reference' | 'bookingReference'
>;
export interface AccountingRepository {
  list(month?: string): Promise<AccountingEntry[]>;
  create(input: ManualAccountingInput): Promise<AccountingEntry>;
  void(id: string): Promise<boolean>;
}
export type NotificationDelivery = { userId: string; notification: Notification };
export interface NotificationRepository {
  list(userId: string): Promise<Notification[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  publish(
    notification: Notification,
    recipients: { userIds?: string[]; roles?: Role[] },
  ): Promise<NotificationDelivery[]>;
}
export interface NotificationPublisher {
  subscribe(user: User, send: (notification: Notification) => void): () => void;
  publish(
    notification: Notification,
    recipients: { userIds?: string[]; roles?: Role[] },
  ): Promise<void>;
}
export interface UserRepository {
  findByPhone(phone: string): Promise<UserCredentials | null>;
  create(user: UserCredentials): Promise<User>;
  updatePassword(userId: string, hash: string): Promise<void>;
  updateProfile(userId: string, name: string, phone: string, photo?: string | null): Promise<User>;
}
export interface SessionRepository {
  create(hash: string, userId: string, expiresAt: Date): Promise<void>;
  findUser(hash: string): Promise<User | null>;
  delete(hash: string): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
}
export interface CatalogueRepository {
  get(): Promise<Catalogue>;
  update(vehicles: Vehicle[], settings: Settings): Promise<void>;
  listTollPoints(): Promise<TollPoint[]>;
  createTollPoint(input: TollPointInput): Promise<TollPoint>;
  updateTollPoint(id: string, input: TollPointInput): Promise<TollPoint>;
  deleteTollPoint(id: string): Promise<void>;
}
export interface BookingRepository {
  list(userId?: string, vehicleId?: string): Promise<Booking[]>;
  find(id: string): Promise<Booking | null>;
  create(booking: Booking, requestId: string): Promise<Booking>;
  update(booking: Booking, expectedVersion: number): Promise<Booking>;
  startTrip(bookingId: string, photos: string[]): Promise<void>;
  addTripLoadingPhotos(bookingId: string, photos: string[]): Promise<void>;
  finishTrip(bookingId: string, photos: string[]): Promise<void>;
  delete?(id: string): Promise<void>;
}
export interface DriverRepository {
  list(): Promise<Driver[]>;
  find(id: string): Promise<Driver | null>;
  findByUserId(userId: string): Promise<Driver | null>;
  create(driver: Driver): Promise<Driver>;
  update(driver: Driver): Promise<Driver>;
}
export type VehicleInspectionInput = {
  levels: Record<string, 'good' | 'low' | 'empty'>;
  condition: 'good' | 'attention' | 'unsafe';
  notes: string;
  photos: string[];
};
export type BreakdownInput = {
  description: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  photos: string[];
};
export type VehicleReportRecord = Record<string, unknown>;
export interface VehicleReportRepository {
  createInspection(
    driverId: string,
    vehicleId: string,
    date: string,
    input: VehicleInspectionInput,
  ): Promise<VehicleReportRecord>;
  createBreakdown(
    driverId: string,
    vehicleId: string,
    input: BreakdownInput,
  ): Promise<VehicleReportRecord>;
  listInspections(): Promise<VehicleReportRecord[]>;
  listBreakdowns(): Promise<VehicleReportRecord[]>;
  listDriverInspections(driverId: string): Promise<VehicleReportRecord[]>;
  listDriverBreakdowns(driverId: string): Promise<VehicleReportRecord[]>;
  findInspection(driverId: string, date: string): Promise<VehicleReportRecord | null>;
}
export interface RouteRepository {
  save(route: RouteTicket): Promise<void>;
  find(id: string): Promise<RouteTicket | null>;
}
export interface RoutingProvider {
  route(from: [number, number], to: [number, number]): Promise<Route>;
  search(query: string): Promise<{ label: string; point: [number, number] }[]>;
  reverse(point: [number, number]): Promise<string>;
}
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}
export interface TokenProvider {
  create(): string;
  digest(token: string): string;
}
export interface Clock {
  now(): Date;
}
export interface IdGenerator {
  next(): string;
}
export interface AdministrationRepository {
  listUsers(): Promise<User[]>;
  listHiddenClients(): Promise<{ phone: string; hiddenAt: string }[]>;
  hideClient(phone: string): Promise<{ phone: string; hiddenAt: string }>;
  updateClient(phone: string, name: string, nextPhone: string): Promise<void>;
  transaction<T>(work: (repository: AdministrationTransaction) => Promise<T>): Promise<T>;
}
export interface AdministrationTransaction {
  findUser(id: string): Promise<User | null>;
  countActiveAdministrators(): Promise<number>;
  saveUser(user: User): Promise<User>;
  revokeSessions(userId: string): Promise<void>;
}
