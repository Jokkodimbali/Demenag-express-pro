import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { messages } from '../content/fr';
import { tierLabels } from '../domain/format';
import type {
  Booking,
  BookingInput,
  BookingInventorySnapshot,
  Options,
  Price,
} from '../domain/model';
import { inventoryNote } from '../domain/inventory';
import { tollPrice } from '../domain/toll-prices';
import { normalizedClientPhone } from './services/client-summary';
import { blankDraft, useApp } from './context';
import { errorMessage } from './error-message';
import { routes } from '../routing/routes';
import { clearAdminQuoteDraft } from './admin-quote-draft-storage';
type TollExtraLine = { id: string; label: string; quantity: number; unitPrice: number };
export type AdminQuoteConfig = { trips: number; discount: number; customPrice: number | null };
export function useBookingForm({
  mode = 'booking',
  quoteConfig,
}: { mode?: 'booking' | 'admin-quote'; quoteConfig?: AdminQuoteConfig } = {}) {
  const { catalogue, tollPoints, loading, error, reload, api, user, draft, setDraft } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [tollLines, setTollLines] = useState<TollExtraLine[]>([]);
  const [price, setPrice] = useState<Price | null>(null),
    [estimating, setEstimating] = useState(false),
    [estimateError, setEstimateError] = useState(''),
    [submitError, setSubmitError] = useState(''),
    [submitting, setSubmitting] = useState(false),
    [done, setDone] = useState<Booking | null>(null),
    [clientRecognition, setClientRecognition] = useState<{
      phone: string;
      name: string;
      bookingCount: number;
    } | null>(null),
    [recognizingClient, setRecognizingClient] = useState(false);
  const submitLock = useRef(false);
  const bookingLookup = useRef<Promise<Booking[]> | null>(null);
  const lookupPhone = useRef('');
  const autofilledName = useRef<{ phone: string; name: string } | null>(null);
  const adminQuoteInitialized = useRef(false);
  const tiers = tierLabels(catalogue?.settings.distanceBounds);
  const selected = catalogue?.vehicles.find((v) => v.id === draft.vehicleId);
  const administrativeQuote = mode === 'admin-quote' && user?.role === 'admin';
  useEffect(() => {
    setTollLines((current) => {
      let changed = false;
      const next = current.map((line) => {
        const point = tollPoints.find((item) => {
          return line.id === item.id;
        });
        if (!point) return line;
        const unitPrice = tollPrice(point, draft.vehicleId);
        if (line.unitPrice === unitPrice) return line;
        changed = true;
        return { ...line, unitPrice };
      });
      return changed ? next : current;
    });
  }, [draft.vehicleId, tollPoints]);
  useEffect(() => {
    if (!administrativeQuote || adminQuoteInitialized.current) return;
    adminQuoteInitialized.current = true;
    setDraft(blankDraft(catalogue ?? undefined));
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
      .estimate(
        draft.vehicleId,
        draft.route.id,
        draft.options,
        controller.signal,
        administrativeQuote
          ? {
              fromFloor: draft.inventory.fromFloor,
              toFloor: draft.inventory.toFloor,
              fromLift: draft.inventory.fromLift,
              toLift: draft.inventory.toLift,
            }
          : undefined,
      )
      .then(setPrice)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setEstimateError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setEstimating(false);
      });
    return () => controller.abort();
  }, [
    api,
    administrativeQuote,
    draft.inventory.fromFloor,
    draft.inventory.toFloor,
    draft.inventory.fromLift,
    draft.inventory.toLift,
    draft.route,
    draft.vehicleId,
    draft.options,
  ]);
  useEffect(() => {
    if (!catalogue) return;
    setDraft((current) => {
      const vehicleId = catalogue.vehicles.some(
        (v) => v.id === current.vehicleId && v.active !== false,
      )
        ? current.vehicleId
        : (catalogue.vehicles.find((v) => v.active !== false)?.id ?? current.vehicleId);
      return vehicleId === current.vehicleId ? current : { ...current, vehicleId };
    });
  }, [catalogue, setDraft]);
  useEffect(() => {
    const phone = normalizedClientPhone(draft.customerPhone);
    lookupPhone.current = phone;
    setClientRecognition((current) => (current?.phone === phone ? current : null));
    if (autofilledName.current && autofilledName.current.phone !== phone) {
      const previousName = autofilledName.current.name;
      autofilledName.current = null;
      setDraft((current) =>
        current.customerName === previousName ? { ...current, customerName: '' } : current,
      );
    }
    if (!/^\d{9}$/.test(phone) || !user) {
      setRecognizingClient(false);
      return;
    }
    if (clientRecognition?.phone === phone) return;
    const timer = window.setTimeout(() => void recognizeClient(draft.customerPhone), 300);
    return () => window.clearTimeout(timer);
    // Le changement de nom n'a pas à relancer la recherche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.customerPhone, user?.id]);
  async function recognizeClient(phone: string) {
    const normalizedPhone = normalizedClientPhone(phone);
    if (!/^\d{9}$/.test(normalizedPhone) || !user) {
      setClientRecognition(null);
      return;
    }
    lookupPhone.current = normalizedPhone;
    setRecognizingClient(true);
    setClientRecognition(null);
    try {
      bookingLookup.current ??= api.bookings();
      const bookings = await bookingLookup.current;
      if (lookupPhone.current !== normalizedPhone) return;
      const previousBookings = bookings.filter(
        (booking) => normalizedClientPhone(booking.phone) === normalizedPhone,
      );
      if (!previousBookings.length) return;
      const latestBooking = previousBookings.reduce((latest, booking) =>
        booking.createdAt > latest.createdAt ? booking : latest,
      );
      setClientRecognition({
        phone: normalizedPhone,
        name: latestBooking.customerName,
        bookingCount: previousBookings.length,
      });
      setDraft((current) => {
        if (normalizedClientPhone(current.customerPhone) !== normalizedPhone) return current;
        autofilledName.current = { phone: normalizedPhone, name: latestBooking.customerName };
        return current.customerName === latestBooking.customerName
          ? current
          : { ...current, customerName: latestBooking.customerName };
      });
    } catch {
      // La reconnaissance reste indicative et ne doit pas bloquer la réservation.
      bookingLookup.current = null;
    } finally {
      if (lookupPhone.current === normalizedPhone) setRecognizingClient(false);
    }
  }
  async function submit(
    e: React.FormEvent,
    quoteWorkSummary = '',
    workPlan: NonNullable<BookingInput['workPlan']> = [],
    inventorySnapshot?: BookingInventorySnapshot,
    quoteOptions?: Options,
  ) {
    e.preventDefault();
    if (submitLock.current) return;
    setSubmitError('');
    if (!draft.route || !price) {
      setSubmitError(messages.calculezLeTrajetPourObtenirUneEstimation);
      return;
    }
    const activeQuestions = catalogue?.settings.questionnaire ?? [];
    if (!user) {
      navigate(`${routes.login}?retour=reservation`);
      return;
    }
    const bookingNotes = [
      administrativeQuote && !inventorySnapshot ? inventoryNote(draft.inventory) : '',
      administrativeQuote && draft.fromNote.trim()
        ? `Repère départ : ${draft.fromNote.trim()}`
        : '',
      administrativeQuote && draft.toNote.trim() ? `Repère arrivée : ${draft.toNote.trim()}` : '',
      administrativeQuote ? quoteWorkSummary : '',
      draft.notes,
    ]
      .filter(Boolean)
      .join('\n\n');
    if (bookingNotes.length > 2000) {
      setSubmitError(
        'La fiche d’appel et les précisions dépassent 2 000 caractères. Réduisez les précisions avant l’envoi.',
      );
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
        timeSlot: draft.date ? draft.timeSlot : '',
        options: administrativeQuote && quoteOptions ? quoteOptions : draft.options,
        workAccess: administrativeQuote
          ? {
              fromFloor: draft.inventory.fromFloor,
              toFloor: draft.inventory.toFloor,
              fromLift: draft.inventory.fromLift,
              toLift: draft.inventory.toLift,
            }
          : undefined,
        notes: bookingNotes,
        questionnaireAnswers: administrativeQuote
          ? [
              ...activeQuestions
                .filter(
                  (question) =>
                    question.active &&
                    draft.questionnaireAnswers[question.id]?.trim() &&
                    draft.questionnaireAnswers[question.id].trim() !== 'À poser',
                )
                .map((question) => ({
                  questionId: question.id,
                  group: question.group,
                  question: question.label,
                  answer: draft.questionnaireAnswers[question.id].trim(),
                })),
              ...[
                ['key-ready', 'Le matériel sera-t-il prêt à être chargé ?'],
                ['key-stairs', 'Tout le matériel passe-t-il dans les escaliers ?'],
              ]
                .filter(([id]) => draft.questionnaireAnswers[id]?.trim())
                .map(([questionId, question]) => ({
                  questionId,
                  group: 'Questions clés',
                  question,
                  answer: draft.questionnaireAnswers[questionId].trim(),
                })),
            ]
          : [],
        workPlan: administrativeQuote ? workPlan : [],
        inventorySnapshot: administrativeQuote ? inventorySnapshot : undefined,
        requestId: draft.requestId,
      });
      if (administrativeQuote) clearAdminQuoteDraft();
      bookingLookup.current = null;
      setDraft(blankDraft());
      if (administrativeQuote) {
        try {
          await api.quote(booking.id, {
            kind: 'provisional',
            trips: quoteConfig?.trips ?? 1,
            customPrice: price.tier === 3 ? (quoteConfig?.customPrice ?? null) : null,
            discount: quoteConfig?.discount ?? 0,
            notes: bookingNotes,
            extraLines: tollLines.map(({ label, quantity, unitPrice }) => ({
              label,
              quantity,
              unitPrice,
            })),
            options: administrativeQuote && quoteOptions ? quoteOptions : draft.options,
            version: booking.version,
          });
          navigate(`${routes.administrationBookings}?q=${booking.reference}&detail=${booking.id}`);
        } catch (reason) {
          navigate(
            `${routes.administrationBookings}?q=${booking.reference}&detail=${booking.id}&edit=quote`,
            {
              state: {
                initialTollLines: tollLines,
                quoteError: `Réservation créée, mais le devis n’a pas été enregistré : ${errorMessage(reason)}`,
              },
            },
          );
        }
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
  const tollTotal = tollLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const transport = price?.lines[0];
  const trips = quoteConfig?.trips ?? 1;
  const transportUnit =
    price?.tier === 3 ? (quoteConfig?.customPrice ?? 0) : (transport?.unitPrice ?? 0);
  const quoteLines =
    price?.tier === 3 && quoteConfig?.customPrice
      ? [
          {
            label: `Transport ${selected?.name ?? ''} · aller-retour`,
            quantity: trips,
            unitPrice: quoteConfig.customPrice,
            total: quoteConfig.customPrice * trips,
          },
          ...price.lines,
        ]
      : (price?.lines.map((line, index) =>
          index === 0 && quoteConfig
            ? { ...line, quantity: trips, unitPrice: transportUnit, total: transportUnit * trips }
            : line,
        ) ?? []);
  const baseTotal =
    price?.total === null && (price.tier !== 3 || quoteConfig?.customPrice == null)
      ? null
      : quoteLines.reduce((sum, line) => sum + line.total, 0);
  const subtotal = baseTotal === null ? null : baseTotal + tollTotal;
  const priceWithTolls = price
    ? {
        ...price,
        lines: [
          ...quoteLines,
          ...tollLines.map((line) => ({
            label: line.label,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.quantity * line.unitPrice,
          })),
        ],
        total:
          subtotal === null || (quoteConfig?.discount ?? 0) > subtotal
            ? null
            : subtotal - (quoteConfig?.discount ?? 0),
        discount: quoteConfig?.discount ?? 0,
        trips,
      }
    : null;
  return {
    catalogue,
    loading,
    error,
    reload,
    user,
    draft,
    setDraft,
    price: priceWithTolls,
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
    tollLines,
    setTollLines,
    clientRecognition,
    recognizingClient,
    recognizeClient,
  };
}
