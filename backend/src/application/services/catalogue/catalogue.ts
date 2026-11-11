import type { Settings, TollPointInput, User, Vehicle } from '../../../domain/shared/model.js';
import { requireAdministrator } from '../../../domain/security/access-policy.js';
import type { CatalogueRepository } from '../../ports/index.js';
import type { CatalogueUseCases } from '../../ports/use-cases.js';
export class CatalogueService implements CatalogueUseCases {
  constructor(private repository: CatalogueRepository) {}
  get() {
    return this.repository.get();
  }
  googleMapsApiKey(actor: User) {
    requireAdministrator(actor);
    return this.repository.googleMapsApiKey();
  }
  updateGoogleMapsApiKey(actor: User, value: string) {
    requireAdministrator(actor);
    return this.repository.updateGoogleMapsApiKey(value);
  }
  inventoryIllustration(key: string) {
    return this.repository.inventoryIllustration(key);
  }
  saveInventoryIllustration(actor: User, key: string, image: string) {
    requireAdministrator(actor);
    return this.repository.saveInventoryIllustration(key, image);
  }
  adminQuoteDraft(actor: User) {
    requireAdministrator(actor);
    return this.repository.adminQuoteDraft(actor.id);
  }
  saveAdminQuoteDraft(actor: User, draft: unknown) {
    requireAdministrator(actor);
    return this.repository.saveAdminQuoteDraft(actor.id, draft);
  }
  clearAdminQuoteDraft(actor: User) {
    requireAdministrator(actor);
    return this.repository.clearAdminQuoteDraft(actor.id);
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
