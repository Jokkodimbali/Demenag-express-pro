import type {
  BookingSlot,
  ClientQuestion,
  Driver,
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
} from '../../../generated/prisma/client.js';

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
});
export const toDriver = (value: Driver) => ({
  id: value.id,
  utilisateurId: value.userId,
  nom: value.name,
  telephone: value.phone,
  photo: value.photo,
  actif: value.active,
  vehiculeId: value.vehicleId,
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
  businessPhone: row.telephoneEntreprise,
  whatsappPhone: row.numeroWhatsapp || row.telephoneEntreprise,
  businessName: row.nomEntreprise,
  businessAddress: row.adresseEntreprise,
  invoiceFooter: row.piedFacture,
  tiktokUrl: row.tiktokUrl,
  facebookUrl: row.facebookUrl,
  instagramUrl: row.instagramUrl,
  invoiceLogo: row.logoFacture,
  invoiceStamp: row.tamponFacture,
  invoiceSignature: row.signatureFacture,
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
  telephoneEntreprise: value.businessPhone,
  numeroWhatsapp: value.whatsappPhone,
  nomEntreprise: value.businessName,
  adresseEntreprise: value.businessAddress,
  piedFacture: value.invoiceFooter,
  tiktokUrl: value.tiktokUrl ?? null,
  facebookUrl: value.facebookUrl ?? null,
  instagramUrl: value.instagramUrl ?? null,
  logoFacture: value.invoiceLogo,
  tamponFacture: value.invoiceStamp,
  signatureFacture: value.invoiceSignature,
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
