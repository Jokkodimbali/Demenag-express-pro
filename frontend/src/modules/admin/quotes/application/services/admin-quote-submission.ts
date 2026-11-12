import type { AdministrativeQuoteSubmissionBuilder } from '../../../../booking/application/contracts/admin-quote-submission';
import { quoteTollsFromLines } from '../../../../moving/domain/tolls/toll-selection';
import { defaultRentalKit } from '../../../../moving/domain/rental-kit';
import { defaultAdminQuoteConfig } from './admin-quote-config';

export const buildAdminQuoteSubmission: AdministrativeQuoteSubmissionBuilder = (input) => {
  const { draft, catalogue } = input;
  const config = input.config ?? defaultAdminQuoteConfig();
  const rentalKit =
    config.billingMode === 'driver-rental'
      ? (config.rentalKit ??
        input.getRentalKit?.() ??
        defaultRentalKit(
          catalogue?.vehicles.find((vehicle) => vehicle.id === draft.vehicleId) ??
            input.fallbackVehicle,
          draft.options.labour,
          catalogue?.settings.rentalKitConfiguration,
        ))
      : [];
  return {
    kind: input.kind,
    trips: config.trips,
    customPrice: input.tier === 3 ? config.customPrice : null,
    labourUnitPriceOverride: config.labourUnitPriceOverride,
    discount: config.discount,
    discountType: config.discountType,
    discountReason: config.discountReason,
    notes: input.notes,
    extraLines: input.extraLines,
    tolls: quoteTollsFromLines(input.tollLines),
    options: input.options ?? draft.options,
    version: input.version,
    billingMode: config.billingMode,
    menuIncluded: config.menuIncluded,
    rentalKit,
    overtimeMinutes: config.overtimeMinutes,
    providedCrew: draft.options.labour,
  };
};
