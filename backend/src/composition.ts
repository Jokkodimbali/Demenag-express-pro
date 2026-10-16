import { PrismaReadiness } from './adapters/out/prisma/readiness.js';
import {
  PrismaAdministration,
  PrismaBookings,
  PrismaCatalogue,
  PrismaDrivers,
  PrismaRoutes,
  PrismaSessions,
  PrismaUsers,
} from './adapters/out/prisma/repositories.js';
import { ScryptPasswords, clock, ids, tokens } from './adapters/out/security/crypto.js';
import type { RoutingProvider } from './application/ports/index.js';
import { AdministrationService } from './application/services/administration.js';
import { AuthService } from './application/services/auth.js';
import { CatalogueService } from './application/services/catalogue.js';
import { DriverService } from './application/services/drivers.js';
import { MovingService } from './application/services/moving.js';
import type { PrismaClient } from './generated/prisma/client.js';
export function compose(db: PrismaClient, routing: RoutingProvider) {
  const catalogue = new PrismaCatalogue(db);
  const bookings = new PrismaBookings(db);
  const drivers = new PrismaDrivers(db);
  const auth = new AuthService(
    new PrismaUsers(db),
    new PrismaSessions(db),
    new ScryptPasswords(),
    tokens,
    clock,
    ids,
  );
  const moving = new MovingService(
    bookings,
    catalogue,
    new PrismaRoutes(db),
    routing,
    drivers,
    clock,
    ids,
  );
  return {
    drivers: new DriverService(drivers, new PrismaUsers(db), bookings, new ScryptPasswords(), ids),
    administration: new AdministrationService(
      new PrismaAdministration(db),
      new PrismaUsers(db),
      new ScryptPasswords(),
      ids,
    ),
    auth,
    moving,
    catalogue: new CatalogueService(catalogue),
    ready: () => new PrismaReadiness(db).check(),
  };
}
