import type {
  AdministrationUseCases,
  AuthUseCases,
  CatalogueUseCases,
  MovingUseCases,
} from '../../../application/ports/use-cases.js';
export type Dependencies = {
  administration: AdministrationUseCases;
  auth: AuthUseCases;
  moving: MovingUseCases;
  catalogue: CatalogueUseCases;
  ready: () => Promise<void>;
  origin: string;
  production: boolean;
};
