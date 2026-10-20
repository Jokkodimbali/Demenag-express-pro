import assert from 'node:assert/strict';
import {
  createIntegrationContext,
  captureOriginalConfiguration,
  integrationHeader,
} from './context.js';
import { restoreConfiguration, deleteScenarioData } from './cleanup.js';
import { configureDeterministicPricing } from './configuration.js';
import {
  registerScenarioUsers,
  verifyAccountAdministration,
  verifySessionLifecycle,
} from './accounts.js';
import { createAndAuthorizeBooking, advanceBookingToInProgress } from './booking.js';
import {
  completeRecordedTrips,
  createFinalQuoteAndClose,
  runVehicleInspection,
  verifyQuoteSnapshots,
} from './fulfillment.js';
import { verifySettingsRules } from './settings.js';

export async function runIntegrationScenario() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const context = createIntegrationContext(url);
  let original: Awaited<ReturnType<typeof captureOriginalConfiguration>> | undefined;
  const routeIds: string[] = [];
  let scenarioError: unknown;

  try {
    original = await captureOriginalConfiguration(context.db);
    await configureDeterministicPricing(context);
    const users = await registerScenarioUsers(context);
    assert.equal(users.userIds.length, 4);

    const route = await context.clients.first
      .post('/api/maps/route')
      .set(integrationHeader)
      .send({ from: [14.69, -17.44], to: [14.73, -17.48] });
    if (typeof route.body.id === 'string') routeIds.push(route.body.id);
    assert.equal(route.status, 200, JSON.stringify(route.body));

    const booking = await createAndAuthorizeBooking(context, route.body.id);
    const input = booking.input as Record<string, unknown>;
    await advanceBookingToInProgress(
      context,
      booking.bookingId,
      booking.collisionId,
      booking.assigned,
    );
    await runVehicleInspection(context);
    const driverFinished = await completeRecordedTrips(context, booking.bookingId);
    const finalQuote = await createFinalQuoteAndClose(
      context,
      booking.bookingId,
      driverFinished.version,
    );
    await verifyQuoteSnapshots(
      context,
      booking.bookingId,
      finalQuote.quotes[0].id,
      finalQuote.version,
    );
    await verifyAccountAdministration(context, users.userIds);
    await verifySettingsRules(context, input);
    await verifySessionLifecycle(context);
  } catch (error) {
    scenarioError = error;
  }

  const cleanupErrors: unknown[] = [];
  try {
    if (original) await restoreConfiguration(context, original);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await deleteScenarioData(context, routeIds);
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await context.db.$disconnect();
  } catch (error) {
    cleanupErrors.push(error);
  }

  const failures = [...(scenarioError ? [scenarioError] : []), ...cleanupErrors];
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, 'Le scénario ou son nettoyage a échoué.');
}
