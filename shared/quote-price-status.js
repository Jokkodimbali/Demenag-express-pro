export function isQuotePricePending(price) {
  return (
    price.total === null ||
    (price.tier === 3 &&
      !price.lines.some((line) => line.label.startsWith('Transport') && line.unitPrice > 0))
  );
}

export function normalizePendingQuotePrice(price) {
  return isQuotePricePending(price) && price.total !== null ? { ...price, total: null } : price;
}
