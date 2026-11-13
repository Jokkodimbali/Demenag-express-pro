import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovingPlanningPanel } from '../src/modules/booking/components/MovingPlanningPanel.tsx';
import type { Draft } from '../src/modules/booking/application/booking-draft.ts';
import {
  blankInventory,
  type Inventory,
} from '../src/modules/moving/domain/inventory/inventory.ts';
import {
  defaultMovingLaborPlanning,
  estimateMovingWork,
} from '../src/modules/moving/domain/estimate/moving-estimate.ts';
import type { Vehicle } from '../src/modules/shared/domain/model.ts';

type LegacyLine = { k: string; q: number; s: number; g: string; dm: boolean };
type LegacyInventory = {
  logement: string;
  annexOn: boolean;
  opts: { fragile: boolean };
  lines: LegacyLine[];
};
type LegacyCard = { name: string; cap: string; trips: string; fill: string };
type LegacyCalculator = {
  state: { data: { invCat: object; labor: { fill: number; fillF: number } } };
  laborEst: () => null;
  invVolume: (inventory: LegacyInventory) => number;
  invEstVals: (quote: { inv: LegacyInventory; vehicle: string; trips: number }) => {
    invEst: LegacyCard[];
  };
};

const source = readFileSync(
  new URL('../../reference/Demenag Express.dc.html', import.meta.url),
  'utf8',
);
const start = source.indexOf('class Component extends DCLogic {');
const end = source.indexOf('</script>', start);
assert.ok(start >= 0 && end > start);
const context = vm.createContext({
  DCLogic: class {},
  console,
  Date,
  Math,
  Set,
  Map,
  URL,
  Intl,
  window: {},
});
vm.runInContext(
  `${source.slice(start, end).replace('state = this.init();', 'state = {};')}\nglobalThis.ReferenceComponent = Component;`,
  context,
  { timeout: 10000 },
);
const ReferenceComponent = (context as { ReferenceComponent: new () => LegacyCalculator })
  .ReferenceComponent;

const fleet: Vehicle[] = [
  {
    id: 'sprinter',
    name: 'Mercedes Sprinter',
    shortName: 'Sprinter',
    volume: '~14 m³',
    length: '4,30 m',
    height: '1,94 m',
    width: '1,78 m',
    wheelWidth: '1,35 m',
    image: '',
    interior: '',
    prices: [30000, 37000, 44000],
  },
  {
    id: 'trafic',
    name: 'Renault Trafic',
    shortName: 'Trafic',
    volume: '~5,2 m³',
    length: '2,54 m',
    height: '1,39 m',
    width: '1,66 m',
    wheelWidth: '1,27 m',
    image: '',
    interior: '',
    prices: [15000, 18000, 22000],
  },
  {
    id: 'master',
    name: 'Renault Master',
    shortName: 'Master',
    volume: '~13 m³',
    length: '3,73 m',
    height: '1,89 m',
    width: '1,76 m',
    wheelWidth: '1,38 m',
    image: '',
    interior: '',
    prices: [25000, 30000, 36000],
  },
];

const dwellingKeys: Record<string, string> = {
  Studio: 'studio',
  F2: 'f2',
  F3: 'f3',
  F4: 'f4',
  'F5 et plus': 'f5',
  Villa: 'villa',
};
const itemKeys: Record<string, string> = { 'table-manger': 'tablem' };
const formats: Record<string, string> = { small: 'p', medium: 'm', large: 'g' };

const cases: Array<{
  name: string;
  dwelling: string;
  annexOn?: boolean;
  fragile?: boolean;
  fill?: number;
  fillF?: number;
  items: Array<[string, number, number, 'small' | 'medium' | 'large', boolean]>;
}> = [
  {
    name: 'Studio avec quelques cartons',
    dwelling: 'Studio',
    items: [['carton', 4, 1, 'medium', false]],
  },
  {
    name: 'F2 avec cartons et valises',
    dwelling: 'F2',
    items: [
      ['carton', 20, 1, 'medium', false],
      ['sac', 5, 1, 'large', false],
    ],
  },
  {
    name: 'F3 avec canapé et réfrigérateur',
    dwelling: 'F3',
    items: [
      ['salon', 1, 5, 'medium', false],
      ['frigo', 1, 1, 'large', false],
      ['carton', 30, 1, 'medium', false],
    ],
  },
  {
    name: 'F4 avec meubles démontés',
    dwelling: 'F4',
    items: [
      ['armoire', 2, 3, 'medium', true],
      ['lit', 2, 2, 'medium', true],
      ['carton', 40, 1, 'medium', false],
    ],
  },
  {
    name: 'Villa volumineuse sans effets annexes',
    dwelling: 'Villa',
    annexOn: false,
    items: [
      ['salon', 2, 6, 'medium', false],
      ['armoire', 3, 4, 'medium', false],
      ['carton', 80, 1, 'medium', false],
    ],
  },
  {
    name: 'F3 fragile avec dernier trajet peu rempli',
    dwelling: 'F3',
    annexOn: false,
    fragile: true,
    items: [['carton', 64, 1, 'medium', false]],
  },
  {
    name: 'F5 fragile avec taux personnalisés',
    dwelling: 'F5 et plus',
    fragile: true,
    fill: 90,
    fillF: 65,
    items: [
      ['carton', 45, 1, 'medium', false],
      ['matelas', 2, 2, 'medium', false],
    ],
  },
];

