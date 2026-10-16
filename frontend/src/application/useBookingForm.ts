import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tierLabels } from '../domain/format';
import type { Booking, Options, Price } from '../domain/model';
import { blankDraft, useApp } from './context';
export function useBookingForm() {
  const { catalogue, loading, error, reload, api, user, draft, setDraft } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [price, setPrice] = useState<Price | null>(null),
    [estimating, setEstimating] = useState(false),
    [estimateError, setEstimateError] = useState(''),
    [submitError, setSubmitError] = useState(''),
    [submitting, setSubmitting] = useState(false),
    [done, setDone] = useState<Booking | null>(null);
  const submitLock = useRef(false);
  const tiers = tierLabels(catalogue?.settings.distanceBounds);
  const selected = catalogue?.vehicles.find((v) => v.id === draft.vehicleId);
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
      .catch((e) => {
        if (!controller.signal.aborted) setEstimateError(e.message);
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
        slots?.length && !slots.includes(current.timeSlot) ? slots[0] : current.timeSlot;
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
      setSubmitError('Calculez le trajet pour obtenir une estimation.');
      return;
    }
    if (!user) {
      navigate('/connexion?retour=reservation');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const booking = await api.createBooking({
        vehicleId: draft.vehicleId,
        routeId: draft.route.id,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        date: draft.date,
        timeSlot: draft.timeSlot,
        options: draft.options,
        notes: draft.notes,
        requestId: draft.requestId,
      });
      setDone(booking);
      setDraft(blankDraft());
      document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setSubmitError((e as Error).message);
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
        [key]: Math.max(0, Math.min(catalogue?.settings.maxOptions ?? 20, d.options[key] + delta)),
      },
    }));
  }
  const extras: [keyof Options, string, string][] = [
    ['labour', 'Manœuvres', 'Chargement et déchargement'],
    ['desk', 'Montage / démontage de bureau', 'Un menuisier pour vos meubles'],
    ['wardrobe', 'Montage / démontage d’armoire', 'Démontage et remontage sur place'],
    ['bed', 'Montage / démontage de lit', 'Lit deux places'],
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
  };
}
export type BookingFormState = ReturnType<typeof useBookingForm>;
