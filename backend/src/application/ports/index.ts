import type {
  Booking,
  Catalogue,
  Driver,
  Route,
  RouteTicket,
  Role,
  Settings,
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
};
export interface NotificationPublisher {
  subscribe(user: User, send: (notification: Notification) => void): () => void;
  publish(notification: Notification, recipients: { userIds?: string[]; roles?: Role[] }): void;
}
export interface UserRepository {
  findByPhone(phone: string): Promise<UserCredentials | null>;
  create(user: UserCredentials): Promise<User>;
  updatePassword(userId: string, hash: string): Promise<void>;
  updateProfile(userId: string, name: string, phone: string): Promise<void>;
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
}
export interface BookingRepository {
  list(userId?: string): Promise<Booking[]>;
  find(id: string): Promise<Booking | null>;
  create(booking: Booking, requestId: string): Promise<Booking>;
  update(booking: Booking, expectedVersion: number): Promise<Booking>;
}
export interface DriverRepository {
  list(): Promise<Driver[]>;
  find(id: string): Promise<Driver | null>;
  findByUserId(userId: string): Promise<Driver | null>;
  create(driver: Driver): Promise<Driver>;
  update(driver: Driver): Promise<Driver>;
}
export interface RouteRepository {
  save(route: RouteTicket): Promise<void>;
  find(id: string): Promise<RouteTicket | null>;
}
export interface RoutingProvider {
  route(from: [number, number], to: [number, number]): Promise<Route>;
  search(query: string): Promise<{ label: string; point: [number, number] }[]>;
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
  transaction<T>(work: (repository: AdministrationTransaction) => Promise<T>): Promise<T>;
}
export interface AdministrationTransaction {
  findUser(id: string): Promise<User | null>;
  countActiveAdministrators(): Promise<number>;
  saveUser(user: User): Promise<User>;
  revokeSessions(userId: string): Promise<void>;
}