for (const scenario of cases) {
  test(`${scenario.name} : pourcentage affiché identique pour les trois véhicules`, (t) => {
    const inventory: Inventory = blankInventory();
    inventory.dwellingType = scenario.dwelling;
    inventory.annexOn = scenario.annexOn ?? true;
    inventory.flags.fragile = scenario.fragile ?? false;
    const lines: LegacyLine[] = [];
    for (const [key, quantity, size, format, dismantle] of scenario.items) {
      inventory.entries[key] = { quantity, size, format, dismantle };
      lines.push({
        k: itemKeys[key] ?? key,
        q: quantity,
        s: size,
        g: formats[format],
        dm: dismantle,
      });
    }
    const legacyInventory: LegacyInventory = {
      logement: dwellingKeys[scenario.dwelling],
      annexOn: scenario.annexOn ?? true,
      opts: { fragile: scenario.fragile ?? false },
      lines,
    };
    const fill = scenario.fill ?? 85;
    const fillF = scenario.fillF ?? 75;
    const reference = new ReferenceComponent();
    reference.state = { data: { invCat: {}, labor: { fill, fillF } } };
    reference.laborEst = () => null;
    const referenceVolume = reference.invVolume(legacyInventory);
    const cards = reference.invEstVals({
      inv: legacyInventory,
      vehicle: 'sprinter',
      trips: 1,
    }).invEst;
    const markup = renderToStaticMarkup(
      createElement(MovingPlanningPanel, {
        draft: {
          inventory,
          route: null,
          timeSlot: '08:00',
          date: '2026-11-15',
          month: '2026-11',
          fromAddress: 'Dakar',
          toAddress: 'Rufisque',
        } as Draft,
        setDraft: () => undefined,
        vehicles: fleet,
        selectedVehicleId: 'sprinter',
        trips: 1,
        maxTrips: 99,
        onApply: () => undefined,
        laborPlanning: { ...defaultMovingLaborPlanning, fill, fillF },
      }),
    );
    const renderedCards = [
      ...markup.matchAll(
        /<article class="moving-vehicle-estimate(?: active)?">([\s\S]*?)<\/article>/g,
      ),
    ];
    assert.equal(renderedCards.length, fleet.length, 'cartes affichées par l’application');
    const results: string[] = [];

    for (const [index, vehicle] of fleet.entries()) {
      const estimate = estimateMovingWork(inventory, vehicle, null, {
        laborPlanning: { ...defaultMovingLaborPlanning, fill, fillF },
      });
      const card = cards.find((row) => row.name === vehicle.shortName);
      assert.ok(card, `${vehicle.id} absent de la référence`);
      assert.ok(Math.abs(estimate.volume - referenceVolume) < 1e-9, `${vehicle.id} : volume`);
      assert.equal(
        card.cap,
        `${estimate.capacity.toFixed(1).replace('.', ',')} m³`,
        `${vehicle.id} : capacité`,
      );
      assert.equal(
        card.trips,
        `${estimate.trips} aller${estimate.trips > 1 ? 's' : ''}-retour${estimate.trips > 1 ? 's' : ''}`,
        `${vehicle.id} : trajets`,
      );
      const rendered = renderedCards[index]?.[1] ?? '';
      const renderedTrip = rendered.match(
        /<strong class="moving-vehicle-trip-count">([\s\S]*?)<\/strong>/,
      )?.[1];
      const renderedFill = rendered.match(
        /<span class="moving-vehicle-fill">([\s\S]*?)<\/span>/,
      )?.[1];
      assert.equal(
        renderedTrip?.replace(/<[^>]+>/g, ''),
        card.trips,
        `${vehicle.id} : trajets affichés`,
      );
      assert.equal(
        renderedFill?.replace(/<[^>]+>/g, ''),
        card.fill,
        `${vehicle.id} : pourcentage affiché`,
      );
      results.push(`${vehicle.shortName}: ${card.trips}, ${card.fill}`);
    }
    t.diagnostic(`Référence = application : ${results.join(' | ')}`);
  });
}
