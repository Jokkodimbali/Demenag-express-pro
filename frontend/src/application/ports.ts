import type {
  Booking,
  BookingInput,
  BookingStatus,
  Catalogue,
  Options,
  Point,
  Price,
  Quote,
  QuoteInput,
  RouteTicket,
  User,
} from '../domain/model';
export interface UserRepository {
  users(): Promise<User[]>;
  updateUser(user: User): Promise<User>;
  createUser(user: Omit<User, 'id'> & { password: string }): Promise<User>;
}
export interface CatalogueRepository {
  catalogue(): Promise<Catalogue>;
  updateCatalogue(value: Catalogue): Promise<Catalogue>;
}
export interface AuthRepository {
  me(): Promise<User | null>;
  login(phone: string, password: string): Promise<User>;
  register(name: string, phone: string, password: string): Promise<User>;
  logout(): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<User>;
}
export interface BookingRepository {
  bookings(): Promise<Booking[]>;
  booking(id: string): Promise<Booking>;
  createBooking(input: BookingInput): Promise<Booking>;
  status(id: string, status: BookingStatus, version: number): Promise<Booking>;
  quote(id: string, input: QuoteInput): Promise<Booking>;
}
export interface MapsRepository {
  route(from: Point, to: Point): Promise<RouteTicket>;
  search(query: string): Promise<{ label: string; point: Point }[]>;
}
export interface PricingRepository {
  estimate(
    vehicleId: string,
    routeId: string,
    options: Options,
    signal?: AbortSignal,
  ): Promise<Price>;
}

export interface ApplicationApi
  extends
    UserRepository,
    CatalogueRepository,
    AuthRepository,
    BookingRepository,
    MapsRepository,
    PricingRepository {}
export type QuoteExporter = (booking: Booking, quote?: Quote) => Promise<void>;
