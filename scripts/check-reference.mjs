import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const expectedDocument = '6054ce493c541f50764d0f7debed6dbef342accfc8d5cf600e0960dc11e6abe8';
const expectedAssets = {
  'logo.png': '987baabff136582af0494a4cf509f5d1800744438efe0304046e42e668e10df1',
  'sprinter-profil.png': 'ac5a80bc5b35b153040455dd4c55721dd18e09996d3d2a063f35db1af5bd6846',
  'sprinter-interieur.png': '5f84003aaea40d6e8f6e7682e9aa9e0dfa773c132cc901b797d810cdd250653b',
  'trafic-profil.png': '829f0133e0c031d8f0e39c3bda048a4cdd14246ac4b2f643dbda2a327508b78f',
  'trafic-interieur.png': '7a4658a6f97787508daccf7221e73ed870f13f8579027a7b3ca4a01dd47bed5c',
  'master-profil.png': 'b92c0a2be4027557b0d0bc2919b5fbded2c8aeb9f4e5172ff93398bcdc21d2d3',
  'master-interieur.png': '21efc33e9369ff048a880b43dca9265772b013c587bf39f498f3437a492237c1',
  'cachet.png': '2384143bc28377a17b49b3d458bf13db6975c8f37268a1946226b7ccab1df820',
  'signature.png': '2a26b47766d94bc3ad93205c86e6c5ce6297b7f37e6ebd546a90d288aa643c14',
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const document = readFileSync(resolve(root, 'reference/Demenag Express.dc.html'));
if (digest(document) !== expectedDocument)
  throw new Error('Le fichier de référence a été modifié.');
const references = [
  ...new Set(
    [...document.toString('utf8').matchAll(/assets\/([\w.-]+)/g)].map((match) => match[1]),
  ),
];
for (const name of references) {
  const expected = expectedAssets[name];
  if (!expected) throw new Error(`Ressource non répertoriée : ${name}`);
  const actual = digest(readFileSync(resolve(root, 'frontend/public/assets', name)));
  if (actual !== expected) throw new Error(`Ressource originale modifiée : ${name}`);
}
console.log(`Fichier de référence intact ; ${references.length} ressources originales vérifiées.`);
