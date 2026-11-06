const measurement = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;

export function vehicleCapacity(length: string, height: string, width: string, wheelWidth: string) {
  const l = measurement(length);
  const h = measurement(height);
  const w = measurement(width);
  const p = Math.min(measurement(wheelWidth) || w, w);
  // Keep the reference formula: wheel arches use 0.30 m height and at most
  // 0.95 × 2 m of length before the 0.95 usable-volume factor is applied.
  const arch = Math.max(0, w - p) * 0.3 * Math.min(0.95 * 2, l);
  const volume = Math.max(0, l * h * w - arch) * 0.95;
  return `${String(Math.round(volume * 10) / 10).replace('.', ',')} m³`;
}
