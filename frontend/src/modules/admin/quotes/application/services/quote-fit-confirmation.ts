export const fitConfirmationCopy = (warnings: string[]) => ({
  title: `${warnings.length} ${warnings.length === 1 ? 'objet ne rentre pas' : 'objets ne rentrent pas'} dans le véhicule`,
  description: `${warnings.join(' ')} Choisissez un autre véhicule ou démontez les objets concernés. Enregistrer quand même ?`,
});
