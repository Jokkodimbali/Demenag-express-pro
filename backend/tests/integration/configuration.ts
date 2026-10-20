import assert from 'node:assert/strict';
import type { IntegrationContext } from './context.js';

export async function configureDeterministicPricing(context: IntegrationContext) {
  const { db } = context;
  await db.vehicule.update({
    where: { id: 'sprinter' },
    data: { tarifs: [30_000, 37_000, 44_000], actif: true },
  });
  await db.parametreApplication.update({
    where: { id: 'main' },
    data: {
      tarifManoeuvre: 6_000,
      tarifMontage: 15_000,
      bornesDistance: [15, 25, 35],
      reservationsOuvertes: true,
      quantiteMaximaleOptions: 20,
      nombreMaximalTrajets: 20,
      preavisReservationHeures: 0,
      delaiMaximumJours: 366,
      creneauxOuverts: [
        { label: 'Matin (8h – 12h)', startHour: 8 },
        { label: 'Après-midi (13h – 17h)', startHour: 13 },
        { label: 'Soir (17h – 20h)', startHour: 17 },
      ],
    },
  });
  assert.deepEqual(
    (await db.vehicule.findUniqueOrThrow({ where: { id: 'sprinter' } })).tarifs,
    [30_000, 37_000, 44_000],
  );
  assert.equal(
    (await db.parametreApplication.findUniqueOrThrow({ where: { id: 'main' } })).tarifManoeuvre,
    6_000,
  );
}

export function createBookingInput(context: IntegrationContext, routeId: string) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return {
    vehicleId: 'sprinter',
    routeId,
    customerName: context.prefix + ' Client',
    customerPhone: context.phone(0),
    fromAddress: 'Ouakam Dakar',
    toAddress: 'Almadies Dakar',
    date: tomorrow,
    timeSlot: '09:30',
    options: { labour: 1, desk: 0, wardrobe: 0, bed: 1 },
    notes: 'Test isolé',
    requestId: crypto.randomUUID(),
    estimate: { total: 1 },
  };
}
