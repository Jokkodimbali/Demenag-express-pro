import type { AdminQuoteConfig } from './admin-quote-draft-storage';

export function defaultAdminQuoteConfig(): AdminQuoteConfig {
  return {
    trips: 1,
    calcMode: 'auto',
    legMinutes: 0,
    trafficOff: false,
    heatOff: false,
    heatRest: 0,
    discount: 0,
    discountType: 'fcfa',
    discountReason: '',
    customPrice: null,
    labourUnitPriceOverride: null,
    billingMode: 'complete',
    menuIncluded: false,
    overtimeMinutes: 0,
    rentalKit: null,
  };
}
