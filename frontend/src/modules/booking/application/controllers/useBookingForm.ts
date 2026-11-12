import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { messages } from '../../../shared/content/fr';
import { tierLabels, referenceTierLabels } from '../../../shared/application/presentation/format';
import type { Booking, BookingInput, Options, Price, Quote } from '../../../shared/domain/model';
import { inventoryNote } from '../../../moving/domain/inventory/inventory';
import { type TollExtraLine } from '../../../moving/domain/tolls/toll-selection';
import { useApp } from '../../../shared/application/context';
import { errorMessage } from '../../../shared/application/error-message';
import { administrationQuoteForBooking, routes } from '../../../shared/navigation/config/routes';
import type { RentalKitItem } from '../../../shared/domain/model';
import { type BookingField, type BookingFieldErrors } from '../../domain/booking-validation';
import { blankDraft } from '../booking-draft';
import { useBookingDraft } from '../booking-draft-context';
import { buildBookingSubmission } from '../services/booking-submission';
import type { AdministrativeQuoteSubmissionBuilder } from '../contracts/admin-quote-submission';
import {
  createBookingQuotePreview,
  quoteTierForDistance,
  type BookingQuoteConfig,
} from '../services/booking-quote-preview';
import {
  administrativeQuestionnaireAnswers,
  bookingFieldErrorsFromApiMessage,
  bookingNotesLengthError,
  canRecognizeBookingClient,
  changeOptionCount,
  clientBookingHistory,
  composeBookingNotes,
  normalizedBookingRecognitionPhone,
  adjustBookingDraftToCatalogue,
  repriceTollLines,
  selectedBookingVehicle,
  validateBookingForm,
} from '../services/booking-form-policy';
import {
  administrativeBookingEditLocked,
  bookingDraftFromExisting,
  bookingEditAccessError,
  bookingEditStatusError,
} from '../services/booking-edit-policy';
export function useBookingForm({
  mode = 'booking',
  quoteConfig,
  quoteKind,
  onQuoteSaved,
  onAdministrativeBookingCreated,
  getRentalKit,
  buildAdministrativeQuoteSubmission,
}: {
  mode?: 'booking' | 'admin-quote';
  quoteConfig?: BookingQuoteConfig;
  quoteKind?: Quote['kind'];
  onQuoteSaved?: (booking: Booking) => Promise<string | void> | string | void;
  onAdministrativeBookingCreated?: () => void;
  getRentalKit?: () => RentalKitItem[];
  buildAdministrativeQuoteSubmission?: AdministrativeQuoteSubmissionBuilder;
} = {}) {
  const { catalogue, tollPoints, loading, error, reload, api, user, authLoading } = useApp();
  const { draft, setDraft } = useBookingDraft();
  const navigate = useNavigate();
  const location = useLocation();
  const editId = new URLSearchParams(location.search).get('modifier');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const [editLoading, setEditLoading] = useState(Boolean(editId));
  const [editError, setEditError] = useState('');
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
  const pricingSettings = editingBooking?.pricingSettings ?? catalogue?.settings;
  const tiers = tierLabels(pricingSettings?.distanceBounds);
  const bounds = pricingSettings?.distanceBounds ?? [15, 25, 35];
  const distance = draft.distanceKmOverride ?? draft.route?.distanceKm;
  const quoteTier = quoteTierForDistance(distance, bounds);
  const catalogueVehicle = catalogue?.vehicles.find((v) => v.id === draft.vehicleId);
  const selected = selectedBookingVehicle(catalogueVehicle, editingBooking);
  const administrativeQuote = mode === 'admin-quote' && user?.role === 'admin';
  useEffect(() => {
    if (!editId) {
      setEditingBooking(null);
      setEditLoading(false);
      setEditError('');
      return;
    }
    const accessError = bookingEditAccessError(user, administrativeQuote, authLoading);
    if (accessError) {
      setEditError(accessError);
      setEditLoading(false);
      return;
    }
    if (!user) return;
    let active = true;
    setEditLoading(true);
    setEditError('');
    void api
      .booking(editId)
      .then(async (booking) => {
        const statusError = bookingEditStatusError(booking, administrativeQuote);
        if (statusError) throw new Error(statusError);
        const route = await api.route(booking.from, booking.to);
        if (!active) return;
        setDraft(bookingDraftFromExisting(booking, route, administrativeQuote));
        setEditingBooking(booking);
      })
      .catch((cause: unknown) => {
        if (active) setEditError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setEditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [administrativeQuote, api, authLoading, editId, setDraft, user]);
  useEffect(() => {
    setTollLines((current) => repriceTollLines(current, tollPoints, draft.vehicleId));
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
    const routeExpiresAt = Date.parse(draft.route.expiresAt);
    if (!Number.isFinite(routeExpiresAt) || routeExpiresAt <= Date.now() + 30_000) {
      const staleRouteId = draft.route.id;
      let active = true;
      setEstimating(true);
      void api
        .route(draft.route.from, draft.route.to)
        .then((freshRoute) => {
          if (!active) return;
          setDraft((current) =>
            current.route?.id === staleRouteId ? { ...current, route: freshRoute } : current,
          );
        })
        .catch((cause: unknown) => {
          if (active) setEstimateError(errorMessage(cause));
        })
        .finally(() => {
          if (active) setEstimating(false);
        });
      return () => {
        active = false;
      };
    }
    const controller = new AbortController();
    setEstimating(true);
    api
      .estimate(
        draft.vehicleId,
        draft.route.id,
        draft.options,
        controller.signal,
        {
          fromFloor: draft.inventory.fromFloor,
          toFloor: draft.inventory.toFloor,
          fromLift: draft.inventory.fromLift,
          toLift: draft.inventory.toLift,
        },
        administrativeQuote ? (quoteConfig?.trips ?? 1) : draft.estimatedTrips,
        draft.distanceKmOverride,
        draft.noDate || !draft.date ? null : draft.date,
        administrativeQuote,
      )
      .then(setPrice)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (
          e instanceof Error &&
          e.message === messages.recalculAutomatiqueTrajetExpire &&
          draft.route
        ) {
          const expiredRouteId = draft.route.id;
          void api
            .route(draft.route.from, draft.route.to)
            .then((freshRoute) => {
              if (controller.signal.aborted) return;
              setDraft((current) =>
                current.route?.id === expiredRouteId ? { ...current, route: freshRoute } : current,
              );
            })
            .catch((routeError: unknown) => {
              if (!controller.signal.aborted) setEstimateError(errorMessage(routeError));
            });
          return;
        }
        setEstimateError(errorMessage(e));
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
    draft.distanceKmOverride,
    draft.date,
    draft.noDate,
    draft.vehicleId,
    draft.options,
    quoteConfig?.trips,
    draft.estimatedTrips,
    setDraft,
  ]);
  useEffect(() => {
    if (!catalogue) return;
    setDraft((current) =>
      adjustBookingDraftToCatalogue(current, catalogue, {
        mode,
        editingVehicleId: editingBooking?.vehicle.id,
      }),
    );
  }, [catalogue, editingBooking, mode, setDraft]);
  useEffect(() => {
    const phone = normalizedBookingRecognitionPhone(draft.customerPhone);
    lookupPhone.current = phone;
    setClientRecognition((current) => (current?.phone === phone ? current : null));
    if (autofilledName.current && autofilledName.current.phone !== phone) {
      const previousName = autofilledName.current.name;
      autofilledName.current = null;
      setDraft((current) =>
        current.customerName === previousName ? { ...current, customerName: '' } : current,
      );
    }
    if (!canRecognizeBookingClient(draft.customerPhone, Boolean(user))) {
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
    const normalizedPhone = normalizedBookingRecognitionPhone(phone);
    if (!canRecognizeBookingClient(phone, Boolean(user))) {
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
      const recognition = clientBookingHistory(bookings, normalizedPhone);
      if (!recognition) return;
      setClientRecognition(recognition);
      setDraft((current) => {
        if (normalizedBookingRecognitionPhone(current.customerPhone) !== normalizedPhone)
          return current;
        autofilledName.current = { phone: normalizedPhone, name: recognition.name };
        return current.customerName === recognition.name
          ? current
          : { ...current, customerName: recognition.name };
      });
    } catch {
      // La reconnaissance reste indicative et ne doit pas bloquer la réservation.
      bookingLookup.current = null;
    } finally {
      if (lookupPhone.current === normalizedPhone) setRecognizingClient(false);
    }
  }
  function validatePublicFields(scope: 'schedule' | 'contact' | 'all') {
    const errors = validateBookingForm({
      draft,
      scope,
      administrativeQuote,
      settings: catalogue?.settings,
      allowExistingSlot: Boolean(editingBooking && editingBooking.timeSlot === draft.timeSlot),
    });
    setFieldErrors(errors);
    return errors;
  }
  function clearFieldError(field: BookingField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }
  async function submit(
    e: React.FormEvent,
    quoteWorkSummary = '',
    workPlan: NonNullable<BookingInput['workPlan']> = [],
    inventorySnapshot?: BookingInput['inventorySnapshot'],
    quoteOptions?: Options,
    quoteExtraLines: Array<{ label: string; quantity: number; unitPrice: number }> = [],
  ) {
    e.preventDefault();
    if (submitLock.current) return;
    if (administrativeQuote && editingBooking && administrativeBookingEditLocked(editingBooking)) {
      setSubmitError('Cette réservation est clôturée et ne peut plus être modifiée.');
      return;
    }
    setSubmitError('');
    if (Object.keys(validatePublicFields('all')).length > 0) return;
    if (!draft.route || !price) {
      setSubmitError(messages.calculezLeTrajetPourObtenirUneEstimation);
      return;
    }
    const activeQuestions = catalogue?.settings.questionnaire ?? [];
    if (!user) {
      navigate(`${routes.login}?retour=reservation`);
      return;
    }
    const bookingNotes = composeBookingNotes({
      inventoryNote: !inventorySnapshot && !editingBooking ? inventoryNote(draft.inventory) : '',
      administrativeQuote,
      fromNote: draft.fromNote,
      toNote: draft.toNote,
      workSummary: quoteWorkSummary,
      notes: draft.notes,
    });
    const notesError = bookingNotesLengthError(bookingNotes, administrativeQuote);
    if (notesError) {
      setSubmitError(notesError);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const input = buildBookingSubmission({
        draft,
        routeId: draft.route.id,
        administrativeQuote,
        quoteTrips: quoteConfig?.trips ?? 1,
        options: administrativeQuote ? quoteOptions : undefined,
        notes: bookingNotes,
        questionnaireAnswers: administrativeQuote
          ? administrativeQuestionnaireAnswers(activeQuestions, draft.questionnaireAnswers)
          : [],
        workPlan,
        inventorySnapshot,
      });
      const booking = editingBooking
        ? administrativeQuote
          ? await api.updateAdminBooking(editingBooking.id, input, editingBooking.version)
          : await api.updateClientBooking(editingBooking.id, input, editingBooking.version)
        : await api.createBooking(input);
      if (administrativeQuote) onAdministrativeBookingCreated?.();
      bookingLookup.current = null;
      if (editingBooking && !administrativeQuote) {
        setDraft(blankDraft());
        navigate(routes.account);
        return;
      }
      if (administrativeQuote) {
        try {
          if (!buildAdministrativeQuoteSubmission)
            throw new Error('Le service de création du devis administratif est indisponible.');
          const quoteInput = buildAdministrativeQuoteSubmission({
            draft,
            kind: quoteKind ?? 'provisional',
            config: quoteConfig,
            catalogue: catalogue ?? null,
            fallbackVehicle: booking.vehicle,
            tier: quoteTier,
            version: booking.version,
            notes: bookingNotes,
            extraLines: quoteExtraLines,
            tollLines,
            options: quoteOptions,
            getRentalKit,
          });
          const savedQuoteBooking = await api.quote(booking.id, quoteInput);
          let successMessage: string | void;
          try {
            successMessage = await onQuoteSaved?.(savedQuoteBooking);
          } catch {
            successMessage = undefined;
          }
          setDraft(blankDraft());
          navigate(`${routes.administrationBookings}?q=${encodeURIComponent(booking.reference)}`, {
            state: {
              successMessage: successMessage ?? `Devis ${booking.reference} enregistré.`,
            },
          });
        } catch (reason) {
          navigate(administrationQuoteForBooking(booking.id), {
            state: {
              initialTollLines: tollLines,
              quoteError: `${editingBooking ? 'Réservation mise à jour' : 'Réservation créée'}, mais le devis n’a pas été enregistré : ${errorMessage(reason)}`,
            },
          });
        }
        return;
      }
      setDraft(blankDraft());
      setDone(booking);
      document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      const message = errorMessage(e);
      if (administrativeQuote) {
        setSubmitError(message);
      } else {
        const fieldErrors = bookingFieldErrorsFromApiMessage(message);
        if (fieldErrors) setFieldErrors((current) => ({ ...current, ...fieldErrors }));
        else setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  }
  function option(key: keyof Options, delta: number) {
    setDraft((draft) => ({
      ...draft,
      options: changeOptionCount(draft.options, key, delta, pricingSettings?.maxOptions ?? 0),
    }));
  }
  const extras: [keyof Options, string, string][] = [
    ['labour', messages.manUvres, messages.chargementEtDechargement],
    ['desk', messages.montageDemontageDeBureau, messages.unMenuisierPourVosMeubles],
    ['wardrobe', messages.montageDemontageDArmoire, messages.demontageEtRemontageSurPlace],
    ['bed', messages.montageDemontageDeLit, messages.litDeuxPlaces],
  ];
  const quotePreviewPrice = createBookingQuotePreview({
    price,
    config: quoteConfig,
    tier: quoteTier,
    tierLabel: referenceTierLabels(bounds)[quoteTier],
    trips: quoteConfig?.trips ?? 1,
    selected,
    hasRoute: Boolean(draft.route),
  });
  return {
    catalogue,
    loading,
    error,
    reload,
    user,
    draft,
    setDraft,
    price: quotePreviewPrice,
    estimating,
    estimateError,
    submitError,
    submitting,
    fieldErrors,
    validateSchedule: () => Object.keys(validatePublicFields('schedule')).length === 0,
    clearFieldError,
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
    editingBooking,
    setEditingBooking,
    editLoading,
    editError,
    recognizeClient,
  };
}
