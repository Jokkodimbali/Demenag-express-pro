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

export function assemblyUnitPrice(
  settings: Settings,
  key: string,
  origin: 'local' | 'import' = 'local',
  size?: number,
  defaultSize = 1,
) {
  const legacyKey =
    key === 'tablem'
      ? 'table-manger'
      : key === 'biblio'
        ? 'bibliotheque'
        : key === 'congel'
          ? 'congelateur'
          : key === 'mal'
            ? 'machine-laver'
            : key === 'micro'
              ? 'micro-ondes'
              : key === 'clim'
                ? 'climatiseur'
                : key === 'ventilo'
                  ? 'ventilateur'
                  : key;
  const configured = settings.montageP?.[key] ?? settings.montageP?.[legacyKey];
  if (!configured) return settings.assemblyPrice;
  const sized = size == null ? undefined : configured.sz?.[String(size)]?.[origin];
  if (Number.isInteger(sized) && sized! >= 0) return sized!;
  const base = configured[origin];
  const fallback =
    Number.isInteger(base) && base! >= 0
      ? base!
      : origin === 'import'
        ? Math.round(settings.assemblyPrice * 1.5)
        : settings.assemblyPrice;
  const increment = origin === 'import' ? (configured.uI ?? configured.u) : configured.u;
  return size != null && increment
    ? Math.round(fallback + Math.max(0, size - defaultSize) * increment)
    : fallback;
}

export function createLabourPriceMatrix(settings: Settings): LabourPriceMatrix {
  return Object.fromEntries(
    labourMatrixScenarios.map((scenario) => [
      scenario.id,
      Array.from({ length: 6 }, (_, fromFloor) =>
        Array.from(
          { length: 6 },
          (_, toFloor) =>
            settings.labourPrice +
              legacyPrice(settings, fromFloor, scenario.from) +
              legacyPrice(settings, toFloor, scenario.to),
        ),
      ),
    ]),
  ) as LabourPriceMatrix;
}

export function labourUnitPrice(settings: Settings, access?: WorkAccess) {
  if (!access) return settings.labourPrice;
  const scenario = access.fromLift
    ? access.toLift
      ? 'both'
      : 'from'
    : access.toLift
      ? 'to'
      : 'none';
  return (
    settings.labourPrice +
    legacyPrice(settings, access.fromFloor, access.fromLift) +
    legacyPrice(settings, access.toFloor, access.toLift)
  );
}
