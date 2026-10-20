import { Prisma } from '../../src/generated/prisma/client.js';
import type { IntegrationContext, OriginalConfiguration } from './context.js';

function jsonInput(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function restoreConfiguration(
  context: IntegrationContext,
  original: OriginalConfiguration,
) {
  const { db } = context;
  await db.vehicule.update({
    where: { id: original.vehicle.id },
    data: { tarifs: original.vehicle.tarifs, actif: original.vehicle.actif },
  });
  await db.parametreApplication.update({
    where: { id: 'main' },
    data: {
      ...original.settings,
      creneauxOuverts: jsonInput(original.settings.creneauxOuverts),
    },
  });
}

export async function deleteScenarioData(
  context: IntegrationContext,
  userIds: string[],
  routeIds: string[],
) {
  const { db } = context;
  await db.reservation.deleteMany({ where: { utilisateurId: { in: userIds } } });
  await db.utilisateur.deleteMany({ where: { id: { in: userIds } } });
  await db.itineraire.deleteMany({ where: { id: { in: routeIds } } });
}
