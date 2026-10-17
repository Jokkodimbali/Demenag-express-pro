import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { messages } from '../content/fr';
import { tierLabels } from '../domain/format';
import type { Booking, Options, Price } from '../domain/model';
import { blankDraft, useApp } from './context';
import { errorMessage } from './error-message';
import { routes } from '../routing/routes';
export function useBookingForm() {
  const { catalogue, loading, error, reload, api, user, draft, setDraft } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [price, setPrice] = useState<Price | null>(null),
    [estimating, setEstimating] = useState(false),
    [estimateError, setEstimateError] = useState(''),
    [submitError, setSubmitError] = useState(''),
    [submitting, setSubmitting] = useState(false),
    [done, setDone] = useState<Booking | null>(null);
  const submitLock = useRef(false);
  const tiers = tierLabels(catalogue?.settings.distanceBounds);
  const selected = catalogue?.vehicles.find((v) => v.id === draft.vehicleId);
  const administrativeQuote = user?.role === 'admin' && params.get('newQuote') === '1';
  useEffect(() => {
    if (administrativeQuote) setDraft(blankDraft(catalogue ?? undefined));
  }, [administrativeQuote, catalogue, setDraft]);
  useEffect(() => {
    if (location.hash === '#reserver' && !loading)
      document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth' });
  }, [location, loading]);
  useEffect(() => {
    setPrice(null);
    setEstimateError('');
    if (!draft.route) {
      setEstimating(false);
      return;
    }
    const controller = new AbortController();
    setEstimating(true);
    api
      .estimate(draft.vehicleId, draft.route.id, draft.options, controller.signal)
      .then(setPrice)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setEstimateError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setEstimating(false);
      });
    return () => controller.abort();
  }, [api, draft.route, draft.vehicleId, draft.options]);
  useEffect(() => {
    if (!catalogue) return;
    setDraft((current) => {
      const vehicleId = catalogue.vehicles.some(
        (v) => v.id === current.vehicleId && v.active !== false,
      )
        ? current.vehicleId
        : (catalogue.vehicles.find((v) => v.active !== false)?.id ?? current.vehicleId);
      const slots = catalogue.settings.enabledSlots;
      const timeSlot =
        slots.length && !slots.some((slot) => slot.label === current.timeSlot)
          ? slots[0].label
          : current.timeSlot;
      return vehicleId === current.vehicleId && timeSlot === current.timeSlot
        ? current
        : { ...current, vehicleId, timeSlot };
    });
  }, [catalogue, setDraft]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    setSubmitError('');
    if (!draft.route || !price) {
      setSubmitError(messages.calculezLeTrajetPourObtenirUneEstimation);
      return;
    }
    if (!user) {
      navigate(`${routes.login}?retour=reservation`);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const booking = await api.createBooking({
        vehicleId: draft.vehicleId,
        routeId: draft.route.id,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        date: draft.date,
        timeSlot: draft.timeSlot,
        options: draft.options,
        notes: draft.notes,
        requestId: draft.requestId,
      });
      setDraft(blankDraft());
      if (administrativeQuote) {
        navigate(
          `${routes.administrationBookings}?q=${booking.reference}&detail=${booking.id}&edit=quote`,
        );
        return;
      }
      setDone(booking);
      document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  }
  function option(key: keyof Options, delta: number) {
    setDraft((d) => ({
      ...d,
      options: {
        ...d.options,
        [key]: Math.max(0, Math.min(catalogue?.settings.maxOptions ?? 0, d.options[key] + delta)),
      },
    }));
  }
  const extras: [keyof Options, string, string][] = [
    ['labour', messages.manUvres, messages.chargementEtDechargement],
    ['desk', messages.montageDemontageDeBureau, messages.unMenuisierPourVosMeubles],
    ['wardrobe', messages.montageDemontageDArmoire, messages.demontageEtRemontageSurPlace],
    ['bed', messages.montageDemontageDeLit, messages.litDeuxPlaces],
  ];
  return {
    catalogue,
    loading,
    error,
    reload,
    user,
    draft,
    setDraft,
    price,
    estimating,
    estimateError,
    submitError,
    submitting,
    done,
    setDone,
    tiers,
    selected,
    submit,
    option,
    extras,
    administrativeQuote,
  };
}
