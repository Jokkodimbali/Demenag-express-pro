import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  clientNameSuggestions,
  clientPhoneKey,
  clientSuggestionSelection,
  mergeClientSuggestionProfiles,
  savedClientForPhone,
  type ClientSuggestionProfile,
} from '../src/modules/admin/quotes/application/services/client-suggestions.ts';
import { referenceRouteAddresses } from '../src/modules/moving/maps/reference-route-addresses.ts';

const reference = readFileSync(
  new URL('../../reference/Demenag Express.dc.html', import.meta.url),
  'utf8',
);

test('les suggestions de trajet reprennent exactement la liste du fichier de référence', () => {
  const datalist = reference.match(/<datalist id="dk-qrt">([\s\S]*?)<\/datalist>/)?.[1];
  assert.ok(datalist, 'la liste dk-qrt existe dans le fichier de référence');
  const addresses = [...datalist.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(referenceRouteAddresses, addresses);
});

test('la clé client compare les neuf derniers chiffres comme le fichier de référence', () => {
  assert.equal(clientPhoneKey('+221 77 123 45 67'), '771234567');
  assert.equal(clientPhoneKey('+33 6 77 123 45 67'), '771234567');
  assert.equal(clientPhoneKey('771 234 567'), '771234567');
});

test('la saisie du nom filtre par nom ou téléphone, exclut le client sélectionné et limite à six', () => {
  const profiles: ClientSuggestionProfile[] = [
    { name: 'Awa Ndiaye', phone: '771234567', address: 'Mermoz, Dakar' },
    { name: 'AWA Fall', phone: '781234567', address: 'Ngor, Dakar' },
    { name: 'Moussa Diop', phone: '771999999', address: 'Yoff, Dakar' },
    ...Array.from({ length: 6 }, (_, index) => ({
      name: `Awa Client ${index}`,
      phone: `77000000${index}`,
      address: '',
    })),
  ];

  assert.deepEqual(
    clientNameSuggestions(profiles, '  awa ', '000000000').map((profile) => profile.name),
    ['Awa Ndiaye', 'AWA Fall', 'Awa Client 0', 'Awa Client 1', 'Awa Client 2', 'Awa Client 3'],
  );
  assert.deepEqual(clientNameSuggestions(profiles, 'Awa Ndiaye', '771234567'), []);
  assert.deepEqual(
    clientNameSuggestions(profiles, '999999', '').map((profile) => profile.name),
    ['Moussa Diop'],
  );
  assert.deepEqual(clientNameSuggestions(profiles, '   ', ''), []);
});

test('la saisie du téléphone retrouve le client enregistré sur ses neuf derniers chiffres', () => {
  const profiles = [{ name: 'Awa Ndiaye', phone: '+221 77 123 45 67', address: 'Mermoz, Dakar' }];
  assert.equal(savedClientForPhone(profiles, '77 123 45 67')?.name, 'Awa Ndiaye');
  assert.equal(savedClientForPhone(profiles, '77 123'), null);
});

test('la sélection remplit le départ seulement si le champ est vide', () => {
  const profile = { name: 'Awa Ndiaye', phone: '771234567', address: 'Mermoz, Dakar' };
  assert.deepEqual(clientSuggestionSelection(profile, ''), {
    customerName: 'Awa Ndiaye',
    customerPhone: '771234567',
    fromAddress: 'Mermoz, Dakar',
  });
  assert.deepEqual(clientSuggestionSelection(profile, 'Point E, Dakar'), {
    customerName: 'Awa Ndiaye',
    customerPhone: '771234567',
  });
});

test('les réservations complètent les fiches client, en gardant les clients masqués masqués', () => {
  const bookings = [
    {
      phone: '771111111',
      customerName: 'Client récent',
      fromAddress: 'Ngor, Dakar',
      createdAt: '2026-11-10T12:00:00.000Z',
    },
    {
      phone: '772222222',
      customerName: 'Client masqué',
      fromAddress: 'Yoff, Dakar',
      createdAt: '2026-11-01T12:00:00.000Z',
    },
    {
      phone: '+221 77 123 45 67',
      customerName: 'Ancien nom',
      fromAddress: 'Ancienne adresse',
      createdAt: '2026-10-01T12:00:00.000Z',
    },
  ];
  const profiles = [
    { name: 'Awa Ndiaye', phone: '771234567', address: 'Mermoz, Dakar' },
    { name: 'Awa masquée', phone: '772222222', address: 'HLM, Dakar' },
  ];

  assert.deepEqual(
    mergeClientSuggestionProfiles(profiles, bookings, [
      { phone: '772222222', hiddenAt: '2026-11-02T12:00:00.000Z' },
    ]),
    [
      { name: 'Client récent', phone: '771111111', address: 'Ngor, Dakar' },
      { name: 'Awa Ndiaye', phone: '771234567', address: 'Mermoz, Dakar' },
    ],
  );
});
