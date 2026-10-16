import type { Settings, UserCredentials, Vehicle } from '../../../domain/model.js';
import type {
  ParametreApplication,
  Utilisateur,
  Vehicule,
} from '../../../generated/prisma/client.js';
export const fromUser = (row: Utilisateur): UserCredentials => ({
  id: row.id,
  name: row.nom,
  phone: row.telephone,
  passwordHash: row.empreinteMotDePasse,
  active: row.actif,
  role: row.role === 'administrateur' ? 'admin' : 'client',
});
export const toUser = (value: UserCredentials) => ({
  id: value.id,
  nom: value.name,
  telephone: value.phone,
  empreinteMotDePasse: value.passwordHash,
  actif: value.active,
  role: value.role === 'admin' ? ('administrateur' as const) : ('client' as const),
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
  volume: row.volume,
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
  volume: value.volume,
  image: value.image,
});
export const fromSettings = (row: ParametreApplication): Settings => ({
  distanceBounds: row.bornesDistance as [number, number, number],
  labourPrice: row.tarifManoeuvre,
  assemblyPrice: row.tarifMontage,
  businessPhone: row.telephoneEntreprise,
  bookingsEnabled: row.reservationsOuvertes,
  maxAdvanceDays: row.delaiMaximumJours,
  minNoticeHours: row.preavisReservationHeures,
  maxOptions: row.quantiteMaximaleOptions,
  maxTrips: row.nombreMaximalTrajets,
  clientCancellation: row.annulationClientAutorisee,
  cancellationNoticeHours: row.preavisAnnulationHeures,
  enabledSlots: row.creneauxOuverts,
});
export const toSettings = (value: Settings) => ({
  bornesDistance: value.distanceBounds,
  tarifManoeuvre: value.labourPrice,
  tarifMontage: value.assemblyPrice,
  telephoneEntreprise: value.businessPhone,
  reservationsOuvertes: value.bookingsEnabled,
  delaiMaximumJours: value.maxAdvanceDays,
  preavisReservationHeures: value.minNoticeHours,
  quantiteMaximaleOptions: value.maxOptions,
  nombreMaximalTrajets: value.maxTrips,
  annulationClientAutorisee: value.clientCancellation,
  preavisAnnulationHeures: value.cancellationNoticeHours,
  creneauxOuverts: value.enabledSlots,
});

export const toStatus = {
  pending: 'en_attente',
  confirmed: 'confirmee',
  in_progress: 'en_cours',
  completed: 'terminee',
  cancelled: 'annulee',
} as const;
