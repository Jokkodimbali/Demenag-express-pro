function normalizedLabel(label) {
  return label
    .trim()
    .replace(/\s+/gu, ' ')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/œ/giu, 'oe')
    .toLocaleLowerCase('fr-FR');
}

export function isAssemblyServiceLine(label) {
  const normalized = normalizedLabel(label);
  return (
    /^menuisier\s/u.test(normalized) || /\b(?:montage|demontage|assemblage)\b/u.test(normalized)
  );
}

export function consolidateDuplicateQuoteLines(lines) {
  const consolidated = [];
  const indicesByLabel = new Map();

  for (const line of lines) {
    const key = normalizedLabel(line.label);
    const existingIndex = indicesByLabel.get(key);
    if (existingIndex === undefined) {
      indicesByLabel.set(key, consolidated.length);
      consolidated.push({ ...line });
      continue;
    }

    const existing = consolidated[existingIndex];
    existing.quantity += line.quantity;
    existing.total += line.total;
    existing.unitPrice = existing.quantity ? existing.total / existing.quantity : 0;
  }

  return consolidated;
}
