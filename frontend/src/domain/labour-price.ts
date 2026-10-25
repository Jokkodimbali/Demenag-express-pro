import type { LabourMatrixScenario, LabourPriceMatrix, Settings, WorkAccess } from './model';

export const labourMatrixScenarios: {
  id: LabourMatrixScenario;
  label: string;
  from: boolean;
  to: boolean;
}[] = [
  { id: 'none', label: 'Sans ascenseur', from: false, to: false },
  { id: 'from', label: 'Ascenseur au départ', from: true, to: false },
  { id: 'to', label: "Ascenseur à l'arrivée", from: false, to: true },
  { id: 'both', label: 'Ascenseur des deux côtés', from: true, to: true },
];

const legacyPrice = (settings: Settings, floor: number, lift: boolean) =>
  floor <= 0
    ? 0
    : lift
      ? (settings.labourLiftPrice ?? 500)
      : floor * (settings.labourFloorPrice ?? 500);

export function createLabourPriceMatrix(settings: Settings): LabourPriceMatrix {
  return Object.fromEntries(
    labourMatrixScenarios.map((scenario) => [
      scenario.id,
      Array.from({ length: 6 }, (_, fromFloor) =>
        Array.from(
          { length: 6 },
          (_, toFloor) =>
            settings.labourMatrix?.[scenario.id]?.[fromFloor]?.[toFloor] ??
            settings.labourPrice +
              legacyPrice(settings, fromFloor, scenario.from) +
              legacyPrice(settings, toFloor, scenario.to),
        ),
      ),
    ]),
  ) as LabourPriceMatrix;
}

export function labourUnitPrice(settings: Settings, access?: WorkAccess) {
  if (!access) return settings.labourMatrix?.none?.[0]?.[0] ?? settings.labourPrice;
  const scenario = access.fromLift
    ? access.toLift
      ? 'both'
      : 'from'
    : access.toLift
      ? 'to'
      : 'none';
  const matrixPrice = settings.labourMatrix?.[scenario]?.[access.fromFloor]?.[access.toFloor];
  if (Number.isInteger(matrixPrice) && matrixPrice! >= 0) return matrixPrice!;
  return (
    settings.labourPrice +
    legacyPrice(settings, access.fromFloor, access.fromLift) +
    legacyPrice(settings, access.toFloor, access.toLift)
  );
}
