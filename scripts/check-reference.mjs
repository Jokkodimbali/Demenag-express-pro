import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const expectedDocument = 'c18cbd892c8a2476e0180d624b3f78b35f10a9db596d2486cb2661903fe4655c';
const expectedReferenceScripts = {
  'support.js': '8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe',
  'image-slot.js': '7fca2b8ffd71fa00e78c1f8ed0ba79bf888293397f9fc51c65a0f07ad6014890',
  'gmaps-plus.js': 'e7c6271beb26d8b6f4f9703be0610177ed65bc4dc390acaec72e8e9006e101c7',
  'loading-sim.js': 'cbfa72216f2c5d213eb5a44a7d26db27b119d87b2c6a4877b24c01a25be9b3a5',
  'equip-art.js': 'ccee26898c273dfdfc36b28f6ba2446a76989763084f463c14610c593412b0d8',
};
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
  'wave-qr.pdf': 'ae72be150b9aa468d65cbedeb3d23e3a035a13f3db1e268030dedd5fd122e913',
  'wave-qr.png': '35b3f6bc0a69e7c415474e84bea5517eb9c5fb62a0ac42c76aa8d6805450b949',
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const document = readFileSync(resolve(root, 'reference/Demenag Express.dc.html'));
if (digest(document) !== expectedDocument)
  throw new Error('Le fichier de référence a été modifié.');
const references = [
  ...new Set([
    ...[...document.toString('utf8').matchAll(/assets\/([\w.-]+)/g)].map((match) => match[1]),
    'wave-qr.png',
  ]),
];
for (const name of references) {
  const expected = expectedAssets[name];
  if (!expected) throw new Error(`Ressource non répertoriée : ${name}`);
  const actual = digest(readFileSync(resolve(root, 'frontend/public/assets', name)));
  if (actual !== expected) throw new Error(`Ressource originale modifiée : ${name}`);
}
for (const [name, expected] of Object.entries(expectedReferenceScripts)) {
  const actual = digest(readFileSync(resolve(root, 'reference', name)));
  if (actual !== expected) throw new Error(`Dépendance de référence modifiée : ${name}`);
  if (name === 'loading-sim.js' || name === 'equip-art.js') {
    const integrated = digest(readFileSync(resolve(root, 'frontend/public/reference', name)));
    if (integrated !== expected)
      throw new Error(`Copie intégrée différente de la référence : ${name}`);
  }
}
console.log(
  `Fichier de référence intact ; ${references.length} ressources originales et ${Object.keys(expectedReferenceScripts).length} scripts locaux vérifiés.`,
);
