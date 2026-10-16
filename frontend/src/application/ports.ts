import type {
  Booking,
  BookingInput,
  BookingStatus,
  Catalogue,
  Options,
  Point,
  Price,
  QuoteInput,
  RouteTicket,
  User,
} from '../domain/model';
export interface ApplicationApi {
  users(): Promise<User[]>;
  updateUser(user: User): Promise<User>;
  createUser(user: Omit<User, 'id'> & { password: string }): Promise<User>;
  catalogue(): Promise<Catalogue>;
  updateCatalogue(value: Catalogue): Promise<Catalogue>;
  me(): Promise<User | null>;
  login(phone: string, password: string): Promise<User>;
  register(name: string, phone: string, password: string): Promise<User>;
  logout(): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<User>;
  bookings(): Promise<Booking[]>;
  booking(id: string): Promise<Booking>;
  createBooking(input: BookingInput): Promise<Booking>;
  status(id: string, status: BookingStatus, version: number): Promise<Booking>;
  quote(id: string, input: QuoteInput): Promise<Booking>;
  route(from: Point, to: Point): Promise<RouteTicket>;
  search(query: string): Promise<{ label: string; point: Point }[]>;
  estimate(
    vehicleId: string,
    routeId: string,
    options: Options,
    signal?: AbortSignal,
  ): Promise<Price>;
}
