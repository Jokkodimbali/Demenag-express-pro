import { AppError } from '../../domain/errors.js';
import type { User } from '../../domain/model.js';
import { requireAdministrator } from '../../domain/policies/access.js';
import type { AccountingRepository, ManualAccountingInput } from '../ports/index.js';

export class AccountingService {
  constructor(private repository: AccountingRepository) {}

  list(actor: User, month?: string) {
    requireAdministrator(actor);
    return this.repository.list(month);
  }

  create(actor: User, input: ManualAccountingInput) {
    requireAdministrator(actor);
    return this.repository.create(input);
  }

  async void(actor: User, id: string) {
    requireAdministrator(actor);
    const changed = await this.repository.void(id);
    if (!changed) throw new AppError(404, 'Écriture manuelle introuvable ou déjà annulée.');
  }
}
