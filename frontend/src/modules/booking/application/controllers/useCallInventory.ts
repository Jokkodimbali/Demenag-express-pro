import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useApp } from '../../../shared/application/context';
import { messages } from '../../../shared/content/fr';
import type { Draft } from '../booking-draft';
import { useBookingCommands } from './useBookingCommands';
import type {
  CustomInventoryType,
  MovingLaborPlanningSettings,
  Vehicle,
} from '../../../shared/domain/model';
import { inventoryItems, type Inventory } from '../../../moving/domain/inventory/inventory';
import {
  addCustomInventoryItem,
  addCustomInventoryType,
  assemblyLimitError,
  clearInventoryAndAssemblyOptions,
  estimateCallInventory,
  historicalInventorySizeMaximum,
  inventoryEntryWithPatch,
  reconcileAssemblyOptions,
  summarizeCallInventory,
} from '../services/call-inventory-policy';

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
  ignoreTraffic,
  manualLegMinutes,
  hasToll,
  heatOff,
  heatRest,
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
  ignoreTraffic?: boolean;
  manualLegMinutes?: number;
  hasToll?: boolean;
  heatOff?: boolean;
  heatRest?: number;
  estimateInventory?: Inventory;
  audience: 'admin' | 'client';
  referenceMode: boolean;
}) {
  const { requestConfirmation, catalogue } = useApp();
  const customInventoryTypes = catalogue?.settings.customInventoryTypes ?? [];
  const hiddenInventoryKeys = catalogue?.settings.hiddenInventoryKeys ?? [];
  const [customLabel, setCustomLabel] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [open, setOpen] = useState(
    audience === 'admin' || (audience === 'client' && !referenceMode),
  );
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
  const inventorySummary = summarizeCallInventory(inventory);
  const { bookings } = useBookingCommands();
  const [historicalSizeMaximum, setHistoricalSizeMaximum] = useState<Record<string, number>>({});
  const historyRequested = useRef(false);
  useEffect(() => {
    if (audience !== 'admin' || !open || historyRequested.current) return;
    historyRequested.current = true;
    void bookings()
      .then((bookings) => {
        setHistoricalSizeMaximum(historicalInventorySizeMaximum(bookings));
      })
      .catch(() => undefined);
  }, [audience, bookings, open]);
  const update = (next: Inventory) => {
    const limitError = assemblyLimitError(next, inventory, draft.options, maxOptions);
    if (limitError) {
      setInventoryError(limitError);
      return;
    }
    setInventoryError('');
    const vehicle = vehicles.find((item) => item.id === selectedVehicleId);
    const estimate = estimateCallInventory({
      inventory: next,
      vehicle,
      route: draft.route,
      startTime: draft.timeSlot,
      laborPlanning,
      fromAddress: draft.fromAddress,
      toAddress: draft.toAddress,
      date: draft.date,
      month: draft.month,
      ignoreTraffic,
      manualLegMinutes,
      hasToll,
      heatOff,
      heatRest,
    });
    setDraft((current) => {
      const options = reconcileAssemblyOptions(
        current.options,
        next,
        current.inventory,
        maxOptions,
        estimate && estimate.volume > 0 ? estimate.crew : undefined,
      );
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
      return {
        ...current,
        ...clearInventoryAndAssemblyOptions(current.options, current.inventory),
      };
    });
  };
  const addCustomItem = () => {
    const next = addCustomInventoryItem(inventory, customLabel, crypto.randomUUID());
    if (next === inventory) return;
    update(next);
    setCustomLabel('');
  };
  const addCustomType = (type: CustomInventoryType) => {
    update(addCustomInventoryType(inventory, type, crypto.randomUUID()));
  };
  const setEntry = (key: string, patch: Partial<Inventory['entries'][string]>) => {
    update(inventoryEntryWithPatch(inventory, key, patch));
  };
  const total = inventorySummary.total;
  const estimateVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const currentEstimate = estimateCallInventory({
    inventory: estimateInventory ?? inventory,
    vehicle: estimateVehicle,
    route: draft.route,
    trips: quoteTrips,
    startTime: draft.timeSlot,
    laborPlanning,
    fromAddress: draft.fromAddress,
    toAddress: draft.toAddress,
    date: draft.date,
    month: draft.month,
    ignoreTraffic,
    manualLegMinutes,
    hasToll,
    heatOff,
    heatRest,
  });
  const hasVolume = currentEstimate ? currentEstimate.volume > 0 : total > 0;
  const { annexVolume, countedObjectVolume, volumeDetail, quantityOf, inventoryChecks } =
    inventorySummary;
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
    customInventoryTypes,
    hiddenInventoryKeys,
    addCustomType,
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
