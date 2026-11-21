import type { Options, Settings } from '../../../../shared/domain/model';
import { assemblyUnitPrice } from '../../../../moving/domain/pricing/labour-price';

type QuoteLine = { label: string; quantity: number; unitPrice: number; total: number };

function normalizedLabel(label: string) {
  return label
    .trim()
    .replace(/\s+/gu, ' ')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/œ/giu, 'oe')
    .toLocaleLowerCase('fr-FR');
}

export function quoteInventoryLines(input: {
  rawLines: QuoteLine[];
  inventoryLines: Array<{ label: string; quantity: number; unitPrice: number }>;
  extras: Array<[keyof Options, string, string]>;
  options: Options;
  inventoryOptions: Options;
  settings?: Settings;
  includeMenu: boolean;
}) {
  if (!input.inventoryLines.length) return input.rawLines;
  const assemblyOptionLabels = new Set(
    input.extras.filter(([key]) => key !== 'labour').map(([, label]) => normalizedLabel(label)),
  );
  return [
    ...input.rawLines.filter(
      (line) =>
        !line.label.startsWith('Menuisier ·') &&
        !assemblyOptionLabels.has(normalizedLabel(line.label)),
    ),
    ...input.extras
      .filter(([key]) => input.includeMenu && key !== 'labour')
      .map(([key, label]) => {
        const quantity = Math.max(0, input.options[key] - input.inventoryOptions[key]);
        const unitPrice = input.settings
          ? assemblyUnitPrice(
              input.settings,
              key === 'desk' ? 'bureau' : key === 'wardrobe' ? 'armoire' : 'lit',
            )
          : 0;
        return { label, quantity, unitPrice, total: quantity * unitPrice };
      })
      .filter((line) => line.quantity > 0),
    ...input.inventoryLines.map((line) => ({
      ...line,
      total: line.quantity * line.unitPrice,
    })),
  ];
}
