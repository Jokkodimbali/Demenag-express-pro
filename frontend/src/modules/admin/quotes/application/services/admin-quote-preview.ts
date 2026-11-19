import type { AdminQuoteConfig } from './admin-quote-draft-storage';
import type { Draft } from '../../../../booking/application/booking-draft';
import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import type { MovingEstimate } from '../../../../moving/domain/estimate/moving-estimate';
import type { Options, Price, Quote, Settings, Vehicle } from '../../../../shared/domain/model';
import { assemblyUnitPrice } from '../../../../moving/domain/pricing/labour-price';
import { defaultRentalKit } from '../../../../moving/domain/rental-kit';
import {
  inventoryAssemblyLines,
  inventoryAssemblyOptions,
} from '../../../../moving/domain/inventory/inventory-assembly';
import { manoeuvreOvertimeLine } from './manoeuvre-overtime';
import { taxiPaidLegCount, taxiRotationCount } from './admin-quote-taxi';
import { quoteInventoryLines } from './quote-inventory-lines';
import { quoteTransportLines } from './quote-transport-lines';
import {
  applyTaxiToManoeuvrePrice,
  manoeuvreCount,
} from '../../../../../../../shared/quote-taxi-allocation.js';

type ExtraOption = [keyof Options, string, string];
type QuoteLine = { label: string; quantity: number; unitPrice: number; total: number };

function isManoeuvreOvertimeLine(label: string) {
  return /^(?:Majoration de travail de nuit|Man[œo]uvres · heures (?:au-delà|après 20 h))/iu.test(
    label,
  );
}

