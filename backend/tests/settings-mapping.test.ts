import assert from 'node:assert/strict';
import test from 'node:test';
import type { ParametreApplication } from '../src/generated/prisma/client.js';
import { fromSettings } from '../src/adapters/out/prisma/mapping.js';

function settingsRow(matrix: unknown): ParametreApplication {
  return {
    id: 'main',
    tarifManoeuvre: 6000,
    tarifEtageManoeuvre: 500,
    tarifAscenseurManoeuvre: 500,
    grillePrixManoeuvre: matrix,
    planificationManoeuvre: {},
    tarifMontage: 15000,
    telephoneEntreprise: '+221775105104',
    numeroWhatsapp: '+221775105104',
    nomEntreprise: 'Demenag Express',
    adresseEntreprise: 'Dakar, Sénégal',
    piedFacture: 'Merci pour votre confiance.',
    tiktokUrl: null,
    facebookUrl: null,
    instagramUrl: null,
    logoFacture: null,
    tamponFacture: null,
    signatureFacture: null,
    reservationsOuvertes: true,
    delaiMaximumJours: 366,
    preavisReservationHeures: 0,
    quantiteMaximaleOptions: 20,
    nombreMaximalTrajets: 20,
    annulationClientAutorisee: true,
    preavisAnnulationHeures: 0,
    bornesDistance: [15, 25, 35],
    creneauxOuverts: [],
    questionnaire: [],
  } as unknown as ParametreApplication;
}

test('la matrice de manœuvre vide historique reste compatible avec une sauvegarde catalogue', () => {
  assert.equal(fromSettings(settingsRow({})).labourMatrix, undefined);
});

test('la matrice complète configurée reste disponible après lecture du catalogue', () => {
  const priceMatrix = Object.fromEntries(
    (['none', 'from', 'to', 'both'] as const).map((scenario) => [
      scenario,
      Array.from({ length: 6 }, (_, from) =>
        Array.from({ length: 6 }, (_, to) => 6000 + from * 100 + to),
      ),
    ]),
  );

  assert.deepEqual(fromSettings(settingsRow(priceMatrix)).labourMatrix, priceMatrix);
});
