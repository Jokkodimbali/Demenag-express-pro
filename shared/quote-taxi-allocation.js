export function manoeuvreCount(lines) {
  return (
    lines.find(
      (line) =>
        /^Man[œo]uvre/iu.test(line.label) &&
        !/heures au-delà/iu.test(line.label) &&
        line.quantity > 0,
    )?.quantity ?? 0
  );
}

export function applyTaxiToManoeuvrePrice(price, taxiAmount) {
  if (!taxiAmount) return price;
  const index = price.lines.findIndex(
    (line) =>
      /^Man[œo]uvre/iu.test(line.label) &&
      !/heures au-delà/iu.test(line.label) &&
      line.quantity > 0,
  );
  if (index < 0) return price;
  const lines = [...price.lines];
  const line = lines[index];
  lines[index] = {
    ...line,
    unitPrice: line.unitPrice + taxiAmount / line.quantity,
    total: line.total + taxiAmount,
  };
  return { ...price, lines, total: price.total === null ? null : price.total + taxiAmount };
}

export function removeTaxiFromManoeuvrePrice(price, taxiAmount) {
  return applyTaxiToManoeuvrePrice(price, -taxiAmount);
}
