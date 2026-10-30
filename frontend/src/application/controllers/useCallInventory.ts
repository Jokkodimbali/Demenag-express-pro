import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useApp } from '../context';
import { messages } from '../../content/fr';
import type { Draft } from '../booking-draft';
import { useBookingCommands } from './useBookingCommands';
import type { MovingLaborPlanningSettings, Vehicle } from '../../domain/model';
import { estimatedInventoryItemVolume, estimateMovingWork } from '../../domain/moving-estimate';
import { blankInventory, inventoryItems, type Inventory } from '../../domain/inventory';
import { referenceAnnexVolume } from '../../domain/reference-inventory-note';
import { assemblyCount } from '../../domain/inventory-count';

const sections = [...new Set(inventoryItems.map((item) => item.section))];
const dwellingTypes = ['Studio', 'F2', 'F3', 'F4', 'F5 et plus', 'Villa'];

export function useCallInventory({
  draft,
  setDraft,
  maxOptions,
  vehicles,
  selectedVehicleId,
  quoteTrips,
  onApplyEstimate,
  laborPlanning,
  trafficDurationMinutes,
  estimateInventory,
  audience,
  referenceMode,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  maxOptions: number;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  quoteTrips: number;
  onApplyEstimate: (vehicleId: string, trips: number) => void;
  laborPlanning?: MovingLaborPlanningSettings;
  trafficDurationMinutes?: number;
  estimateInventory?: Inventory;
  audience: 'admin' | 'client';
  referenceMode: boolean;
}) {
  const { requestConfirmation } = useApp();
  const [customLabel, setCustomLabel] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [open, setOpen] = useState(audience === 'client' && !referenceMode);
  const [openCustom, setOpenCustom] = useState(false);
  const [activeWidget, setActiveWidget] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterInventoryItem = (id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActiveWidget(id), 250);
  };
  const leaveInventoryItem = (id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActiveWidget((current) => (current === id ? null : current));
  };
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((section) => [section, audience === 'client' && !referenceMode]),
    ),
  );
  const inventory = draft.inventory;
  const { bookings } = useBookingCommands();
  const [historicalSizeMaximum, setHistoricalSizeMaximum] = useState<Record<string, number>>({});
  const historyRequested = useRef(false);
  useEffect(() => {
    if (audience !== 'admin' || !open || historyRequested.current) return;
    historyRequested.current = true;
    void bookings()
      .then((bookings) => {
        const maximum: Record<string, number> = {};
        bookings.forEach((booking) => {
          const source = booking.inventorySnapshot?.sourceInventory;
          if (!source) return;
          Object.entries(source.entries).forEach(([key, entry]) => {
            maximum[key] = Math.max(maximum[key] ?? 0, entry.size);
          });
          source.variants.forEach((entry) => {
            maximum[entry.itemKey] = Math.max(maximum[entry.itemKey] ?? 0, entry.size);
          });
        });
        setHistoricalSizeMaximum(maximum);
      })
      .catch(() => undefined);
  }, [audience, bookings, open]);
  const update = (next: Inventory) => {
    if (
      (['desk', 'wardrobe', 'bed'] as const).some((optionKey) => {
        const nextValue =
          draft.options[optionKey] +
          assemblyCount(next, optionKey) -
          assemblyCount(inventory, optionKey);
        return nextValue < 0 || nextValue > maxOptions;
      })
    ) {
      setInventoryError(
        `Le maximum de ${maxOptions} montages par type est atteint. Ajustez les options avant de continuer.`,
      );
      return;
    }
    setInventoryError('');
    const vehicle = vehicles.find((item) => item.id === selectedVehicleId);
    const estimate = vehicle
      ? estimateMovingWork(next, vehicle, draft.route, {
          crew: next.crew,
          startTime: draft.timeSlot,
          laborPlanning,
        })
      : null;
    setDraft((current) => {
      const options = { ...current.options };
      for (const key of ['desk', 'wardrobe', 'bed'] as const) {
        const difference = assemblyCount(next, key) - assemblyCount(current.inventory, key);
        options[key] = Math.max(0, Math.min(maxOptions, options[key] + difference));
      }
      if (estimate && estimate.volume > 0) options.labour = estimate.crew;
      return { ...current, inventory: next, options };
    });
    if (estimate?.trips) onApplyEstimate(selectedVehicleId, estimate.trips);
  };
  const clearInventory = async () => {
    const confirmed = await requestConfirmation({
      titleId: 'clear-inventory-title',
      eyebrow: messages.confirmationRequise,
      title: messages.viderFicheTitre,
      description: messages.viderFicheDescription,
      confirmLabel: messages.confirmerAction,
    });
    if (!confirmed) return;
    setInventoryError('');
    setCustomLabel('');
    setActiveWidget(null);
    setDraft((current) => {
      const options = { ...current.options };
      for (const key of ['desk', 'wardrobe', 'bed'] as const) {
        options[key] = Math.max(0, options[key] - assemblyCount(current.inventory, key));
      }
      return { ...current, inventory: blankInventory(), options };
    });
  };
  const addCustomItem = () => {
    const label = customLabel.trim().toLowerCase();
    if (!label) return;
    update({
      ...inventory,
      custom: [
        ...inventory.custom,
        {
          id: crypto.randomUUID(),
          label,
          quantity: 1,
          format: 'medium',
          dismantle: false,
          origin: 'local',
        },
      ],
    });
    setCustomLabel('');
  };
  const setEntry = (key: string, patch: Partial<Inventory['entries'][string]>) => {
    const item = inventoryItems.find((entry) => entry.key === key);
    const current = inventory.entries[key] ?? {
      quantity: 0,
      size: item?.defaultSize ?? 1,
      format: 'medium' as const,
      dismantle: !!item?.defaultDismantle,
    };
    update({ ...inventory, entries: { ...inventory.entries, [key]: { ...current, ...patch } } });
  };
  const total =
    Object.values(inventory.entries).reduce((sum, item) => sum + item.quantity, 0) +
    inventory.variants.reduce((sum, item) => sum + item.quantity, 0) +
    inventory.custom.reduce((sum, item) => sum + item.quantity, 0);
  const estimateVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const currentEstimate = estimateVehicle
    ? estimateMovingWork(estimateInventory ?? inventory, estimateVehicle, draft.route, {
        trips: quoteTrips,
        crew: inventory.crew,
        startTime: draft.timeSlot,
        laborPlanning,
        trafficDurationMinutes,
      })
    : null;
  const hasVolume = currentEstimate ? currentEstimate.volume > 0 : total > 0;
  const annexVolume = referenceAnnexVolume(inventory);
  const countedObjectVolume =
    Object.entries(inventory.entries).reduce(
      (sum, [key, entry]) =>
        sum +
        estimatedInventoryItemVolume(key, entry.size, !!entry.dismantle, entry.format) *
          entry.quantity,
      0,
    ) +
    inventory.variants.reduce(
      (sum, item) =>
        sum +
        estimatedInventoryItemVolume(item.itemKey, item.size, !!item.dismantle, item.format) *
          item.quantity,
      0,
    ) +
    inventory.custom.reduce(
      (sum, item) =>
        sum +
        estimatedInventoryItemVolume('custom', 1, !!item.dismantle, item.format) * item.quantity,
      0,
    );
  const volumeDetail = `Meubles et objets comptés ≈ ${countedObjectVolume.toFixed(1).replace('.', ',')} m³${annexVolume > 0 ? ` · effets annexes ≈ ${annexVolume.toFixed(1).replace('.', ',')} m³` : ''}`;
  const quantityOf = (key: string) =>
    (inventory.entries[key]?.quantity ?? 0) +
    inventory.variants
      .filter((item) => item.itemKey === key)
      .reduce((sum, item) => sum + item.quantity, 0);
  const inventoryChecks = [
    ...(quantityOf('lit') > quantityOf('matelas')
      ? [
          `${quantityOf('lit') - quantityOf('matelas')} lit(s) sans matelas compté : ajoutez-les si le client les emporte.`,
        ]
      : []),
    ...(quantityOf('table-manger') > 0 && quantityOf('chaise') === 0
      ? ['Table à manger sans chaises : à vérifier avec le client.']
      : []),
    ...(!inventory.ready ? ['Demandez si le matériel sera prêt à être chargé.'] : []),
    ...(!inventory.stairs ? ['Demandez si tout le matériel passe dans les escaliers.'] : []),
    ...(inventory.stairs === 'non'
      ? ['Objets qui ne passent pas les escaliers : prévoir démontage, corde ou monte-meuble.']
      : []),
    ...(!inventory.dwellingType
      ? [
          "Type de logement non précisé : les sacs d'habits, la vaisselle et le linge ne sont pas estimés.",
        ]
      : []),
  ];
  return {
    customLabel,
    setCustomLabel,
    inventoryError,
    setInventoryError,
    open,
    setOpen,
    openCustom,
    setOpenCustom,
    activeWidget,
    setActiveWidget,
    enterInventoryItem,
    leaveInventoryItem,
    openSections,
    setOpenSections,
    inventory,
    historicalSizeMaximum,
    update,
    clearInventory,
    addCustomItem,
    setEntry,
    total,
    estimateVehicle,
    currentEstimate,
    hasVolume,
    annexVolume,
    countedObjectVolume,
    volumeDetail,
    quantityOf,
    inventoryChecks,
    dwellingTypes,
  };
}
