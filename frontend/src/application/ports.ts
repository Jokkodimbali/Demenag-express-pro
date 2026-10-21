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
  Settings,
  TollPoint,
  TollPointInput,
  User,
  Driver,
  VehicleInspectionPhotos,
} from '../domain/model';
export interface UserRepository {
  users(): Promise<User[]>;
  updateUser(user: User): Promise<User>;
  createUser(user: Omit<User, 'id'> & { password: string }): Promise<User>;
}
export interface AdminProfileRepository {
  adminProfile(): Promise<User>;
  updateAdminProfile(input: Pick<User, 'name' | 'phone' | 'photo'>): Promise<User>;
}
export interface CatalogueRepository {
  catalogue(): Promise<Catalogue>;
  updateCatalogue(value: Catalogue): Promise<Catalogue>;
}
export interface TollPointRepository {
  tollPoints(): Promise<TollPoint[]>;
  createTollPoint(input: TollPointInput): Promise<TollPoint>;
  updateTollPoint(id: string, input: TollPointInput): Promise<TollPoint>;
  deleteTollPoint(id: string): Promise<void>;
}
export interface AuthRepository {
  onSessionExpired?(listener: () => void): () => void;
  me(): Promise<User | null>;
  login(phone: string, password: string): Promise<User>;
  register(name: string, phone: string, password: string): Promise<User>;
  logout(): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<User>;
}
export interface BookingRepository {
  bookings(): Promise<Booking[]>;
  booking(id: string): Promise<Booking>;
  deleteBooking(id: string): Promise<void>;
  createBooking(input: BookingInput): Promise<Booking>;
  status(id: string, status: BookingStatus, version: number): Promise<Booking>;
  startBookingTrip(id: string, photos: string[]): Promise<Booking>;
  finishBookingTrip(id: string, photos: string[]): Promise<Booking>;
  finishDriverWork(id: string): Promise<Booking>;
  schedule(id: string, date: string | null, timeSlot: string, version: number): Promise<Booking>;
  updateBookingNotes(id: string, notes: string, version: number): Promise<Booking>;
  updateBookingRoute(id: string, from: Point, to: Point, version: number): Promise<Booking>;
  quote(id: string, input: QuoteInput): Promise<Booking>;
  assignDriver(id: string, driverId: string | null, version: number): Promise<Booking>;
}
export type DriverCreation = Omit<Driver, 'id' | 'userId' | 'active'> & { password: string };
export type InspectionLevels = Record<string, 'good' | 'low' | 'empty'>;
export type VehicleInspection = {
  id: string;
  driverName: string;
  driverPhone: string;
  vehicleName: string;
  date: string;
  levels: InspectionLevels;
  condition: 'good' | 'attention' | 'unsafe';
  notes: string;
  photos: string[];
  createdAt: string;
};
export type BreakdownReport = {
  id: string;
  driverName: string;
  driverPhone: string;
  vehicleName: string;
  description: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  photos: string[];
  status: string;
  createdAt: string;
};
export type VehicleReports = { inspections: VehicleInspection[]; breakdowns: BreakdownReport[] };
export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  bookingId?: string;
  readAt?: string | null;
};
export type NotificationInbox = { items: AppNotification[]; unreadCount: number };
export interface DriverRepository {
  drivers(): Promise<Driver[]>;
  createDriver(input: DriverCreation): Promise<Driver>;
  updateDriver(driver: Omit<Driver, 'userId'>): Promise<Driver>;
  driverProfile(): Promise<Driver>;
  updateDriverProfile(input: Pick<Driver, 'name' | 'phone' | 'photo'>): Promise<Driver>;
  driverBookings(): Promise<Booking[]>;
  driverReports(): Promise<VehicleReports>;
  submitVehicleInspection(
    input: Omit<
      VehicleInspection,
      'id' | 'driverName' | 'driverPhone' | 'vehicleName' | 'date' | 'createdAt' | 'photos'
    > & { photos: VehicleInspectionPhotos },
  ): Promise<VehicleInspection>;
  reportBreakdown(
    input: Pick<BreakdownReport, 'description' | 'latitude' | 'longitude' | 'accuracy' | 'photos'>,
  ): Promise<BreakdownReport>;
  adminVehicleReports(): Promise<VehicleReports>;
}
export interface MapsRepository {
  route(from: Point, to: Point): Promise<RouteTicket>;
  search(query: string): Promise<{ label: string; point: Point }[]>;
  reverse(point: Point): Promise<{ label: string }>;
}
export interface PricingRepository {
  estimate(
    vehicleId: string,
    routeId: string,
    options: Options,
    signal?: AbortSignal,
  ): Promise<Price>;
}
export interface NotificationRepository {
  notifications(): Promise<NotificationInbox>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  announceDrivers(title: string, message: string): Promise<void>;
}

export interface ApplicationApi
  extends
    UserRepository,
    AdminProfileRepository,
    CatalogueRepository,
    TollPointRepository,
    AuthRepository,
    BookingRepository,
    DriverRepository,
    MapsRepository,
    PricingRepository,
    NotificationRepository {}
export type QuoteExporter = (
  booking: Booking,
  quote: Quote | undefined,
  settings: Settings,
) => Promise<Blob>;
