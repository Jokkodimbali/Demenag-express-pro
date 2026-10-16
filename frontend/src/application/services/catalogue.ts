import type { Catalogue, Vehicle } from '../../domain/model';
import type { CatalogueRepository } from '../ports';
export class CatalogueService {
  constructor(private readonly repository: CatalogueRepository) {}
  saveVehicle(catalogue: Catalogue, vehicle: Vehicle): Promise<Catalogue> {
    const exists = catalogue.vehicles.some((item) => item.id === vehicle.id);
    return this.repository.updateCatalogue({
      ...catalogue,
      vehicles: exists
        ? catalogue.vehicles.map((item) => (item.id === vehicle.id ? vehicle : item))
        : [...catalogue.vehicles, vehicle],
    });
  }
  removeVehicle(id: string): Promise<Catalogue> {
    return this.repository.removeVehicle(id);
  }
}
