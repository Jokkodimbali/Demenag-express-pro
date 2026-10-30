import { inventoryItems, type Inventory } from './inventory';

export function assemblyCount(inventory: Inventory, key: 'desk' | 'wardrobe' | 'bed'): number {
  return inventoryItems
    .filter((item) => item.assembly === key)
    .reduce((sum, item) => {
      const line = inventory.entries[item.key];
      return (
        sum +
        (line?.dismantle ? line.quantity : 0) +
        inventory.variants
          .filter((variant) => variant.itemKey === item.key && variant.dismantle)
          .reduce((count, variant) => count + variant.quantity, 0)
      );
    }, 0);
}
