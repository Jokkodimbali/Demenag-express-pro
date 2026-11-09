import type { AdminQuoteConfig } from '../admin-quote-draft-storage';
import type { Draft } from '../booking-draft';
import type { Inventory } from '../../domain/inventory';
import type { MovingEstimate } from '../../domain/moving-estimate';
import type { Options, Price, Quote, Settings, Vehicle } from '../../domain/model';
import { assemblyUnitPrice } from '../../domain/labour-price';
import { defaultRentalKit } from '../../domain/rental-kit';
import { inventoryAssemblyLines, inventoryAssemblyOptions } from '../../domain/inventory-assembly';
import { manoeuvreOvertimeLine } from './manoeuvre-overtime';
import { quoteInventoryLines } from './quote-inventory-lines';
import { quoteTransportLines } from './quote-transport-lines';

type ExtraOption = [keyof Options, string, string];
type QuoteLine = { label: string; quantity: number; unitPrice: number; total: number };

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
  simulationNeeds: { blankets: number; straps: number } | null;
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
  } = input;
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
  const manoeuvreOvertime = manoeuvreOvertimeLine(
    estimate,
    settings?.movingLaborPlanning,
    config.billingMode,
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
          (config.billingMode === 'complete' ||
            (config.billingMode === 'driver-rental' && config.menuIncluded) ||
            !line.label.startsWith('Menuisier ·')) &&
          !(config.billingMode === 'driver-rental' && /^Man[œo]uvre/iu.test(line.label)),
      )
      .map((line) =>
        line.label.startsWith('Manœuvre') && config.labourUnitPriceOverride
          ? {
              ...line,
              unitPrice: config.labourUnitPriceOverride,
              total: line.quantity * config.labourUnitPriceOverride,
            }
          : line,
      ),
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
  const previewLines: QuoteLine[] = [
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
  ];
  const subtotal = previewLines.reduce((sum, line) => sum + line.total, 0);
  const discount =
    config.discountType === 'pct'
      ? Math.round((subtotal * Math.min(100, config.discount)) / 100)
      : Math.min(subtotal, config.discount);
  const discountLabel = `Remise${config.discountType === 'pct' && config.discount ? ` (${Math.min(100, config.discount)} %)` : ''}${config.discountReason.trim() ? ` · ${config.discountReason.trim()}` : ''}`;
  const total = subtotal - discount;
  const priceSnapshot: Price = {
    lines: previewLines,
    total,
    discount,
    discountLabel,
    discountType: config.discountType,
    discountValue: config.discount,
    discountReason: config.discountReason,
    tier,
    trips: config.trips,
    currency: 'XOF',
  };
  return {
    tier,
    transportUnit,
    transportLines,
    rentalKit,
    rentalOvertimeAmount,
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
