const optimizedImages = new Set([
  '/assets/sprinter-profil.png',
  '/assets/sprinter-interieur.png',
  '/assets/trafic-profil.png',
  '/assets/trafic-interieur.png',
  '/assets/master-profil.png',
  '/assets/master-interieur.png',
]);

export function vehicleImageForDisplay(image: string): string {
  return optimizedImages.has(image) ? `${image.slice(0, -4)}.webp` : image;
}
