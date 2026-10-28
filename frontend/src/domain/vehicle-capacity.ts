const measurement = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0;

export function vehicleCapacity(length: string, height: string, width: string, wheelWidth: string) {
  const l = measurement(length);
  const h = measurement(height);
  const w = measurement(width);
  const p = Math.min(measurement(wheelWidth) || w, w);
  const arch = Math.max(0, w - p) * 0.3 * Math.min(l, 1.9);
  const volume = Math.max(0, l * h * w - arch) * 0.95;
  return `${String(Math.round(volume * 10) / 10).replace('.', ',')} m³`;
}
