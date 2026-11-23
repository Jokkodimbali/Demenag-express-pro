import assert from 'node:assert/strict';
import test from 'node:test';
import type { ParametreApplication } from '../src/generated/prisma/client.js';
import { fromSettings, toSettings } from '../src/adapters/out/prisma/mapping.js';

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
    modelePrenomContactWhatsapp: '{ref} {prenom}',
    modeleNomContactWhatsapp: '{nom} · {date}',
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

test('les deux modèles WhatsApp restent distincts lors de la lecture et de la sauvegarde', () => {
  const row = {
    ...settingsRow({}),
    modeleDevisWhatsapp: 'Modèle final {num}',
    modeleDevisProvisoireWhatsapp: 'Modèle provisoire {num}',
  } as ParametreApplication;
  const mapped = fromSettings(row);

  assert.equal(mapped.whatsappQuoteTemplate, 'Modèle final {num}');
  assert.equal(mapped.whatsappProvisionalTemplate, 'Modèle provisoire {num}');

  const saved = toSettings(mapped);
  assert.equal(saved.modeleDevisWhatsapp, 'Modèle final {num}');
  assert.equal(saved.modeleDevisProvisoireWhatsapp, 'Modèle provisoire {num}');
});

test('le format des contacts reste enregistré avec les paramètres', () => {
  const row = {
    ...settingsRow({}),
    modelePrenomContactWhatsapp: '{ref} {prenom}',
    modeleNomContactWhatsapp: '{nom} · {date}',
  } as ParametreApplication;
  const mapped = fromSettings(row);
  assert.equal(mapped.contactFirstTemplate, '{ref} {prenom}');
  assert.equal(mapped.contactLastTemplate, '{nom} · {date}');
  const saved = toSettings(mapped);
  assert.equal(saved.modelePrenomContactWhatsapp, '{ref} {prenom}');
  assert.equal(saved.modeleNomContactWhatsapp, '{nom} · {date}');
});

test('la suppression du QR de paiement reste persistée au lieu de restaurer le QR par défaut', () => {
  const row = { ...settingsRow({}), qrPaiement: null } as ParametreApplication;
  const settings = fromSettings(row);

  assert.equal(settings.paymentQr, null);
  assert.equal(toSettings(settings).qrPaiement, null);
});

test('les couleurs de marge sont conservées dans le JSON des paramètres', () => {
  const row = {
    ...settingsRow({}),
    planificationManoeuvre: {
      grossMarginAboveThresholdColor: '#17aa66',
      grossMarginBelowThresholdColor: '#cc3344',
    },
  } as ParametreApplication;
  const mapped = fromSettings(row);

  assert.equal(mapped.grossMarginAboveThresholdColor, '#17aa66');
  assert.equal(mapped.grossMarginBelowThresholdColor, '#cc3344');
  const saved = toSettings(mapped).planificationManoeuvre as Record<string, unknown>;
  assert.equal(saved.grossMarginAboveThresholdColor, '#17aa66');
  assert.equal(saved.grossMarginBelowThresholdColor, '#cc3344');
});

test('les anciennes couleurs manquantes ou invalides utilisent les valeurs par défaut', () => {
  const row = {
    ...settingsRow({}),
    planificationManoeuvre: {
      grossMarginAboveThresholdColor: 'green',
      grossMarginBelowThresholdColor: '#123',
    },
  } as ParametreApplication;
  const mapped = fromSettings(row);

  assert.equal(mapped.grossMarginAboveThresholdColor, '#31c878');
  assert.equal(mapped.grossMarginBelowThresholdColor, '#ff5a5f');
});

test('les types personnalisés de l’inventaire et les types masqués sont conservés en JSON', () => {
  const inventoryTypes = [
    {
      k: 'uaquarium',
      n: 'Aquarium',
      p: 'Aquariums',
      sec: 'Objets fragiles',
      L: 100,
      W: 50,
      H: 60,
      kg: 70,
      up: true,
      frag: true,
      notop: true,
      menuPriceLocal: 5000,
      menuPriceImport: 7500,
    },
  ];
  const row = {
    ...settingsRow({}),
    planificationManoeuvre: {
      blanketLengthCm: 204,
      blanketWidthCm: 184,
      customInventoryTypes: inventoryTypes,
      hiddenInventoryKeys: ['vitrine'],
    },
  } as ParametreApplication;

  const mapped = fromSettings(row);
  assert.deepEqual(mapped.customInventoryTypes, inventoryTypes);
  assert.deepEqual(mapped.hiddenInventoryKeys, ['vitrine']);
  const saved = toSettings(mapped).planificationManoeuvre as Record<string, unknown>;
  assert.deepEqual(saved.customInventoryTypes, inventoryTypes);
  assert.deepEqual(saved.hiddenInventoryKeys, ['vitrine']);
  assert.equal(saved.blanketLengthCm, 204);
});

test('les tarifs taxi relationnels sont lus dans les paramètres et leur défaut couvre le catalogue vide', () => {
  const customTaxiTariffs = [
    {
      id: 'taxi-short',
      settingsId: 'main',
      label: 'Course courte',
      minDistanceKm: 0,
      maxDistanceKm: 4,
      amountFcfa: 1800,
      sortOrder: 0,
    },
    {
      id: 'taxi-long',
      settingsId: 'main',
      label: 'Course longue',
      minDistanceKm: 4,
      maxDistanceKm: null,
      amountFcfa: 30000,
      sortOrder: 1,
    },
  ];
  const mapped = fromSettings({
    ...settingsRow({}),
    taxiDistanceTariffs: customTaxiTariffs,
  } as ParametreApplication);
  assert.deepEqual(
    mapped.taxiDistanceTariffs?.map(({ minDistanceKm, maxDistanceKm, amountFcfa }) => ({
      minDistanceKm,
      maxDistanceKm,
      amountFcfa,
    })),
    [
      { minDistanceKm: 0, maxDistanceKm: 4, amountFcfa: 1800 },
      { minDistanceKm: 4, maxDistanceKm: null, amountFcfa: 30000 },
    ],
  );

  const defaults = fromSettings(settingsRow({}));
  assert.deepEqual(
    defaults.taxiDistanceTariffs?.map((tariff) => tariff.amountFcfa),
    [1500, 2500, 3500, 5000, 7000, 30000],
  );
});
