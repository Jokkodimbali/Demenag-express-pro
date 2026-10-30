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
  removeVehicle(catalogue: Catalogue, vehicle: Vehicle): Promise<Catalogue> {
    return this.repository.deleteVehicle(vehicle.id).then(() => this.repository.catalogue());
  }
  deactivateVehicle(catalogue: Catalogue, vehicle: Vehicle): Promise<Catalogue> {
    return this.saveVehicle(catalogue, { ...vehicle, active: false });
  }

  saveBookingAvailability(catalogue: Catalogue, bookingsEnabled: boolean): Promise<Catalogue> {
    return this.repository.updateCatalogue({
      ...catalogue,
      settings: { ...catalogue.settings, bookingsEnabled },
    });
  }
}
