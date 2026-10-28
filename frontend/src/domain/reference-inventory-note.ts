import type { Inventory, InventoryFormat } from './inventory';
import { inventoryFlags, inventoryItems } from './inventory';
import { estimatedInventoryItemVolume, type MovingEstimate } from './moving-estimate';

const dwellingVolumes: Record<string, number> = {
  Studio: 1.5,
  F2: 2.5,
  F3: 3.5,
  F4: 5,
  'F5 et plus': 6.5,
  Villa: 9,
};

export const referenceDwellingLabel = (value: string) =>
  value === 'F5 et plus' ? 'F5 et +' : value;
export const referenceDwellingVolume = (value: string) => dwellingVolumes[value] ?? 0;
const floorLabel = (floor: number) =>
  floor === 0 ? 'rez-de-chaussée' : floor === 1 ? '1er étage' : `${floor}ème étage`;
const placeLabel = (value: string) => value.replace(/,\s*(Sénégal|Senegal)$/iu, '').trim() || '…';
const volumeLabel = (value: number) => value.toFixed(2).replace('.', ',');

export function referenceAnnexVolume(inventory: Inventory): number {
  const baseAnnex = dwellingVolumes[inventory.dwellingType] ?? 0;
  const smallVolume = (['carton', 'sac'] as const).reduce((total, key) => {
    const entry = inventory.entries[key];
    const base = entry
      ? estimatedInventoryItemVolume(key, entry.size, entry.dismantle, entry.format) *
        entry.quantity
      : 0;
    return (
      total +
      base +
      inventory.variants
        .filter((variant) => variant.itemKey === key)
        .reduce(
          (sum, variant) =>
            sum +
            estimatedInventoryItemVolume(key, variant.size, variant.dismantle, variant.format) *
              variant.quantity,
          0,
        )
    );
  }, 0);
  return inventory.annexOn === false ? 0 : Math.max(0, baseAnnex - smallVolume);
}

export function referenceInventoryNote(
  inventory: Inventory,
  fromAddress = '',
  toAddress = '',
): string {
  const lines = [
    `Déménagement du ${floorLabel(inventory.fromFloor)} de ${placeLabel(fromAddress)}${inventory.fromLift ? ' (ascenseur)' : ''} / au ${floorLabel(inventory.toFloor)} vers ${placeLabel(toAddress)}${inventory.toLift ? ' (ascenseur)' : ''}`,
  ];
  const addItem = (
    label: string,
    plural: string,
    key: string,
    quantity: number,
    size: number,
    sizeLabel: string | undefined,
    format: InventoryFormat | undefined,
    origin: 'local' | 'import' | undefined,
    dismantle: boolean,
    menuisier: boolean,
  ) => {
    if (quantity <= 0) return;
    let text = `- ${quantity} ${quantity > 1 ? plural.toLowerCase() : label.toLowerCase()}`;
    if (sizeLabel) {
      const singular = sizeLabel.replace(/s$/u, '');
      text += ` de ${size} ${size > 1 ? sizeLabel : singular}`;
    } else if (format === 'small') text += ', petit format';
    else if (format === 'large') text += ', grand format';
    if (origin === 'import') text += ', importé';
    if (dismantle) text += ' (démontage et montage)';
    if (menuisier) text += ' (menuisier)';
    text += ` : ≈ ${volumeLabel(estimatedInventoryItemVolume(key, size, dismantle, format) * quantity)} m³`;
    lines.push(text);
  };

  if (inventory.dwellingType)
    lines.push(`Logement : ${referenceDwellingLabel(inventory.dwellingType)}`);
  for (const item of inventoryItems) {
    const entry = inventory.entries[item.key];
    if (entry) {
      addItem(
        item.label,
        item.plural,
        item.key,
        entry.quantity,
        entry.size,
        item.sizeLabel,
        entry.format,
        entry.origin,
        entry.dismantle,
        Boolean(entry.menuisier && ['salon', 'chaise'].includes(item.key)),
      );
    }
    for (const variant of inventory.variants.filter((line) => line.itemKey === item.key)) {
      addItem(
        item.label,
        item.plural,
        item.key,
        variant.quantity,
        variant.size,
        item.sizeLabel,
        variant.format,
        variant.origin,
        variant.dismantle,
        Boolean(variant.menuisier && ['salon', 'chaise'].includes(item.key)),
      );
    }
  }
  for (const item of inventory.custom) {
    addItem(
      item.label,
      item.label,
      'custom',
      item.quantity,
      1,
      undefined,
      item.format,
      item.origin,
      Boolean(item.dismantle),
      false,
    );
  }

  const annex = referenceAnnexVolume(inventory);
  if (annex > 0) {
    lines.push(
      `- Effets annexes (sacs, vaisselle, linge…), forfait ${referenceDwellingLabel(inventory.dwellingType)} : ≈ ${volumeLabel(annex)} m³`,
    );
  }
  const notes = inventoryFlags
    .filter((flag) => inventory.flags[flag.key])
    .map((flag) => flag.label.toLowerCase());
  if (inventory.ready === 'oui') notes.push('matériel prêt à être chargé');
  if (inventory.ready === 'non') notes.push("matériel pas prêt, emballage par l'équipe");
  if (inventory.stairs === 'oui') notes.push('tout passe dans les escaliers');
  if (inventory.stairs === 'non')
    notes.push(
      'certains objets ne passent pas dans les escaliers (démontage, fenêtre ou monte-meuble)',
    );
  if (inventory.stairs === 'verif') notes.push('passage des escaliers à vérifier');
  if (notes.length) lines.push(`À noter : ${notes.join(', ')}.`);
  return lines.join('\n');
}

const referenceDuration = (minutes: number) => {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}` : `${rest} min`;
};

export function referenceMovingEstimateNote(
  estimate: MovingEstimate,
  routeKm = 0,
  maxDayHours = 10,
): string {
  if (estimate.volume <= 0) return '';
  const vehicle = estimate.vehicleName.replace(/^(Mercedes|Renault)\s+/u, '');
  const trips = estimate.trips;
  const first = `Estimation : volume ≈ ${estimate.volume.toFixed(1).replace('.', ',')} m³, soit ${trips} aller${trips > 1 ? 's' : ''}-retour${trips > 1 ? 's' : ''} en ${vehicle}.`;
  const labour =
    `Main-d'œuvre : ${estimate.crew} manœuvres` +
    (estimate.carpenterCount
      ? ` + ${estimate.carpenterCount} menuisier${estimate.carpenterCount > 1 ? 's' : ''}`
      : '') +
    `, chargement + déchargement ≈ ${referenceDuration(estimate.loadingMinutes + estimate.unloadingMinutes)}` +
    (routeKm > 0 ? ` · trajet ≈ ${referenceDuration(estimate.travelMinutes)}` : '') +
    ` · durée ≈ ${referenceDuration(estimate.totalMinutes)} (${estimate.startTime} à ${estimate.endTime})` +
    (estimate.packingMinutes > 90
      ? ` · emballage la veille ≈ ${referenceDuration(estimate.packingMinutes)}`
      : '') +
    (estimate.minimumDays > 1
      ? ` · dépasse ${maxDayHours} h : prévoir ${estimate.minimumDays} jours ou un véhicule de plus`
      : '') +
    '.';
  return `${first}\n${labour}`;
}
