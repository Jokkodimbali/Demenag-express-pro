import type { Draft } from '../../../../booking/application/booking-draft';
import {
  bookingInventorySnapshot,
  type MovingEstimate,
} from '../../../../moving/domain/estimate/moving-estimate';
import type { Inventory } from '../../../../moving/domain/inventory/inventory';
import type {
  Booking,
  Price,
  Quote,
  RentalKitItem,
  Settings,
  Vehicle,
} from '../../../../shared/domain/model';
import { quoteConditionsText } from '../../../../shared/messaging/application/services/whatsapp-templates';
import type { AdminQuoteConfig } from './admin-quote-draft-storage';

export function buildAdminQuotePdfDocument(input: {
  now: string;
  booking: Booking | null;
  draft: Draft;
  vehicle: Vehicle;
  settings: Settings;
  quoteKind: Quote['kind'];
  savedQuote?: Quote;
  config: AdminQuoteConfig;
  lines: Price['lines'];
  total: number | null;
  subtotal: number;
  discount: number;
  discountLabel?: string;
  tier: number;
  estimateInventory: Inventory;
  estimate: MovingEstimate | null;
  visibleInventoryText: string;
  estimateText: string;
  questionnaireText: string;
  rentalKit: RentalKitItem[];
  tolls: Array<{ id: string; label: string; quantity: number; unitPrice: number }>;
  effectiveDistance?: number;
}) {
  const { draft, booking, vehicle, settings, config, estimateInventory, estimate } = input;
  const price: Price = {
    lines: input.lines.map((line) => ({ ...line })),
    total: input.total ?? input.subtotal - input.discount,
    discount: input.discount,
    discountLabel: input.discountLabel,
    discountType: config.discountType,
    discountValue: config.discount,
    discountReason: config.discountReason,
    tier: input.tier,
    trips: config.trips,
    currency: 'XOF',
  };
  const quote: Quote = {
    id: input.savedQuote?.id ?? 'preview',
    reference: input.savedQuote?.reference ?? 'DEVIS-EN-COURS',
    kind: input.quoteKind,
    createdAt: input.savedQuote?.createdAt ?? input.now,
    price,
    notes: [
      draft.fromNote.trim() ? `Repère départ : ${draft.fromNote.trim()}` : '',
      draft.toNote.trim() ? `Repère arrivée : ${draft.toNote.trim()}` : '',
      input.visibleInventoryText,
      input.estimateText,
      input.questionnaireText,
      quoteConditionsText(estimateInventory, config.billingMode),
      draft.notes,
    ]
      .filter(Boolean)
      .join('\n'),
    options: draft.options,
    billingMode: config.billingMode,
    menuIncluded: config.billingMode === 'driver-rental' && config.menuIncluded,
    rentalKit: config.billingMode === 'driver-rental' ? input.rentalKit : [],
    overtimeMinutes: config.billingMode === 'driver-rental' ? config.overtimeMinutes : 0,
    providedCrew: estimate?.crew ?? draft.options.labour,
    tolls: input.tolls.map((line) => ({
      tollPointId: line.id,
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
  };
  const previewBooking: Booking = {
    ...(booking ?? {
      id: 'preview',
      reference: 'DEVIS-EN-COURS',
      userId: '',
      customerName: '',
      phone: '',
      vehicle,
      fromAddress: '',
      toAddress: '',
      from: [0, 0],
      to: [0, 0],
      distanceKm: 0,
      date: null,
      timeSlot: '',
      options: draft.options,
      notes: '',
      status: 'pending',
      estimate: price,
      quotes: [],
      createdAt: input.now,
      version: 1,
    }),
    customerName: draft.customerName,
    phone: draft.customerPhone,
    vehicle,
    fromAddress: draft.fromAddress,
    toAddress: draft.toAddress,
    from: draft.route?.from ?? booking?.from ?? [0, 0],
    to: draft.route?.to ?? booking?.to ?? [0, 0],
    distanceKm: input.effectiveDistance ?? booking?.distanceKm ?? 0,
    date: draft.date || null,
    month: draft.month,
    timeSlot: draft.timeSlot,
    options: draft.options,
    notes: quote.notes,
    status: input.quoteKind === 'final' ? 'completed' : (booking?.status ?? 'pending'),
    pricingSettings: settings,
    inventorySnapshot:
      estimate &&
      (input.visibleInventoryText || estimateInventory.ready || estimateInventory.stairs)
        ? bookingInventorySnapshot(estimateInventory, estimate)
        : undefined,
    estimate: price,
    quotes: booking?.quotes ?? [],
  };
  const filenameKind = input.quoteKind === 'final' ? 'final' : 'provisoire';

  return {
    booking: previewBooking,
    quote,
    filename: `Devis-${filenameKind}-${quote.reference || booking?.reference || 'demande'}.pdf`,
  };
}
