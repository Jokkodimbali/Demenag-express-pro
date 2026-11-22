import { consolidateDuplicateQuoteLines } from './quote-lines.js';

function key(label) {
  return label.trim().replace(/\s+/gu, ' ').normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/œ/giu, 'oe').toLocaleLowerCase('fr-FR');
}

export function replaceSavedCustomLines(price, previousCustomLines, nextCustomLines) {
  const lines = price.lines.map((line) => ({ ...line }));
  for (const custom of previousCustomLines) {
    const index = lines.findIndex((line) => key(line.label) === key(custom.label));
    if (index < 0) continue;
    const line = lines[index];
    line.quantity -= custom.quantity;
    line.total -= custom.quantity * custom.unitPrice;
    if (line.quantity <= 0) lines.splice(index, 1);
    else line.unitPrice = line.total / line.quantity;
  }
  for (const custom of nextCustomLines) {
    if (!custom.label.trim() || custom.quantity <= 0 || custom.unitPrice <= 0) continue;
    lines.push({ label: custom.label.trim(), quantity: custom.quantity, unitPrice: custom.unitPrice, total: custom.quantity * custom.unitPrice });
  }
  const combined = consolidateDuplicateQuoteLines(lines);
  const subtotal = combined.reduce((sum, line) => sum + line.total, 0);
  const discount = price.discountType === 'pct'
    ? Math.round(subtotal * Math.min(100, price.discountValue ?? 0) / 100)
    : Math.min(subtotal, price.discountValue ?? price.discount);
  return { ...price, lines: combined, discount, total: price.total === null ? null : subtotal - discount };
}
