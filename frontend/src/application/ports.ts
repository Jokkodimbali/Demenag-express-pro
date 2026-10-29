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
  WorkPlanCompliance,
  WorkPlanReview,
} from '../domain/model';
export interface UserRepository {
  users(): Promise<User[]>;
  updateUser(user: User): Promise<User>;
  createUser(user: Omit<User, 'id'> & { password: string }): Promise<User>;
  resetClientPassword(id: string, password: string): Promise<void>;
}
export interface AdminProfileRepository {
  adminProfile(): Promise<User>;
  updateAdminProfile(input: Pick<User, 'name' | 'phone' | 'photo'>): Promise<User>;
}
export interface ClientDirectoryRepository {
  hiddenClients(): Promise<{ phone: string; hiddenAt: string }[]>;
  updateClient(phone: string, input: { name: string; phone: string }): Promise<void>;
  hideClient(phone: string): Promise<{ phone: string; hiddenAt: string }>;
}
export interface CatalogueRepository {
  catalogue(): Promise<Catalogue>;
  updateCatalogue(value: Catalogue): Promise<Catalogue>;
  deleteVehicle(id: string): Promise<void>;
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
  requestPasswordReset(phone: string): Promise<void>;
  register(name: string, phone: string, password: string): Promise<User>;
  logout(): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<User>;
}
export interface BookingRepository {
  bookings(): Promise<Booking[]>;
  booking(id: string): Promise<Booking>;
  deleteBooking(id: string): Promise<void>;
  createBooking(input: BookingInput): Promise<Booking>;
  updateClientBooking(id: string, input: BookingInput, version: number): Promise<Booking>;
  updateAdminBooking(id: string, input: BookingInput, version: number): Promise<Booking>;
  recordBookingReminder(id: string): Promise<Booking>;
  status(id: string, status: BookingStatus, version: number): Promise<Booking>;
  startBookingTrip(id: string, photos: string[]): Promise<Booking>;
  finishBookingTrip(id: string, photos: string[]): Promise<Booking>;
  finishDriverWork(id: string): Promise<Booking>;
  schedule(id: string, date: string | null, timeSlot: string, version: number): Promise<Booking>;
  updateBookingNotes(id: string, notes: string, version: number): Promise<Booking>;
  reviewWorkPlan(
    id: string,
    stepId: string,
    status: WorkPlanCompliance,
    reason: string,
    version: number,
    actualTime?: string,
    photo?: string,
    details?: Pick<WorkPlanReview, 'cause' | 'severity' | 'correctiveAction'>,
  ): Promise<Booking>;
  updateBookingRoute(id: string, from: Point, to: Point, version: number): Promise<Booking>;
  quote(id: string, input: QuoteInput): Promise<Booking>;
  assignDriver(id: string, driverId: string | null, version: number): Promise<Booking>;
  updateCrew(
    id: string,
    input: {
      crew: NonNullable<Booking['crew']>;
      crewBriefs: NonNullable<Booking['crewBriefs']>;
      crewRefusedBy: NonNullable<Booking['crewRefusedBy']>;
      crewReplies: NonNullable<Booking['crewReplies']>;
      crewMessages: NonNullable<Booking['crewMessages']>;
      version: number;
    },
  ): Promise<Booking>;
}
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
export type ManualAccountingInput = Pick<
  AccountingEntry,
  'type' | 'category' | 'label' | 'amount' | 'date'
>;
export interface AccountingRepository {
  accountingEntries(month?: string): Promise<AccountingEntry[]>;
  createAccountingEntry(input: ManualAccountingInput): Promise<AccountingEntry>;
  voidAccountingEntry(id: string): Promise<void>;
}
export type DriverCreation = Omit<Driver, 'id' | 'userId' | 'active'> & { password?: string };
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
  deleteDriver(id: string): Promise<{ removed: boolean; employee: Driver }>;
  driverProfile(): Promise<Driver>;
  updateDriverProfile(input: Pick<Driver, 'name' | 'phone' | 'photo'>): Promise<Driver>;
  updateDriverAvailability(availability: NonNullable<Driver['availability']>): Promise<Driver>;
  driverBookings(): Promise<Booking[]>;
  addEmployeeProofs(id: string, kind: 'retrait' | 'depot', photos: string[]): Promise<Booking>;
  submitEmployeeInspection(input: {
    vehicleId: string;
    items: Record<string, { image: string; ok: boolean }>;
  }): Promise<VehicleInspection>;
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
    workAccess?: import('../domain/model').WorkAccess,
    trips?: number,
    distanceKmOverride?: number | null,
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
    ClientDirectoryRepository,
    CatalogueRepository,
    TollPointRepository,
    AuthRepository,
    BookingRepository,
    DriverRepository,
    MapsRepository,
    PricingRepository,
    NotificationRepository,
    AccountingRepository {}
export type QuoteExporter = (
  booking: Booking,
  quote: Quote | undefined,
  settings: Settings,
) => Promise<Blob>;
