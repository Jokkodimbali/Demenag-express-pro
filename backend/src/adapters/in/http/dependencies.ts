import type {
  AdministrationUseCases,
  AuthUseCases,
  CatalogueUseCases,
  DriverUseCases,
  MovingUseCases,
} from '../../../application/ports/use-cases.js';
import type { NotificationPublisher } from '../../../application/ports/index.js';
export type Dependencies = {
  administration: AdministrationUseCases;
  auth: AuthUseCases;
  moving: MovingUseCases;
  catalogue: CatalogueUseCases;
  drivers: DriverUseCases;
  ready: () => Promise<void>;
  origin: string;
  production: boolean;
  notifications?: NotificationPublisher;
};
