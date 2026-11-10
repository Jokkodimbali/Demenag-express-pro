import type { AccountingFinanceConfiguration, LabourPriceMatrix, Vehicle } from './contracts.js';
import referenceAssemblyPayrollDefaults from './reference-assembly-payroll-prices.js';
import { referenceAssemblyPriceDefaults } from './reference-assembly-price-defaults.js';

export { referenceAssemblyPayrollDefaults, referenceAssemblyPriceDefaults };

// Exact customer-facing tariff values extracted from the supplied reference file.

export const referenceVehiclePrices: Record<string, Vehicle['prices']> = {
  trafic: [15000, 18500, 22000],
  sprinter: [28000, 34500, 41500],
  master: [25000, 31000, 37000],
};

export function createReferenceLabourPriceMatrix(): LabourPriceMatrix {
  const legacy = (floor: number, lift: boolean) => (floor <= 0 ? 0 : lift ? 500 : floor * 500);
  const scenarios = {
    none: [false, false],
    from: [true, false],
    to: [false, true],
    both: [true, true],
  } as const;
  return Object.fromEntries(
    Object.entries(scenarios).map(([key, [fromLift, toLift]]) => [
      key,
      Array.from({ length: 6 }, (_, from) =>
        Array.from({ length: 6 }, (_, to) => 6500 + legacy(from, fromLift) + legacy(to, toLift)),
      ),
    ]),
  ) as LabourPriceMatrix;
}

export const referenceAccountingChargeDefaults = {
  moverCostPerMove: 5000,
  oilChangeCost: 150000,
  oilChangeIntervalMonths: 2,
  vehicleInsuranceAnnual: 200000,
  vehicleCount: 3,
  fleetValue: 30000000,
  fleetYears: 7,
  newVehicleTarget: 12000000,
  debt: 30000000,
  debtMonths: 18,
  profitCapPercent: 50,
  legalReservePercent: 10,
  legalReserveCapitalPercent: 20,
  monthlyProfitTarget: 3000000,
  averageMovingPrice: 0,
  menuPrices: referenceAssemblyPayrollDefaults,
} satisfies Partial<AccountingFinanceConfiguration>;

export function createReferenceAccountingConfiguration(
  now = new Date(),
): AccountingFinanceConfiguration {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('Mois comptable indisponible.');
  return {
    regime: 'auto',
    suarlFrom: '',
    isRate: 30,
    start: `${year}-${month}`,
    ...referenceAccountingChargeDefaults,
    monthlyFixedChargePostings: [],
    financeChat: [],
    salaries: [],
    annexes: [],
    vehiclePurchases: [],
    advertising: {},
  };
}
