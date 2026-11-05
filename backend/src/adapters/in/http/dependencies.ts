import type {
  AdministrationUseCases,
  AuthUseCases,
  CatalogueUseCases,
  DriverUseCases,
  VehicleReportUseCases,
  NotificationUseCases,
  MovingUseCases,
  AccountingUseCases,
  ClaudeUseCases,
} from '../../../application/ports/use-cases.js';
import type { NotificationPublisher } from '../../../application/ports/index.js';
export type Dependencies = {
  accounting: AccountingUseCases;
  claude: ClaudeUseCases;
  administration: AdministrationUseCases;
  auth: AuthUseCases;
  moving: MovingUseCases;
  catalogue: CatalogueUseCases;
  drivers: DriverUseCases;
  vehicleReports: VehicleReportUseCases;
  notificationService: NotificationUseCases;
  ready: () => Promise<void>;
  origin: string | string[];
  production: boolean;
  notifications?: NotificationPublisher;
};