export function createAdminQuotePreview(input: {
  draft: Draft;
  estimateInventory: Inventory;
  config: AdminQuoteConfig;
  vehicle: Vehicle | null;
  estimate: MovingEstimate | null;
  settings?: Settings;
  price: Price | null;
  extras: ExtraOption[];
  labourPrice: number;
  applySnapshotLabourPrice?: boolean;
  simulationNeeds: { blankets: number; straps: number } | null;
  taxiPickupDistanceKm?: number | null;
  savedCustomLines?: { label: string; quantity: number; unitPrice: number }[];
  accountingOvertimeHourlyRate?: number | null;
}) {
  const {
    draft,
    estimateInventory,
    config,
    vehicle,
    estimate,
    settings,
    price,
    extras,
    labourPrice,
    applySnapshotLabourPrice = false,
  } = input;
  const savedCustomLineKeys = new Set(
    (input.savedCustomLines ?? []).map((line) =>
      JSON.stringify([line.label, line.quantity, line.unitPrice]),
    ),
  );
  const bounds = settings?.distanceBounds ?? [15, 25, 35];
  const distance = draft.distanceKmOverride ?? draft.route?.distanceKm;
  const tier = !draft.route
    ? 0
    : distance! < bounds[0]
      ? 0
      : distance! <= bounds[1]
        ? 1
        : distance! <= bounds[2]
          ? 2
          : 3;
  const transportUnit = tier === 3 ? (config.customPrice ?? 0) : (vehicle?.prices[tier] ?? 0);
  const tierLabel = [
    `moins de ${bounds[0]} km`,
    `${bounds[0]} – ${bounds[1]} km`,
    `${bounds[1]} – ${bounds[2]} km`,
    `plus de ${bounds[2]} km`,
  ][tier];
  const transportLines = quoteTransportLines({
    vehicle,
    tierLabel: `${tierLabel}${tier === 3 ? (transportUnit > 0 ? ', prix fixé' : ', prix à fixer') : ''}`,
    unitPrice: transportUnit,
    trips: config.trips,
    date: draft.noDate ? null : draft.date,
    followingTripPercent: settings?.movingLaborPlanning?.followingTripDiscountPercent ?? 60,
    lowDemandPercent: settings?.movingLaborPlanning?.lowDemandDiscountPercent ?? 10,
  });
  const rentalKit =
    config.rentalKit ??
    (vehicle
      ? defaultRentalKit(
          vehicle,
          estimate?.crew ?? draft.options.labour,
          settings?.rentalKitConfiguration,
          input.simulationNeeds,
        )
      : []);
  const rentalOvertimeAmount =
    config.billingMode === 'driver-rental'
      ? Math.round(
          ((config.overtimeMinutes ?? 0) * (settings?.rentalOvertimeHourlyRate ?? 10000)) / 60,
        )
      : 0;
  const taxiDistance = Math.max(0, draft.distanceKmOverride ?? draft.route?.distanceKm ?? 0);
  // Each rotation has two paid taxi legs, except the final return after unloading.
  const taxiRotations = taxiRotationCount(estimate?.trips, config.trips, config.calcMode);
  const taxiPaidLegs = taxiPaidLegCount(taxiRotations);
  const taxiRate = Math.max(0, settings?.taxiFeePerKm ?? 0);
  const taxiPerLegAmount = config.taxiFeeAmountOverride ?? Math.round(taxiDistance * taxiRate);
  const taxiCompanyApproachAmount =
    config.taxiCompanyApproachAmountOverride ??
    Math.round(Math.max(0, input.taxiPickupDistanceKm ?? 0) * taxiRate);
  const taxiAvailable =
    settings?.taxiFeeEnabled &&
    config.taxiFeeApplied &&
    config.billingMode !== 'driver-rental' &&
    settings.businessLatitude != null &&
    settings.businessLongitude != null &&
    input.taxiPickupDistanceKm != null;
  const manoeuvreOvertime = manoeuvreOvertimeLine(
    estimate,
    settings?.movingLaborPlanning,
    config.billingMode,
    {
      enabled: config.manoeuvreOvertimeEnabled,
      hours: config.manoeuvreOvertimeHours,
      hourlyRate: config.manoeuvreOvertimeHourlyRateOverride,
      accountingHourlyRate: input.accountingOvertimeHourlyRate,
      startTime: draft.timeSlot,
    },
  );
  const fallbackLines = extras
    .filter(([key]) => draft.options[key] > 0)
    .map(([key, label]) => {
      const unitPrice =
        key === 'labour'
          ? config.labourUnitPriceOverride || labourPrice
          : settings
            ? assemblyUnitPrice(
                settings,
                key === 'desk' ? 'bureau' : key === 'wardrobe' ? 'armoire' : 'lit',
              )
            : 0;
      return {
        label,
        quantity: draft.options[key],
        unitPrice,
        total: draft.options[key] * unitPrice,
      };
    });
  const rawLines: QuoteLine[] = [
    ...transportLines,
    ...(price?.lines ?? fallbackLines)
      .filter(
        (line) =>
          !line.label.startsWith('Transport ') &&
          !savedCustomLineKeys.has(JSON.stringify([line.label, line.quantity, line.unitPrice])) &&
          !isManoeuvreOvertimeLine(line.label) &&
          !line.label.startsWith('Frais taxi') &&
          !line.label.startsWith('Chargements et déchargements suivants') &&
          !line.label.startsWith('Allers-retours suivants') &&
          !line.label.startsWith('Remise jour creux') &&
          (config.billingMode === 'complete' ||
            (config.billingMode === 'driver-rental' && config.menuIncluded) ||
            !line.label.startsWith('Menuisier ·')) &&
          !(config.billingMode === 'driver-rental' && /^Man[œo]uvre/iu.test(line.label)),
      )
      .map((line) => {
        if (!line.label.startsWith('Manœuvre')) return line;
        const unitPrice =
          config.labourUnitPriceOverride ||
          (applySnapshotLabourPrice ? labourPrice : line.unitPrice);
        return { ...line, unitPrice, total: line.quantity * unitPrice };
      }),
  ];
  const availableMenuLines = settings ? inventoryAssemblyLines(draft.inventory, settings) : [];
  const includeMenu =
    config.billingMode === 'complete' ||
    (config.billingMode === 'driver-rental' && config.menuIncluded);
  const menuOptions = includeMenu
    ? inventoryAssemblyOptions(draft.inventory)
    : { ...draft.options, desk: 0, wardrobe: 0, bed: 0 };
  const lines = quoteInventoryLines({
    rawLines,
    inventoryLines: includeMenu ? availableMenuLines : [],
    extras,
    options: draft.options,
    inventoryOptions: menuOptions,
    settings,
    includeMenu,
  });
  const balconyPrice = Math.max(0, Math.round(Number(estimateInventory.balcPx) || 0));
  const basePreviewLines: QuoteLine[] = [
    ...lines,
    ...(estimateInventory.stairs === 'balcon'
      ? [
          {
            label: `Supplément passage par le balcon${balconyPrice > 0 ? '' : ' (à fixer)'}`,
            quantity: 1,
            unitPrice: balconyPrice,
            total: balconyPrice,
          },
        ]
      : []),
    ...(rentalOvertimeAmount > 0
      ? [
          {
            label: `Dépassement du planning prévisionnel (${config.overtimeMinutes} min)`,
            quantity: 1,
            unitPrice: rentalOvertimeAmount,
            total: rentalOvertimeAmount,
          },
        ]
      : []),
    ...(manoeuvreOvertime
      ? [
          {
            ...manoeuvreOvertime,
            total: Math.round(manoeuvreOvertime.quantity * manoeuvreOvertime.unitPrice),
          },
        ]
      : []),
    ...(config.customLines ?? [])
      .filter((line) => line.label.trim() && line.quantity > 0 && line.unitPrice > 0)
      .map((line) => ({
        label: line.label.trim(),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.quantity * line.unitPrice,
      })),
  ];
  const taxiCrew = manoeuvreCount(basePreviewLines);
  const taxiCompanyApproachTotal = taxiCompanyApproachAmount;
  const taxiFeeAmount =
    taxiCrew > 0 && taxiAvailable ? taxiPerLegAmount * taxiPaidLegs + taxiCompanyApproachTotal : 0;
  const taxiFeeLines: QuoteLine[] =
    taxiCrew > 0 && taxiAvailable
      ? [
          ...(taxiPerLegAmount > 0
            ? [
                {
                  label:
                    config.taxiFeeAmountOverride === null
                      ? 'Frais taxi · trajet simple'
                      : 'Frais taxi · montant par trajet modifié',
                  quantity: taxiPaidLegs,
                  unitPrice: taxiPerLegAmount,
                  total: taxiPerLegAmount * taxiPaidLegs,
                },
              ]
            : []),
          ...(taxiCompanyApproachAmount > 0
            ? [
                {
                  label: 'Frais taxi · approche entreprise',
                  quantity: 1,
                  unitPrice: taxiCompanyApproachAmount,
                  total: taxiCompanyApproachTotal,
                },
              ]
            : []),
        ]
      : [];
  const baseSubtotal = basePreviewLines.reduce((sum, line) => sum + line.total, 0);
  const discount =
    config.discountType === 'pct'
      ? Math.round((baseSubtotal * Math.min(100, config.discount)) / 100)
      : Math.min(baseSubtotal, config.discount);
  const discountLabel = `Remise${config.discountType === 'pct' && config.discount ? ` (${Math.min(100, config.discount)} %)` : ''}${config.discountReason.trim() ? ` · ${config.discountReason.trim()}` : ''}`;
  const priceSnapshot: Price = applyTaxiToManoeuvrePrice(
    {
      lines: basePreviewLines,
      total: baseSubtotal - discount,
      discount,
      discountLabel,
      discountType: config.discountType,
      discountValue: config.discount,
      discountReason: config.discountReason,
      tier,
      trips: config.trips,
      currency: 'XOF',
    },
    taxiFeeAmount,
  );
  const previewLines = priceSnapshot.lines;
  const subtotal = previewLines.reduce((sum, line) => sum + line.total, 0);
  const total = baseSubtotal - discount + taxiFeeAmount;
  return {
    tier,
    transportUnit,
    transportLines,
    rentalKit,
    rentalOvertimeAmount,
    taxiFeeLines,
    taxiFeeLine:
      taxiFeeLines.find((line) => !line.label.startsWith('Frais taxi · approche entreprise')) ??
      null,
    taxiCrew,
    manoeuvreOvertime,
    lines,
    previewLines,
    subtotal,
    discount,
    discountLabel,
    total,
    priceSnapshot,
    availableMenuLines,
    menuIncluded: includeMenu,
    menuOptions,
    cheaperVehicle: null as {
      vehicle: Vehicle;
      trips: number;
      total: number;
      savings: number;
    } | null,
  };
}

export function previewQuote(quote: Quote, notes: string, options: Options): Quote {
  return { ...quote, notes, options };
}

export function moneyPreview(value: number) {
  return (
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' FCFA'
  );
}
