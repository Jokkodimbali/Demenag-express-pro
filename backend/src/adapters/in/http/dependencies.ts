import type { CatalogueRepository } from '../../../application/ports/index.js';
import type { AdministrationService } from '../../../application/services/administration.js';
import type { AuthService } from '../../../application/services/auth.js';
import type { MovingService } from '../../../application/services/moving.js';
export type Dependencies = {
  administration: AdministrationService;
  auth: AuthService;
  moving: MovingService;
  catalogue: CatalogueRepository;
  ready: () => Promise<void>;
  origin: string;
  production: boolean;
};
