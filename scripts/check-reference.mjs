import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const expectedDocument = '0e0f6051c1da84ced1107d6cdacf5b3b63c9a43baa137bc5d1e5bf1f79fb6540';
const expectedReferenceScripts = {
  'support.js': '8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe',
  'image-slot.js': '7fca2b8ffd71fa00e78c1f8ed0ba79bf888293397f9fc51c65a0f07ad6014890',
  'gmaps-plus.js': 'e7c6271beb26d8b6f4f9703be0610177ed65bc4dc390acaec72e8e9006e101c7',
  'loading-sim.js': '92a69b8757987807312d48ae54b76ef1e689b1d047c069ffeaa1dd2d047c9fe8',
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
  'kit-gants.jpg': 'd870679e4bdbb92db1b8c3026e3fb84a5f77d622e7db55daac69ea80410887a5',
  'kit-sangles-attache.jpg': '2fb02089427bcc60a03b8d8f318d95e98e3d68ff772ea2619aa75cf1daec7906',
  'kit-sangles-levage.webp': 'b6a6eb1d783041db6ba314ba57cfe62a67c3e8fe9505057b645779592d83ebaf',
  'kit-serviettes.webp': 'fd954b99097e95920c2385261732a1054a3e566fc12dc8856629513426da4785',
  'fonts/Inter-Bold.ttf': 'fbe825cbfc749317f57a1433d3905aa9d3f388732fd29b8e8a36f34845e3bc3e',
  'fonts/Inter-Regular.ttf': 'a414b48aa577ef2c62ebb135341ddeef33ee26a4f5dc9f787f93c1aab08ebb50',
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const document = readFileSync(resolve(root, 'reference/Demenag Express.dc.html'));
if (digest(document) !== expectedDocument)
  throw new Error('Le fichier de référence a été modifié.');
const references = [
  ...new Set([
    ...[...document.toString('utf8').matchAll(/assets\/([\w./-]+)/g)].map((match) => match[1]),
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
