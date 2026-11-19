export function manoeuvreCount(lines) {
  return lines.reduce(
    (total, line) =>
      /^Man[œo]uvre/iu.test(line.label) && !/heures au-delà/iu.test(line.label) && line.quantity > 0
        ? total + line.quantity
        : total,
    0,
  );
}

export function applyTaxiToManoeuvrePrice(price, taxiAmount) {
  if (!taxiAmount) return price;
  const isManoeuvre = (line) =>
    /^Man[œo]uvre/iu.test(line.label) && !/heures au-delà/iu.test(line.label) && line.quantity > 0;
  const index = price.lines.findIndex(isManoeuvre);
  if (index < 0) return price;
  const manoeuvreLines = price.lines.filter(isManoeuvre);
  const quantity = manoeuvreLines.reduce((total, line) => total + line.quantity, 0);
  const currentTotal = manoeuvreLines.reduce((total, line) => total + line.total, 0);
  const adjustedTotal = currentTotal + taxiAmount;
  if (!Number.isInteger(quantity) || !Number.isSafeInteger(adjustedTotal) || adjustedTotal < 0)
    return price;

  const template = manoeuvreLines[0];
  const adjustedLine = {
    ...template,
    quantity,
    unitPrice: adjustedTotal / quantity,
    total: adjustedTotal,
  };

  const lines = [];
  price.lines.forEach((line, cursor) => {
    if (cursor === index) lines.push(adjustedLine);
    if (!isManoeuvre(line)) lines.push(line);
  });
  return { ...price, lines, total: price.total === null ? null : price.total + taxiAmount };
}

export function removeTaxiFromManoeuvrePrice(price, taxiAmount) {
  return applyTaxiToManoeuvrePrice(price, -taxiAmount);
}
