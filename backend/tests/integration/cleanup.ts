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
      questionnaire: jsonInput(original.settings.questionnaire),
    },
  });
}

export async function deleteScenarioData(context: IntegrationContext, routeIds: string[]) {
  const { db } = context;
  const scenarioUsers =
    context.testUserIds.length || context.testPhones.length
      ? await db.utilisateur.findMany({
          where: {
            OR: [
              ...(context.testUserIds.length ? [{ id: { in: context.testUserIds } }] : []),
              ...(context.testPhones.length
                ? [{ telephone: { in: context.testPhones }, nom: { startsWith: context.prefix } }]
                : []),
            ],
          },
          select: { id: true },
        })
      : [];
  const userIds = [...new Set([...context.testUserIds, ...scenarioUsers.map(({ id }) => id)])];

  if (userIds.length) {
    await db.$transaction([
      db.reservation.deleteMany({ where: { utilisateurId: { in: userIds } } }),
      db.utilisateur.deleteMany({ where: { id: { in: userIds } } }),
    ]);
  }
  if (routeIds.length) await db.itineraire.deleteMany({ where: { id: { in: routeIds } } });

  const [remainingUsers, remainingBookings, remainingRoutes] = await Promise.all([
    userIds.length ? db.utilisateur.count({ where: { id: { in: userIds } } }) : 0,
    userIds.length ? db.reservation.count({ where: { utilisateurId: { in: userIds } } }) : 0,
    routeIds.length ? db.itineraire.count({ where: { id: { in: routeIds } } }) : 0,
  ]);
  if (remainingUsers || remainingBookings || remainingRoutes)
    throw new Error(
      `Nettoyage incomplet du scénario : ${remainingUsers} compte(s), ${remainingBookings} réservation(s), ${remainingRoutes} itinéraire(s) restant(s).`,
    );
}
