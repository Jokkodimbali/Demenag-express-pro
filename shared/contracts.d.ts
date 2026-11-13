export type Role = 'client' | 'admin' | 'driver';
export type AccountingFixedChargeKey =
  'sal' | 'vid' | 'ass' | 'amo' | 'anx' | 'res' | 'det' | 'leg';
export type AccountingFinanceConfiguration = {
  regime: 'auto' | 'informel' | 'suarl';
  suarlFrom: string;
  isRate: number;
  start: string;
  debt: number;
  debtMonths: number;
  fleetValue: number;
  fleetYears: number;
  newVehicleTarget: number;
  profitCapPercent: number;
  moverCostPerMove: number;
  monthlyProfitTarget: number;
  averageMovingPrice: number;
  vehicleCount: number;
  oilChangeCost: number;
  oilChangeIntervalMonths: number;
  vehicleInsuranceAnnual: number;
  legalReservePercent: number;
  legalReserveCapitalPercent: number;
  monthlyFixedChargePostings: { month: string; key: AccountingFixedChargeKey; amount: number }[];
  financeChat: { speaker: 'user' | 'assistant'; message: string }[];
  menuPrices: Record<
    string,
    {
      local?: number;
      import?: number;
      sz?: Record<string, { local?: number; import?: number }>;
    }
  >;
  salaries: { id: string; name: string; amount: number }[];
  annexes: { id: string; label: string; value: number; years: number }[];
  vehiclePurchases: { id: string; month: string; price: number }[];
  advertising: Record<string, Record<string, number>>;
};
export type AccountingEntry = {
  id: string;
  type: 'charge' | 'revenu';
  category: string;
  label: string;
  amount: number;
  date: string;
  automatic: boolean;
  quantity?: number;
  bookingId?: string;
  reference?: string;
  bookingReference?: string;
  referenceFixedKey?: AccountingFixedChargeKey;
};
export type ManualAccountingInput = Pick<
  AccountingEntry,
  'type' | 'category' | 'label' | 'amount' | 'date'
