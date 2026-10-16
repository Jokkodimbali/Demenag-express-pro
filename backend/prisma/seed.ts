import { toVehicle, toSettings } from '../src/adapters/out/prisma/mapping.js';
import '../src/config/env.js';
import { readEnv } from '../src/config/env.js';
import { createPrisma } from '../src/adapters/out/prisma/client.js';
const db = createPrisma(readEnv().DATABASE_URL);
const vehicles = [
  {
    id: 'sprinter',
    name: 'Mercedes Sprinter',
    volume: '~14 m³',
    length: '4,30 m',
    height: '1,94 m',
    width: '1,78 m',
    wheelWidth: '1,35 m',
    image: '/assets/sprinter-profil.png',
    interior: '/assets/sprinter-interieur.png',
    prices: [30000, 37000, 44000],
  },
  {
    id: 'trafic',
    name: 'Renault Trafic III',
    volume: '~5,2 m³',
    length: '2,54 m',
    height: '1,39 m',
    width: '1,66 m',
    wheelWidth: '1,27 m',
    image: '/assets/trafic-profil.png',
    interior: '/assets/trafic-interieur.png',
    prices: [20000, 25000, 30000],
  },
  {
    id: 'master',
    name: 'Renault Master III',
    volume: '~13 m³',
    length: '3,73 m',
    height: '1,89 m',
    width: '1,76 m',
    wheelWidth: '1,38 m',
    image: '/assets/master-profil.png',
    interior: '/assets/master-interieur.png',
    prices: [25000, 31000, 37000],
  },
];
try {
  await db.$transaction([
    ...vehicles.map((vehicle) =>
      db.vehicule.upsert({
        where: { id: vehicle.id },
        update: {},
        create: toVehicle({ ...vehicle, prices: vehicle.prices as [number, number, number] }),
      }),
    ),
    db.parametreApplication.upsert({
      where: { id: 'main' },
      update: {},
      create: {
        id: 'main',
        ...toSettings({
          labourPrice: 6000,
          assemblyPrice: 15000,
          businessPhone: '+221775105104',
        }),
      },
    }),
  ]);
  console.log(
    'Catalogue initialisé. Les tarifs existants sont préservés. Aucun faux client ni compte de démonstration ajouté.',
  );
} finally {
  await db.$disconnect();
}
