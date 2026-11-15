import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadingSimulation } from '../src/modules/admin/quotes/components/LoadingSimulation';
import { blankDraft } from '../src/modules/booking/application/booking-draft';
import { LoadingSimulationPdfProvider } from '../src/modules/booking/application/loading-simulation-pdf-context';
import { estimateMovingWork } from '../src/modules/moving/domain/estimate/moving-estimate';
import { AppProvider } from '../src/modules/shared/application/context';
import type { Vehicle } from '../src/modules/shared/domain/model';

test('l’indicateur de fatigue reste affiché quand la simulation 3D est repliée', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { EquipArt: { art: () => '' } },
  });
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    const vehicle = {
      id: 'sprinter',
      name: 'Mercedes Sprinter',
      volume: '13,9 m³',
      length: '4,30 m',
      height: '1,94 m',
      width: '1,78 m',
      wheelWidth: '1,35 m',
      image: '/assets/sprinter-profil.png',
      interior: '/assets/sprinter-interieur.png',
      prices: [30_000, 37_000, 44_000],
    } as Vehicle;
    const draft = blankDraft();
    draft.vehicleId = vehicle.id;
    draft.inventory.entries.frigo = {
      quantity: 1,
      size: 0,
      format: 'medium',
      dismantle: false,
    };
    const estimate = estimateMovingWork(draft.inventory, vehicle, null);
    const appProps = {
      api: {},
      exportQuote: async () => new Blob(),
      exportAccounting: async () => new Blob(),
      exportPlanningWeek: async () => new Blob(),
      exportTariffDocument: async () => new Blob(),
    } as unknown as Omit<Parameters<typeof AppProvider>[0], 'children'>;
    const html = renderToStaticMarkup(
      React.createElement(
        AppProvider,
        appProps,
        React.createElement(
          LoadingSimulationPdfProvider,
          { exporter: async () => new Blob() },
          React.createElement(LoadingSimulation, {
            draft,
            vehicles: [vehicle],
            quoteConfig: { trips: estimate.trips, calcMode: 'auto' },
            crew: estimate.crew,
            estimate,
            setDraft: () => {},
            onTripsChange: () => {},
          }),
        ),
      ),
    );
    assert.match(html, /INDICATEUR DE FATIGUE DE L’ÉQUIPE/);
    assert.match(html, /quote-fatigue-indicator/);
    assert.match(html, /Manutention · ISO 11228-1/);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});
