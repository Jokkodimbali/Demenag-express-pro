import type { Vehicle } from '../../../shared/domain/model';
import { vehicleCapacity } from '../../../shared/domain/vehicles/vehicle-capacity';
import { dataUrl } from '../../../shared/application/validation/image-data-url';

export async function vehicleFromForm(data: FormData, existing: Vehicle): Promise<Vehicle> {
  const length = String(data.get('length'));
  const height = String(data.get('height'));
  const width = String(data.get('width'));
  const wheelWidth = String(data.get('wheelWidth'));
  return {
    ...existing,
    name: String(data.get('name')).trim(),
    shortName: String(
      data.get('shortName') ||
        existing.shortName ||
        String(data.get('name')).trim().split(/\s+/).at(-1),
    ).trim(),
    volume: vehicleCapacity(length, height, width, wheelWidth),
    length,
    height,
    width,
    wheelWidth,
    active: data.get('active') === 'on',
    image: await imageValue(data.get('image'), existing.image),
    interior: await imageValue(data.get('interior'), existing.interior),
  };
}

async function imageValue(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value === 'string') return value || fallback;
  return dataUrl(value, fallback);
}
