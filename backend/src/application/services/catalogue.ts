import type { Settings, TollPointInput, User, Vehicle } from '../../domain/model.js';
import { requireAdministrator } from '../../domain/policies/access.js';
import type { CatalogueRepository } from '../ports/index.js';
import type { CatalogueUseCases } from '../ports/use-cases.js';
export class CatalogueService implements CatalogueUseCases {
  constructor(private repository: CatalogueRepository) {}
  get() {
    return this.repository.get();
  }
  async update(actor: User, vehicles: Vehicle[], settings: Settings) {
    requireAdministrator(actor);
    await this.repository.update(vehicles, settings);
  }
  async removeVehicle(actor: User, id: string) {
    requireAdministrator(actor);
    await this.repository.removeVehicle(id);
  }
  listTollPoints() {
    return this.repository.listTollPoints();
  }
  createTollPoint(actor: User, input: TollPointInput) {
    requireAdministrator(actor);
    return this.repository.createTollPoint(input);
  }
  updateTollPoint(actor: User, id: string, input: TollPointInput) {
    requireAdministrator(actor);
    return this.repository.updateTollPoint(id, input);
  }
  deleteTollPoint(actor: User, id: string) {
    requireAdministrator(actor);
    return this.repository.deleteTollPoint(id);
  }
}
