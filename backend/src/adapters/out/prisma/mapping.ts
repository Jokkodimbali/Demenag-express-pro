import type {
  BookingSlot,
  ClientQuestion,
  Driver,
  DriverAvailabilityDay,
  LabourPriceMatrix,
  MovingLaborPlanningSettings,
  Settings,
  UserCredentials,
  Vehicle,
} from '../../../domain/model.js';
import { defaultClientQuestions } from '../../../domain/questionnaire.js';
import { vehicleCapacity } from '../../../domain/vehicle-capacity.js';
import type {
  ParametreApplication,
  Utilisateur,
  Vehicule,
  Chauffeur,
  Prisma,
} from '../../../generated/prisma/client.js';

const defaultDriverAvailability = (): DriverAvailabilityDay[] =>
  Array.from({ length: 7 }, (_, day) => ({
    available: day < 6,
    startTime: '08:00',
    endTime: '18:00',
  }));

function mapDriverAvailability(value: unknown): DriverAvailabilityDay[] {
  if (!Array.isArray(value) || value.length !== 7) return defaultDriverAvailability();
  const valid = value.every((day: unknown) => {
    if (!day || typeof day !== 'object' || Array.isArray(day)) return false;
    const item = day as Record<string, unknown>;
    return (
      typeof item.available === 'boolean' &&
      typeof item.startTime === 'string' &&
      /^\d{2}:\d{2}$/.test(item.startTime) &&
      typeof item.endTime === 'string' &&
      /^\d{2}:\d{2}$/.test(item.endTime)
    );
  });
  return valid ? (value as DriverAvailabilityDay[]) : defaultDriverAvailability();
}

function labourPriceMatrix(value: unknown): LabourPriceMatrix | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const matrix = value as Record<string, unknown>;
  const scenarios: LabourPriceMatrix['none'][] = [];
  for (const scenario of ['none', 'from', 'to', 'both'] as const) {
    const rows = matrix[scenario];
    if (
      !Array.isArray(rows) ||
      rows.length !== 6 ||
      rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== 6 ||
          row.some((price) => !Number.isInteger(price) || price < 0 || price > 1_000_000),
      )
    )
      return undefined;
    scenarios.push(rows as LabourPriceMatrix['none']);
  }
  return {
    none: scenarios[0],
    from: scenarios[1],
    to: scenarios[2],
    both: scenarios[3],
  };
}

