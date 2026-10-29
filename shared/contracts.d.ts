export type Role = 'client' | 'admin' | 'driver';
export type User = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  active?: boolean;
  photo?: string | null;
  passwordResetRequestedAt?: string | null;
};
export type UserCredentials = User & { passwordHash: string };
export type Point = [number, number];
export type Vehicle = {
  id: string;
  name: string;
  shortName?: string;
  volume: string;
  length: string;
  height: string;
  width: string;
  wheelWidth: string;
  image: string;
  interior: string;
  active?: boolean;
  prices: [number, number, number];
};
export type BookingSlot = { label: string; startHour: number };
export type Driver = {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  photo: string | null;
  active: boolean;
  vehicleId: string | null;
  availability?: DriverAvailabilityDay[];
  role?: 'chauffeur' | 'menuisier' | 'manoeuvre';
  authorizedVehicleIds?: string[];
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAddress?: string | null;
  tags?: string[];
  notes?: string;
  refusals?: { ref: string; at: string }[];
  clearedRefusals?: number;
};
export type DriverAvailabilityDay = {
  available: boolean;
  startTime: string;
  endTime: string;
};
export type BookingRules = {
  bookingsEnabled: boolean;
  maxAdvanceDays: number;
  minNoticeHours: number;
  maxOptions: number;
  maxTrips: number;
  clientCancellation: boolean;
  cancellationNoticeHours: number;
  enabledSlots: BookingSlot[];
};
export type ClientQuestion = {
  id: string;
  group: string;
  label: string;
  answerType: 'text' | 'yes_no';
  required: boolean;
  active: boolean;
};
export type ClientQuestionAnswer = {
  questionId: string;
  group: string;
  question: string;
  answer: string;
};
export type Settings = BookingRules & {
  distanceBounds: [number, number, number];
  labourPrice: number;
  labourFloorPrice?: number;
  labourLiftPrice?: number;
  labourMatrix?: LabourPriceMatrix;
  assemblyPrice: number;
  montageP?: Record<
    string,
    | number
    | {
        local?: number;
        import?: number;
        u?: number;
        uI?: number;
        sz?: Record<string, { local?: number; import?: number }>;
      }
  >;
  businessPhone: string;
  whatsappPhone: string;
  whatsappCountryCode?: string;
  whatsappMode?: 'api' | 'wame' | 'web' | 'app';
  whatsappQuoteTemplate?: string;
  businessName: string;
  businessAddress: string;
  invoiceFooter: string;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  invoiceLogo: string | null;
  invoiceStamp: string | null;
  invoiceSignature: string | null;
  questionnaire?: ClientQuestion[];
  movingLaborPlanning?: MovingLaborPlanningSettings;
};
export type MovingLaborPlanningSettings = {
  maxHandlingHours: number;
  maxDayHours: number;
  defaultStartHour: number;
  maxMoversPerVehicle: number;
  cubicMetersPerHourPerMover: number;
  pauseMinutes: number;
};
export type LabourMatrixScenario = 'none' | 'from' | 'to' | 'both';
export type LabourPriceMatrix = Record<LabourMatrixScenario, number[][]>;
export type Catalogue = { vehicles: Vehicle[]; settings: Settings };
export type TollPoint = {
  id: string;
  name: string;
  region: string;
  axis: string;
  heavyPrice: number;
  vehiclePrices: Record<string, number>;
  latitude: number | null;
  longitude: number | null;
};
export type TollPointInput = Omit<TollPoint, 'id'>;
export type Options = { labour: number; desk: number; wardrobe: number; bed: number };
export type WorkAccess = {
  fromFloor: number;
  toFloor: number;
  fromLift: boolean;
  toLift: boolean;
};
export type PriceLine = { label: string; quantity: number; unitPrice: number; total: number };
export type Price = {
  lines: PriceLine[];
  total: number | null;
  discount: number;
  discountLabel?: string;
  discountType?: 'fcfa' | 'pct';
  discountValue?: number;
  discountReason?: string;
  tier: number;
  trips: number;
  currency: 'XOF';
};
export type Route = {
  from: Point;
  to: Point;
  distanceKm: number;
  durationMinutes: number;
  geometry: Point[];
  fallback?: boolean;
};
export type RouteTicket = Route & { id: string; expiresAt: string };
export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type BookingTrip = {
  id: string;
  sequence: number;
  loadingPhotos: string[];
  unloadingPhotos: string[] | null;
  startedAt: string;
  finishedAt: string | null;
};
export type BookingReminder = { at: string; daysBefore: number };
export type WorkPlanCompliance = 'pending' | 'respected' | 'late' | 'not_respected';
export type WorkPlanReview = {
  status: WorkPlanCompliance;
  reason: string;
  actualTime?: string;
  photo?: string;
  cause?: string;
  severity?: 'min' | 'maj' | 'cri' | '';
  correctiveAction?: string;
  checkedAt: string | null;
  checkedBy: string | null;
};
export type WorkPlanStep = {
  id: string;
  time: string;
  title: string;
  detail: string;
  minutes: number;
  review: WorkPlanReview;
};
export type WorkPlanStepInput = Pick<WorkPlanStep, 'id' | 'time' | 'title' | 'detail' | 'minutes'>;
export type InventorySnapshotItem = {
  section: string;
  label: string;
  quantity: number;
  details: string;
  volumeM3: number;
};
export type BookingInventorySource = {
  dwellingType: string;
  annexOn?: boolean;
  fromFloor: number;
  toFloor: number;
  fromLift: boolean;
  toLift: boolean;
  entries: Record<
    string,
    {
      quantity: number;
      size: number;
      format?: 'small' | 'medium' | 'large';
      dismantle: boolean;
      menuisier?: boolean;
      origin?: 'local' | 'import';
    }
  >;
  variants: {
    id: string;
    itemKey: string;
    quantity: number;
    size: number;
    format?: 'small' | 'medium' | 'large';
    dismantle: boolean;
    menuisier?: boolean;
    origin?: 'local' | 'import';
  }[];
  flags: Record<string, boolean>;
  ready?: 'oui' | 'non' | '';
  stairs?: 'oui' | 'non' | 'verif' | '';
  custom: {
    id: string;
    label: string;
    quantity: number;
    format?: 'small' | 'medium' | 'large';
    dismantle?: boolean;
    origin?: 'local' | 'import';
  }[];
  crew?: number;
};
export type BookingInventorySnapshot = {
  sourceInventory?: BookingInventorySource;
  dwellingType: string;
  annexIncluded: boolean;
  annexVolumeM3: number;
  fromFloor: number;
  toFloor: number;
  fromLift: boolean;
  toLift: boolean;
  ready: 'oui' | 'non' | '';
  stairs: 'oui' | 'non' | 'verif' | '';
  flags: string[];
  items: InventorySnapshotItem[];
  itemCount: number;
  totalVolumeM3: number;
  vehicleCapacityM3: number;
  fillRate: number;
  estimatedTrips: number;
  moverCount: number;
  carpenterCount: number;
  loadingMinutes: number;
  unloadingMinutes: number;
  packingMinutes: number;
  travelMinutes: number;
  travelLegMinutes?: number;
  totalMinutes: number;
  lowDurationMinutes: number;
  highDurationMinutes: number;
  startTime: string;
  endTime: string;
};
export type VehicleInspectionPhotos = {
  engineOil: string;
  coolant: string;
  brakeFluid: string;
  powerSteering: string;
  washerFluid: string;
  condition: string[];
};
export type Quote = {
  id: string;
  reference: string;
  kind: 'provisional' | 'final';
  createdAt: string;
  price: Price;
  notes: string;
  options?: Options;
  tolls?: QuoteTollLine[];
};
export type QuoteTollLine = {
  tollPointId: string;
  label: string;
  quantity: number;
  unitPrice: number;
};
export type Booking = {
  id: string;
  reference: string;
  userId: string;
  driverId?: string | null;
  crew?: { chauffeur: string[]; menuisier: string[]; manoeuvre: string[]; chef: string };
  crewBriefs?: Record<string, string>;
  crewRefusedBy?: string[];
  crewReplies?: Record<string, 'ok' | 'no'>;
  crewMessages?: Record<string, string>;
  customerName: string;
  phone: string;
  source?: string;
  vehicle: Vehicle;
  fromAddress: string;
  toAddress: string;
  from: Point;
  to: Point;
  distanceKm: number;
  date: string | null;
  month?: string;
  timeSlot: string;
  options: Options;
  workAccess?: WorkAccess;
  notes: string;
  questionnaireAnswers?: ClientQuestionAnswer[];
  status: BookingStatus;
  pricingSettings?: Settings;
  estimate: Price;
  quotes: Quote[];
  trips?: BookingTrip[];
  workPlan?: WorkPlanStep[];
  inventorySnapshot?: BookingInventorySnapshot;
  reminders?: BookingReminder[];
  driverFinishedAt?: string | null;
  createdAt: string;
  version: number;
};
export type BookingInput = {
  vehicleId: string;
  routeId: string;
  distanceKmOverride?: number | null;
  trips?: number;
  customerName: string;
  customerPhone: string;
  source?: string;
  fromAddress: string;
  toAddress: string;
  date: string | null;
  month?: string;
  timeSlot: string;
  options: Options;
  workAccess?: WorkAccess;
  notes: string;
  questionnaireAnswers?: ClientQuestionAnswer[];
  workPlan?: WorkPlanStepInput[];
  inventorySnapshot?: BookingInventorySnapshot;
  requestId: string;
};
export type QuoteInput = {
  kind: 'provisional' | 'final';
  trips: number;
  customPrice: number | null;
  labourUnitPriceOverride?: number | null;
  discount: number;
  discountType?: 'fcfa' | 'pct';
  discountReason?: string;
  notes: string;
  extraLines: Array<{ label: string; quantity: number; unitPrice: number }>;
  tolls?: Array<{
    tollPointId: string;
    direction: 'one-way' | 'round-trip';
    quantity: number;
  }>;
  options?: Options;
  version: number;
};
