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
      grillePrixManoeuvre: jsonInput(original.settings.grillePrixManoeuvre),
      grillePrixMontage: jsonInput(original.settings.grillePrixMontage),
      planificationManoeuvre: jsonInput(original.settings.planificationManoeuvre),
      materielLocation: jsonInput(original.settings.materielLocation),
    },
  });
  await db.$transaction(
    async (transaction) => {
      for (const driver of original.drivers)
        await transaction.chauffeur.update({
          where: { id: driver.id },
          data: {
            utilisateurId: driver.utilisateurId,
            nom: driver.nom,
            telephone: driver.telephone,
            photo: driver.photo,
            actif: driver.actif,
            fonction: driver.fonction,
            vehiculeId: driver.vehiculeId,
            disponibilites: jsonInput(driver.disponibilites),
            vehiculesAutorises: jsonInput(driver.vehiculesAutorises),
            adresse: driver.adresse,
            latitude: driver.latitude,
            longitude: driver.longitude,
            adresseGeocodee: driver.adresseGeocodee,
            competences: jsonInput(driver.competences),
            notes: driver.notes,
            refusMissions: jsonInput(driver.refusMissions),
            refusEffaces: driver.refusEffaces,
          },
        });
      for (const user of original.users)
        await transaction.utilisateur.update({
          where: { id: user.id },
          data: {
            nom: user.nom,
            telephone: user.telephone,
            photo: user.photo,
            actif: user.actif,
          },
        });
    },
    { maxWait: 15000, timeout: 120000 },
  );
}

export async function deleteScenarioData(context: IntegrationContext, routeIds: string[]) {
  const { db } = context;
  if (context.testAccountingEntryIds.length)
    await db.ecritureComptable.deleteMany({
      where: { id: { in: context.testAccountingEntryIds } },
    });
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
    await db.reservation.deleteMany({ where: { utilisateurId: { in: userIds } } });
    await db.utilisateur.deleteMany({ where: { id: { in: userIds } } });
  }
  if (routeIds.length) await db.itineraire.deleteMany({ where: { id: { in: routeIds } } });

  const [remainingUsers, remainingBookings, remainingRoutes, remainingAccountingEntries] =
    await Promise.all([
      userIds.length ? db.utilisateur.count({ where: { id: { in: userIds } } }) : 0,
      userIds.length ? db.reservation.count({ where: { utilisateurId: { in: userIds } } }) : 0,
      routeIds.length ? db.itineraire.count({ where: { id: { in: routeIds } } }) : 0,
      context.testAccountingEntryIds.length
        ? db.ecritureComptable.count({ where: { id: { in: context.testAccountingEntryIds } } })
        : 0,
    ]);
  if (remainingUsers || remainingBookings || remainingRoutes || remainingAccountingEntries)
    throw new Error(
      `Nettoyage incomplet du scénario : ${remainingUsers} compte(s), ${remainingBookings} réservation(s), ${remainingRoutes} itinéraire(s), ${remainingAccountingEntries} écriture(s) comptable(s) restant(s).`,
    );
}
