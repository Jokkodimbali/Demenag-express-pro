import type {
  BookingSlot,
  Driver,
  Settings,
  UserCredentials,
  Vehicle,
} from '../../../domain/model.js';
import type {
  ParametreApplication,
  Utilisateur,
  Vehicule,
  Chauffeur,
} from '../../../generated/prisma/client.js';
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
  assemblyPrice: row.tarifMontage,
  businessPhone: row.telephoneEntreprise,
  whatsappPhone: row.numeroWhatsapp || row.telephoneEntreprise,
  businessName: row.nomEntreprise,
  businessAddress: row.adresseEntreprise,
  invoiceFooter: row.piedFacture,
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
});
export const toSettings = (value: Settings) => ({
  bornesDistance: value.distanceBounds,
  tarifManoeuvre: value.labourPrice,
  tarifMontage: value.assemblyPrice,
  telephoneEntreprise: value.businessPhone,
  numeroWhatsapp: value.whatsappPhone,
  nomEntreprise: value.businessName,
  adresseEntreprise: value.businessAddress,
  piedFacture: value.invoiceFooter,
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
});

export const toStatus = {
  pending: 'en_attente',
  confirmed: 'confirmee',
  in_progress: 'en_cours',
  completed: 'terminee',
  cancelled: 'annulee',
} as const;
