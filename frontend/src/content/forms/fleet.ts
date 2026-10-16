import { messages } from '../fr';
export const fields = [
  ['name', messages.labelNom],
  ['volume', messages.volumeUtile],
  ['length', 'Longueur utile'],
  ['height', 'Hauteur utile'],
  ['width', 'Largeur utile'],
  ['wheelWidth', messages.largeurEntrePassagesDeRoue],
] as const;
