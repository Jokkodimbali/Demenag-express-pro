import type { Inventory } from '../../../moving/domain/inventory/inventory';
import type { Vehicle } from '../../../shared/domain/model';

const formatIndexes = { small: 0, medium: 1, large: 2 } as const;

function numberFrom(value: string): number {
  return Number.parseFloat(value.replace(',', '.')) || 0;
}

export function vehicleDimensionWarnings(inventory: Inventory, vehicle: Vehicle): string[] {
  const height = numberFrom(vehicle.height);
  const length = numberFrom(vehicle.length);
  const warnings: string[] = [];
  const entries = [
    ...Object.entries(inventory.entries).map(([key, item]) => ({ key, ...item })),
    ...inventory.variants.map((item) => ({ key: item.itemKey, ...item })),
  ].filter((item) => item.quantity > 0);
  entries.forEach((item) => {
    const { key } = item;
    if (key === 'frigo') {
      const itemHeight = [0.85, 1.6, 1.85][formatIndexes[item.format ?? 'medium']];
      if (height && itemHeight > height)
        warnings.push(
          `Frigo debout ≈ ${itemHeight.toFixed(2)} m : dépasse la hauteur utile de ${height.toFixed(2)} m.`,
        );
    }
    if (key === 'vitrine' && item.format !== 'small' && height && height < 1.8)
      warnings.push(
        `Vitrine debout ≈ 1,80 m : dépasse la hauteur utile de ${height.toFixed(2)} m.`,
      );
    if (key === 'armoire' && !item.dismantle && height && height < 2)
      warnings.push(
        `Armoire montée ≈ 2 m : ne rentre pas debout dans ce véhicule (${height.toFixed(2)} m utiles). À coucher ou démonter.`,
      );
    if (key === 'salon' && !item.dismantle && length) {
      const itemLength = item.size >= 6 ? 2.6 : item.size >= 3 ? 2.1 : 1.6;
      if (itemLength > length)
        warnings.push(
          `Salon ≈ ${itemLength.toFixed(1)} m : dépasse la longueur utile du plancher (${length.toFixed(1)} m).`,
        );
    }
    if (key === 'table-manger' && !item.dismantle && length) {
      const itemLength = item.size >= 8 ? 2.2 : item.size >= 6 ? 1.8 : 1.2;
      if (itemLength > length)
        warnings.push(
          `Table ≈ ${itemLength.toFixed(1)} m : dépasse la longueur utile du plancher (${length.toFixed(1)} m).`,
        );
    }
  });
  return [...new Set(warnings)];
}
