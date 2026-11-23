import { requireValue } from '../shared/errors.js';
import type { QuoteInput, Settings } from '../shared/model.js';
import { taxiFareForDistance, taxiPaidLegCount } from '../../../../shared/taxi-distance-tariffs.js';

const maxDatabaseInteger = 2_147_483_647;
const legLineLabels = new Set([
  'Frais taxi · trajet simple',
  'Frais taxi · montant par trajet modifié',
]);
const approachLineLabel = 'Frais taxi · approche entreprise';

function configuredTaxiFare(distanceKm: number, settings: Settings) {
  const tariffs = settings.taxiDistanceTariffs ?? [];
  if (tariffs.length) {
    const amount = taxiFareForDistance(distanceKm, tariffs);
    requireValue(amount != null, 'Aucun tarif taxi ne couvre la distance du devis.');
    return amount;
  }
  return Math.round(distanceKm * Math.max(0, settings.taxiFeePerKm ?? 0));
}

export function validatedTaxiFeeAmount(
  input: QuoteInput,
  settings: Settings,
  movingDistanceKm: number,
) {
  const taxiLines = input.extraLines.filter((line) => line.label.startsWith('Frais taxi'));
  const applied = input.taxiFeeApplied ?? taxiLines.length > 0;
  if (!applied) {
    requireValue(
      taxiLines.length === 0,
      'Les lignes taxi doivent être retirées quand les frais sont désactivés.',
    );
    return 0;
  }

  const legLines = taxiLines.filter((line) => legLineLabels.has(line.label));
  const approachLines = taxiLines.filter((line) => line.label === approachLineLabel);
  requireValue(
    legLines.length <= 1 &&
      approachLines.length <= 1 &&
      legLines.length + approachLines.length === taxiLines.length,
    'Les lignes de frais taxi du devis sont invalides ou répétées.',
  );

  const savedPerLegOverride = input.taxiPerLegAmountOverride ?? null;
  const savedRoundTripOverride = input.taxiRoundTripAmountOverride ?? null;
  requireValue(
    savedPerLegOverride == null ||
      savedRoundTripOverride == null ||
      savedPerLegOverride === savedRoundTripOverride,
    'Les montants taxi par trajet ne correspondent pas.',
  );
  const perLegOverride = savedPerLegOverride ?? savedRoundTripOverride;
  const perLegAmount =
    perLegOverride ?? configuredTaxiFare(Math.max(0, movingDistanceKm), settings);
  const approachOverride = input.taxiCompanyApproachAmountOverride ?? null;
  const approachDistanceKm = input.taxiCompanyApproachDistanceKm ?? null;
  requireValue(
    approachOverride != null || (approachDistanceKm != null && Number.isFinite(approachDistanceKm)),
    'La distance entre les locaux et le départ client est nécessaire pour vérifier les frais taxi.',
  );
  const approachAmount =
    approachOverride ?? configuredTaxiFare(Math.max(0, approachDistanceKm ?? 0), settings);
  const paidLegCount = taxiPaidLegCount(input.trips);

  if (perLegAmount > 0) {
    requireValue(
      legLines.length === 1 &&
        legLines[0]?.quantity === paidLegCount &&
        legLines[0]?.unitPrice === perLegAmount &&
        legLines[0]?.label ===
          (perLegOverride == null
            ? 'Frais taxi · trajet simple'
            : 'Frais taxi · montant par trajet modifié'),
      'Le détail des trajets taxi ne correspond pas au tarif et aux rotations du devis.',
    );
  } else {
    requireValue(legLines.length === 0, 'Un trajet taxi à zéro FCFA ne doit pas être facturé.');
  }
  if (approachAmount > 0) {
    requireValue(
      approachLines.length === 1 &&
        approachLines[0]?.quantity === 1 &&
        approachLines[0]?.unitPrice === approachAmount,
      'Le trajet locaux → client doit être facturé une seule fois au tarif de sa distance.',
    );
  } else {
    requireValue(
      approachLines.length === 0,
      'Un trajet locaux → client à zéro FCFA ne doit pas être facturé.',
    );
  }

  const total = perLegAmount * paidLegCount + approachAmount;
  requireValue(
    Number.isSafeInteger(total) && total <= maxDatabaseInteger,
    'Le total des frais taxi dépasse la limite autorisée.',
  );
  return total;
}