>;
export type User = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
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
  hint?: string;
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
export type CustomInventoryType = {
  k: string;
  n: string;
  p?: string;
  sec: string;
  like?: string;
  L?: number | '';
  W?: number | '';
  H?: number | '';
  kg?: number | '';
  menuPriceLocal?: number | '';
  menuPriceImport?: number | '';
  dm?: boolean;
  up?: boolean;
  frag?: boolean;
  notop?: boolean;
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
  whatsappProvisionalTemplate?: string;
  contactFirstTemplate?: string;
  contactLastTemplate?: string;
  businessName: string;
  businessAddress: string;
  businessEmail?: string;
  businessNinea?: string;
  businessRccm?: string;
  quoteValidityDays?: number;
  bookingDepositPercent?: number;
  quoteTerms?: string;
  quoteTermsEnabled?: boolean;
  rentalOvertimeHourlyRate?: number;
  rentalKitConfiguration?: RentalKitConfigurationItem[];
  invoiceFooter: string;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  invoiceLogo: string | null;
  invoiceStamp: string | null;
  invoiceSignature: string | null;
  paymentWave?: boolean;
  paymentCash?: boolean;
  paymentQr?: string | null;
  questionnaire?: ClientQuestion[];
  movingLaborPlanning?: MovingLaborPlanningSettings;
  customInventoryTypes?: CustomInventoryType[];
  hiddenInventoryKeys?: string[];
};
export type MovingLaborPlanningSettings = {
  maxHandlingHours: number;
  maxDayHours: number;
  defaultStartHour: number;
  maxMoversPerVehicle: number;
  cubicMetersPerHourPerMover: number;
  pauseMinutes: number;
  teamVolumePerMover?: number;
  tripSetupMinutes?: number;
  handlingCalibration?: number;
  carryDistanceMeters?: number;
  heat?: number;
  wbgtAdj?: number;
  blanketLengthCm?: number;
  blanketWidthCm?: number;
  blanketStock?: number;
  maxTotalHours?: number;
  metabolicReference?: number;
  effortGround?: number;
  effortLift?: number;
  effortStairs?: number;
  effortPerFloor?: number;
  effortMaximum?: number;
  followingTripDiscountPercent?: number;
  lowDemandDiscountPercent?: number;
  manoeuvreOvertimeThresholdHours?: number;
  manoeuvreOvertimeHourlyRate?: number;
  fill?: number;
  fillF?: number;
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
  stairs?: 'oui' | 'non' | 'balcon' | 'verif' | '';
  balcPx?: number;
  blanketLengthCm?: number;
  blanketWidthCm?: number;
  custom: {
    id: string;
    typeKey?: string;
    label: string;
    quantity: number;
    format?: 'small' | 'medium' | 'large';
    dismantle?: boolean;
    origin?: 'local' | 'import';
    cL?: number;
    cW?: number;
    cH?: number;
    kg?: number;
    mp?: number;
    menuPriceLocal?: number;
    menuPriceImport?: number;
    like?: string;
    up?: boolean;
    frag?: boolean;
    notop?: boolean;
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
  stairs: 'oui' | 'non' | 'balcon' | 'verif' | '';
  balcPx?: number;
  flags: string[];
  items: InventorySnapshotItem[];
  itemCount: number;
  totalVolumeM3: number;
  vehicleCapacityM3: number;
  fillRate: number;
  estimatedTrips: number;
  moverCount: number;
  carpenterCount: number;
  totalWeightKg?: number;
  maxItemWeightKg?: number;
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
  pricingInput?: QuotePricingInput;
  accountingCosts?: {
    movers: number;
    moverAmount: number;
    carpenters: number;
    carpenterAmount: number;
  };
  billingMode?: 'complete' | 'standard' | 'driver-rental';
  menuIncluded?: boolean;
  rentalKit?: RentalKitItem[];
  overtimeMinutes?: number;
  providedCrew?: number;
};
export type RentalKitItem = { id: string; label: string; quantity: number; image?: string };
export type RentalKitRule =
  'vehicle' | 'one' | 'blankets' | 'liftingStraps' | 'gloves' | 'tieDownStraps' | 'fixed';
export type RentalKitConfigurationItem = {
  id: string;
  label: string;
  rule: RentalKitRule;
  quantity?: number;
  image?: string;
};
export type QuotePricingSettings = Pick<
  Settings,
  | 'distanceBounds'
  | 'maxTrips'
  | 'maxOptions'
  | 'labourPrice'
  | 'labourFloorPrice'
  | 'labourLiftPrice'
  | 'assemblyPrice'
  | 'montageP'
  | 'movingLaborPlanning'
>;
export type QuotePricingInput = {
  settings: QuotePricingSettings;
  trips: number;
  customPrice: number | null;
  discount: number;
  discountType: 'fcfa' | 'pct';
  discountReason: string;
  options: Options;
  labourUnitPriceOverride: number | null;
  extraLines: Array<{ label: string; quantity: number; unitPrice: number }>;
  billingMode?: 'complete' | 'standard' | 'driver-rental';
  menuIncluded?: boolean;
  overtimeMinutes?: number;
  rentalOvertimeHourlyRate?: number;
};
export type QuoteTollLine = {
  tollPointId: string;
  label: string;
  quantity: number;
  unitPrice: number;
};
export type Booking = {
  employeeProofs?: {
    id: string;
    employeeId: string;
    kind: 'retrait' | 'depot';
    image: string;
    createdAt: string;
    note: string;
  }[];
  id: string;
  reference: string;
  userId: string;
  driverId?: string | null;
  crew?: { chauffeur: string[]; menuisier: string[]; manoeuvre: string[]; chef: string };
  crewBriefs?: Record<string, string>;
  crewRefusedBy?: string[];
  crewReplies?: Record<string, 'ok' | 'no'>;
  crewMessages?: Record<string, string>;
  crewAddressChange?: { from: boolean; to: boolean; at: string };
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
  pricingSnapshot?: BookingPricingSnapshot;
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
export type BookingPricingSnapshot = {
  capturedAt: string;
  vehiclePrices: Record<string, [number, number, number]>;
  tollPoints: TollPoint[];
  accounting: Pick<AccountingFinanceConfiguration, 'moverCostPerMove' | 'menuPrices'> | null;
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
  inventorySnapshot?: BookingInventorySnapshot | null;
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
  billingMode?: 'complete' | 'standard' | 'driver-rental';
  menuIncluded?: boolean;
  rentalKit?: RentalKitItem[];
  overtimeMinutes?: number;
  providedCrew?: number;
};
