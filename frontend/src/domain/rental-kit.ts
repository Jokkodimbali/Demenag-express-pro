import type { RentalKitConfigurationItem, RentalKitItem, Vehicle } from './model';

export const defaultRentalKitConfiguration: RentalKitConfigurationItem[] = [
  { id: 'vehicle', label: 'Véhicule propre', rule: 'vehicle' },
  { id: 'driver', label: 'Chauffeur', rule: 'one' },
  {
    id: 'blankets',
    label: 'Serviettes de déménagement propres',
    rule: 'blankets',
    image: '/assets/kit-serviettes.webp',
  },
  {
    id: 'lifting-straps',
    label: 'Paires de sangles de levage propres (1 paire pour 2 manœuvres)',
    rule: 'liftingStraps',
    image: '/assets/kit-sangles-levage.webp',
  },
  { id: 'gloves', label: 'Paires de gants', rule: 'gloves', image: '/assets/kit-gants.jpg' },
  {
    id: 'tie-down-straps',
    label: 'Sangles d’attache (arrimage dans le véhicule)',
    rule: 'tieDownStraps',
    image: '/assets/kit-sangles-attache.jpg',
  },
];

export function defaultRentalKit(
  vehicle: Vehicle,
  crew: number,
  configuration: RentalKitConfigurationItem[] = defaultRentalKitConfiguration,
  planNeeds?: { blankets: number; straps: number } | null,
): RentalKitItem[] {
  const movers = Math.max(1, Math.round(crew) || 2);
  const items = configuration.length ? configuration : defaultRentalKitConfiguration;
  return items.map((item) => {
    const quantity =
      item.rule === 'vehicle' || item.rule === 'one'
        ? 1
        : item.rule === 'blankets'
          ? planNeeds?.blankets || Math.max(4, movers * 2)
          : item.rule === 'liftingStraps'
            ? Math.max(1, Math.ceil(movers / 2))
            : item.rule === 'gloves'
              ? movers
              : item.rule === 'tieDownStraps'
                ? Math.max(4, planNeeds?.straps || 4)
                : Math.max(0, item.quantity ?? 1);
    return {
      id: item.id,
      label:
        item.rule === 'vehicle'
          ? `${item.label} · ${vehicle.shortName || vehicle.name}`
          : item.label,
      quantity,
      ...(item.image
        ? { image: item.image }
        : item.rule === 'vehicle'
          ? { image: vehicle.image }
          : {}),
    };
  });
}