export const fromUser = (row: Utilisateur): UserCredentials => ({
  id: row.id,
  name: row.nom,
  phone: row.telephone,
  passwordHash: row.empreinteMotDePasse,
  active: row.actif,
  role: row.role === 'administrateur' ? 'admin' : row.role === 'chauffeur' ? 'driver' : 'client',
  photo: row.photo,
  passwordResetRequestedAt: row.demandeReinitialisationMotDePasse?.toISOString() ?? null,
});
export const toUser = (value: UserCredentials) => ({
  id: value.id,
  nom: value.name,
  telephone: value.phone,
  empreinteMotDePasse: value.passwordHash,
  actif: value.active,
  photo: value.photo ?? null,
  role:
    value.role === 'admin'
      ? ('administrateur' as const)
      : value.role === 'driver'
        ? ('chauffeur' as const)
        : ('client' as const),
});
export const fromVehicle = (row: Vehicule): Vehicle => ({
  id: row.id,
  name: row.nom,
  shortName: row.nomCourt || row.nom,
  length: row.longueur,
  height: row.hauteur,
  width: row.largeur,
  wheelWidth: row.largeurPassageRoues,
  interior: row.interieur,
  prices: row.tarifs as [number, number, number],
  active: row.actif,
  volume: vehicleCapacity(row.longueur, row.hauteur, row.largeur, row.largeurPassageRoues),
  image: row.image,
});
export const toVehicle = (value: Vehicle) => ({
  id: value.id,
  nom: value.name,
  nomCourt: value.shortName?.trim() || value.name,
  longueur: value.length,
  hauteur: value.height,
  largeur: value.width,
  largeurPassageRoues: value.wheelWidth,
  interieur: value.interior,
  tarifs: value.prices,
  actif: value.active,
  volume: vehicleCapacity(value.length, value.height, value.width, value.wheelWidth),
  image: value.image,
});
export const fromDriver = (row: Chauffeur): Driver => ({
  id: row.id,
  userId: row.utilisateurId,
  name: row.nom,
  phone: row.telephone,
  photo: row.photo,
  active: row.actif,
  vehicleId: row.vehiculeId,
  availability: mapDriverAvailability(row.disponibilites),
  role: row.fonction === 'menuisier' || row.fonction === 'manoeuvre' ? row.fonction : 'chauffeur',
  authorizedVehicleIds: Array.isArray(row.vehiculesAutorises)
    ? (row.vehiculesAutorises as string[])
    : [],
  address: row.adresse,
  latitude: row.latitude,
  longitude: row.longitude,
  geocodedAddress: row.adresseGeocodee,
  tags: Array.isArray(row.competences) ? (row.competences as string[]) : [],
  notes: row.notes,
  refusals: Array.isArray(row.refusMissions) ? (row.refusMissions as Driver['refusals']) : [],
  clearedRefusals: row.refusEffaces,
});
export const toDriver = (value: Driver) => ({
  id: value.id,
  utilisateurId: value.userId,
  nom: value.name,
  telephone: value.phone,
  photo: value.photo,
  actif: value.active,
  fonction: value.role ?? 'chauffeur',
  vehiculeId: value.vehicleId,
  ...(value.availability ? { disponibilites: value.availability as Prisma.InputJsonValue } : {}),
  vehiculesAutorises: (value.authorizedVehicleIds ?? []) as Prisma.InputJsonValue,
  adresse: value.address ?? '',
  latitude: value.latitude ?? null,
  longitude: value.longitude ?? null,
  adresseGeocodee: value.geocodedAddress ?? null,
  competences: (value.tags ?? []) as Prisma.InputJsonValue,
  notes: value.notes ?? '',
  refusMissions: (value.refusals ?? []) as Prisma.InputJsonValue,
  refusEffaces: value.clearedRefusals ?? 0,
});
export const fromSettings = (row: ParametreApplication): Settings => ({
  distanceBounds: row.bornesDistance as [number, number, number],
  labourPrice: row.tarifManoeuvre,
  labourFloorPrice: row.tarifEtageManoeuvre,
  labourLiftPrice: row.tarifAscenseurManoeuvre,
  labourMatrix: labourPriceMatrix(row.grillePrixManoeuvre),
  movingLaborPlanning: {
    maxHandlingHours: 3,
    maxDayHours: 8,
    defaultStartHour: 8,
    maxMoversPerVehicle: 6,
    cubicMetersPerHourPerMover: 2.5,
    pauseMinutes: 30,
    ...(row.planificationManoeuvre as Partial<MovingLaborPlanningSettings>),
  },
  assemblyPrice: row.tarifMontage,
  montageP: (row.grillePrixMontage as Settings['montageP']) ?? {},
  businessPhone: row.telephoneEntreprise,
  whatsappPhone: row.numeroWhatsapp || row.telephoneEntreprise,
  whatsappCountryCode: String(row.indicatifWhatsapp || '221'),
  whatsappMode: ['api', 'wame', 'web', 'app'].includes(String(row.modeWhatsapp))
    ? (String(row.modeWhatsapp) as Settings['whatsappMode'])
    : 'api',
  whatsappQuoteTemplate: String(row.modeleDevisWhatsapp ?? ''),
  businessName: row.nomEntreprise,
  businessAddress: row.adresseEntreprise,
  invoiceFooter: row.piedFacture,
  tiktokUrl: row.tiktokUrl,
  facebookUrl: row.facebookUrl,
  instagramUrl: row.instagramUrl,
  invoiceLogo: row.logoFacture,
  invoiceStamp: row.tamponFacture,
  invoiceSignature: row.signatureFacture,
  paymentWave: row.paiementWave,
  paymentCash: row.paiementEspeces,
  paymentQr: row.qrPaiement,
  bookingsEnabled: row.reservationsOuvertes,
  maxAdvanceDays: row.delaiMaximumJours,
  minNoticeHours: row.preavisReservationHeures,
  maxOptions: row.quantiteMaximaleOptions,
  maxTrips: row.nombreMaximalTrajets,
  clientCancellation: row.annulationClientAutorisee,
  cancellationNoticeHours: row.preavisAnnulationHeures,
  enabledSlots: row.creneauxOuverts as BookingSlot[],
  questionnaire: Array.isArray(row.questionnaire)
    ? (row.questionnaire as ClientQuestion[])
    : defaultClientQuestions,
});
export const toSettings = (value: Settings) => ({
  bornesDistance: value.distanceBounds,
  tarifManoeuvre: value.labourPrice,
  tarifEtageManoeuvre: value.labourFloorPrice ?? 500,
  tarifAscenseurManoeuvre: value.labourLiftPrice ?? 500,
  grillePrixManoeuvre: value.labourMatrix ?? {},
  planificationManoeuvre: value.movingLaborPlanning ?? {
    maxHandlingHours: 3,
    maxDayHours: 8,
    defaultStartHour: 8,
    maxMoversPerVehicle: 6,
    cubicMetersPerHourPerMover: 2.5,
    pauseMinutes: 30,
  },
  tarifMontage: value.assemblyPrice,
  grillePrixMontage: (value.montageP ?? {}) as Prisma.InputJsonValue,
  telephoneEntreprise: value.businessPhone,
  numeroWhatsapp: value.whatsappPhone,
  indicatifWhatsapp: value.whatsappCountryCode ?? '221',
  modeWhatsapp: value.whatsappMode ?? 'api',
  modeleDevisWhatsapp:
    value.whatsappQuoteTemplate ??
    'Bonjour {nom}, votre déménagement est terminé. Voici votre devis final Demenag Express {num} : {total} ({allers} aller(s)-retour(s), {vehicule}). Le PDF est disponible dans votre espace client. Merci !',
  nomEntreprise: value.businessName,
  adresseEntreprise: value.businessAddress,
  piedFacture: value.invoiceFooter,
  tiktokUrl: value.tiktokUrl ?? null,
  facebookUrl: value.facebookUrl ?? null,
  instagramUrl: value.instagramUrl ?? null,
  logoFacture: value.invoiceLogo,
  tamponFacture: value.invoiceStamp,
  signatureFacture: value.invoiceSignature,
  paiementWave: value.paymentWave ?? true,
  paiementEspeces: value.paymentCash ?? true,
  qrPaiement: value.paymentQr ?? '/assets/wave-qr.png',
  reservationsOuvertes: value.bookingsEnabled,
  delaiMaximumJours: value.maxAdvanceDays,
  preavisReservationHeures: value.minNoticeHours,
  quantiteMaximaleOptions: value.maxOptions,
  nombreMaximalTrajets: value.maxTrips,
  annulationClientAutorisee: value.clientCancellation,
  preavisAnnulationHeures: value.cancellationNoticeHours,
  creneauxOuverts: value.enabledSlots,
  questionnaire: value.questionnaire ?? defaultClientQuestions,
});

export const toStatus = {
  pending: 'en_attente',
  confirmed: 'confirmee',
  in_progress: 'en_cours',
  completed: 'terminee',
  cancelled: 'annulee',
} as const;
