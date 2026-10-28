// Catalogue des textes français : interface et messages, sans logique métier.
import type { BookingStatus } from '../model.js';

const reservationStatusLabel: Record<BookingStatus, string> = {
  pending: 'en attente de confirmation',
  confirmed: 'confirmée',
  in_progress: 'en cours de déménagement',
  completed: 'terminée',
  cancelled: 'annulée',
};

export const messages = {
  notificationNouvelleReservation: (
    reference: string,
    customer: string,
    date: string | null,
    slot: string,
  ) =>
    `La réservation ${reference} de ${customer}, ${date ? `prévue le ${date} (${slot})` : 'sans date de rendez-vous'}, attend votre confirmation.`,
  notificationStatutReservation: (reference: string, status: BookingStatus) =>
    `La réservation ${reference} est maintenant ${reservationStatusLabel[status]}.`,
  notificationDevisDisponible: (reference: string) =>
    `Votre devis pour la réservation ${reference} est disponible dans votre espace.`,
  tropDeTentativesReessayezDans15Minutes: 'Trop de tentatives. Réessayez dans 15 minutes.',
  connectezVousPourContinuer: 'Connectez-vous pour continuer.',
  baseDeDonneesIndisponible: 'Base de données indisponible.',
  verifiezLesChampsDuFormulaire: 'Vérifiez les champs du formulaire.',
  requeteJsonInvalide: 'Requête JSON invalide.',
  uneErreurEstSurvenueReessayezDansUnInstant: 'Une erreur est survenue. Réessayez dans un instant.',
  tropDeRecherchesPatientezUneMinute: 'Trop de recherches. Patientez une minute.',
  utilisezAuMoins10Caracteres: 'Utilisez au moins 10 caractères.',
  chaqueVehiculeDoitEtrePresentUneFois: 'Chaque véhicule doit être présent une fois.',
  lesBornesDoiventEtreCroissantes: 'Les bornes doivent être croissantes.',
  matin8h12h: 'Matin (8h – 12h)',
  apresMidi13h17h: 'Après-midi (13h – 17h)',
  soir17h20h: 'Soir (17h – 20h)',
  tropDeRequetesReessayezDansUneMinute: 'Trop de requêtes. Réessayez dans une minute.',
  origineDeLaRequeteRefusee: 'Origine de la requête refusée.',
  leCalculDuTrajetEstIndisponibleReessayezDans:
    'Le calcul du trajet est indisponible. Réessayez dans un instant.',
  leServiceCartographiqueEstSurcharge:
    'Le service cartographique est très sollicité. Réessayez dans un instant.',
  laRechercheDAdresseEstIndisponibleVousPouvez:
    'La recherche d’adresse est indisponible. Vous pouvez placer les points sur la carte.',
  accesAdministrateurRequis: 'Accès administrateur requis.',
  conservezAuMoinsUnAdministrateurActif: 'Conservez au moins un administrateur actif.',
  unAutreAdministrateurAModifieCesComptesActualisez:
    'Un autre administrateur a modifié ces comptes. Actualisez.',
  cetteReservationAChangeActualisezLaPage: 'Cette réservation a changé. Actualisez la page.',
  leCatalogueDoitEtreInitialise: 'Le catalogue doit être initialisé.',
  conflitCeNumeroExisteDejaOuCeVehicule:
    'Conflit : ce numéro existe déjà ou ce véhicule est déjà réservé sur ce créneau.',
  vousNePouvezPasRetirerVotrePropreAcces:
    'Vous ne pouvez pas retirer votre propre accès administrateur.',
  saisissezUnNumeroMobileSenegalaisValide: 'Saisissez un numéro mobile sénégalais valide.',
  unCompteUtiliseDejaCeNumero: 'Un compte utilise déjà ce numéro.',
  telephoneOuMotDePasseIncorrect: 'Téléphone ou mot de passe incorrect.',
  motDePasseActuelIncorrect: 'Mot de passe actuel incorrect.',
  recalculezLeTrajetSonEstimationAExpire: 'Recalculez le trajet : son estimation a expiré.',
  vehiculeInconnu: 'Véhicule inconnu.',
  lesReservationsSontTemporairementFermees: 'Les réservations sont temporairement fermées.',
  reservationIntrouvable: 'Réservation introuvable.',
  contactezLAdministrationPourAnnuler: 'Contactez l’administration pour annuler.',
  apres: 'Après',
  leDelaiDAnnulationEstDepasseContactezL:
    'Le délai d’annulation est dépassé. Contactez l’administration.',
  cetteReservationEstCloturee: 'Cette réservation est clôturée.',
  demarrezLeDemenagementAvantDeFinaliserSonDevis:
    'Démarrez le déménagement avant de finaliser son devis.',
  renseignezLeTarifDuTransportAvantDeFinaliser:
    'Renseignez le tarif du transport avant de finaliser.',
  configurationManquanteOuInvalide: 'Configuration manquante ou invalide : ',
  dateInvalide: 'Date invalide.',
  choisissezUneDateAVenir: 'Choisissez une date à venir.',
  maximumAdvanceNotice: (days: string | number) => `Réservez au maximum ${days} jours à l’avance.`,
  creneauInvalide: 'Créneau invalide.',
  leDelaiMinimumAvantReservationNEstPas: 'Le délai minimum avant réservation n’est pas respecté.',
  ceCreneauADejaCommence: 'Ce créneau a déjà commencé.',
  actionReserveeALAdministration: 'Action réservée à l’administration.',
  ceChangementDeStatutNEstPlusPossible: 'Ce changement de statut n’est plus possible.',
  nombreDAllersRetoursInvalide: 'Nombre d’allers-retours invalide.',
  quantiteInvalide: 'Quantité invalide.',
  remiseInvalide: 'Remise invalide.',
  prixPersonnaliseInvalide: 'Prix personnalisé invalide.',
  chargeSupplementaireInvalide: 'Charge supplémentaire invalide.',
  transportLine: (vehicleName: string | number) => `Transport ${vehicleName} · aller-retour`,
  manUvre: 'Manœuvre',
  menuisierBureau: 'Menuisier · bureau',
  menuisierArmoire: 'Menuisier · armoire',
  menuisierLit: 'Menuisier · lit',
  laRemiseDepasseLeMontantDuDevis: 'La remise dépasse le montant du devis.',
  montantDuDevisDepasseLimiteDeStockage:
    'Le montant dépasse la limite de stockage autorisée. Vérifiez les tarifs et le nombre de trajets.',
  connexionOuSchemaPostgresqlIndisponibleVerifiezBackendEnv:
    'Connexion ou schéma PostgreSQL indisponible. Vérifiez backend/.env puis exécutez npm run db:migrate et npm run db:seed.',
  labelConsultezbackendenvexample: '. Consultez backend/.env.example.',
  requeteTropVolumineuse: 'La requête dépasse la taille autorisée.',
  compteIntrouvable: 'Compte introuvable.',
  chauffeurIntrouvable: 'Chauffeur introuvable ou inactif.',
  actionReserveeAuxChauffeurs: 'Action réservée aux chauffeurs.',
  profilChauffeurIntrouvable: 'Profil chauffeur introuvable.',
} as const;
