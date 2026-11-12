import type { Draft } from '../booking-draft';
import type { TollExtraLine } from '../../../moving/domain/tolls/toll-selection';
import type {
  Catalogue,
  Options,
  QuoteInput,
  RentalKitItem,
  Vehicle,
} from '../../../shared/domain/model';
import type { BookingQuoteConfig } from '../services/booking-quote-preview';

export type AdministrativeQuoteSubmissionBuilder = (input: {
  draft: Draft;
  config?: BookingQuoteConfig;
  catalogue: Catalogue | null;
  fallbackVehicle: Vehicle;
  kind: QuoteInput['kind'];
  tier: number;
  version: number;
  notes: string;
  options?: Options;
  extraLines: QuoteInput['extraLines'];
  tollLines: TollExtraLine[];
  getRentalKit?: () => RentalKitItem[];
}) => QuoteInput;
