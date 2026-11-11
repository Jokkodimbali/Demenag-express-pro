import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { messages } from '../../../shared/content/fr';
import { referenceTierLabels, tierLabels } from '../../../shared/application/presentation/format';
import type { Booking, BookingInput, Options, Price, Quote } from '../../../shared/domain/model';
import { inventoryNote } from '../../../moving/domain/inventory/inventory';
import { tollPrice } from '../../../moving/domain/tolls/toll-prices';
import { quoteTollsFromLines, type TollExtraLine } from '../../../moving/domain/tolls/toll-selection';
import { normalizedClientPhone } from '../../../shared/domain/client-identity';
import { useApp } from '../../../shared/application/context';
import { errorMessage } from '../../../shared/application/error-message';
import { administrationQuoteForBooking, routes } from '../../../shared/navigation/config/routes';
import type { RentalKitItem } from '../../../shared/domain/model';
import { defaultRentalKit } from '../../../moving/domain/rental-kit';
import {
  bookingDateError,
  bookingTimeError,
  type BookingField,
  type BookingFieldErrors,
} from '../../domain/booking-validation';
import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import { blankDraft } from '../booking-draft';
import { useBookingDraft } from '../booking-draft-context';
export type AdminQuoteConfig = {
  trips: number;
  discount: number;
  discountType: 'fcfa' | 'pct';
  discountReason: string;
  customPrice: number | null;
  labourUnitPriceOverride?: number | null;
  billingMode?: 'complete' | 'standard' | 'driver-rental';
  menuIncluded?: boolean;
  overtimeMinutes?: number;
  rentalKit?: RentalKitItem[] | null;
};
export function useBookingForm({
  mode = 'booking',
  quoteConfig,
  quoteKind,
  onQuoteSaved,
  onAdministrativeBookingCreated,
  getRentalKit,
}: {
  mode?: 'booking' | 'admin-quote';
  quoteConfig?: AdminQuoteConfig;
  quoteKind?: Quote['kind'];
  onQuoteSaved?: (booking: Booking) => void;
  onAdministrativeBookingCreated?: () => void;
  getRentalKit?: () => RentalKitItem[];
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
  const quoteTier =
    distance == null
      ? 0
      : distance < bounds[0]
        ? 0
        : distance <= bounds[1]
          ? 1
          : distance <= bounds[2]
            ? 2
            : 3;
  const catalogueVehicle = catalogue?.vehicles.find((v) => v.id === draft.vehicleId);
  const selected = catalogueVehicle
    ? {
        ...catalogueVehicle,
        prices:
          editingBooking?.pricingSnapshot?.vehiclePrices[catalogueVehicle.id] ??
          (editingBooking?.vehicle.id === catalogueVehicle.id
            ? editingBooking.vehicle.prices
            : catalogueVehicle.prices),
      }
    : undefined;
  const administrativeQuote = mode === 'admin-quote' && user?.role === 'admin';
  useEffect(() => {
    if (!editId) {
      setEditingBooking(null);
      setEditLoading(false);
      setEditError('');
      return;
    }
    if (!user) {
      if (!authLoading) {
        setEditError('Connectez-vous à votre compte client pour modifier cette demande.');
        setEditLoading(false);
      }
      return;
    }
    if (user.role !== 'client' && !(administrativeQuote && user.role === 'admin')) {
      setEditError('Cette demande ne peut être modifiée que depuis un compte autorisé.');
      setEditLoading(false);
      return;
    }
    let active = true;
    setEditLoading(true);
    setEditError('');
    void api
      .booking(editId)
      .then(async (booking) => {
        if (!administrativeQuote && !['pending', 'confirmed', 'cancelled'].includes(booking.status))
          throw new Error('Cette réservation ne peut plus être modifiée.');
        if (!administrativeQuote && booking.quotes.some((quote) => quote.kind === 'final'))
          throw new Error('Cette réservation ne peut plus être modifiée.');
        const route = await api.route(booking.from, booking.to);
        if (!active) return;
        const base = blankDraft();
        const workAccess = booking.workAccess;
        setDraft({
          ...base,
          vehicleId: booking.vehicle.id,
          customerName: booking.customerName,
          customerPhone: booking.phone,
          source: booking.source ?? '',
          fromAddress: booking.fromAddress,
          toAddress: booking.toAddress,
          from: booking.from,
          to: booking.to,
          route,
          distanceKmOverride:
            administrativeQuote && Math.abs(booking.distanceKm - route.distanceKm) > 0.01
              ? booking.distanceKm
              : null,
          date: booking.date ?? '',
          noDate: !booking.date,
          month: booking.month ?? booking.date?.slice(0, 7) ?? booking.createdAt.slice(0, 7),
          timeSlot: booking.timeSlot,
          estimatedTrips: Math.max(1, booking.estimate.trips),
          options: booking.options,
          notes: booking.notes,
          questionnaireAnswers: Object.fromEntries(
            (booking.questionnaireAnswers ?? []).map((answer) => [
              answer.questionId,
              answer.answer,
            ]),
          ),
          inventory: {
            ...(booking.inventorySnapshot?.sourceInventory ?? base.inventory),
            fromFloor: workAccess?.fromFloor ?? booking.inventorySnapshot?.fromFloor ?? 0,
            toFloor: workAccess?.toFloor ?? booking.inventorySnapshot?.toFloor ?? 0,
            fromLift: workAccess?.fromLift ?? booking.inventorySnapshot?.fromLift ?? false,
            toLift: workAccess?.toLift ?? booking.inventorySnapshot?.toLift ?? false,
          },
        });
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
        {
          fromFloor: draft.inventory.fromFloor,
          toFloor: draft.inventory.toFloor,
          fromLift: draft.inventory.fromLift,
          toLift: draft.inventory.toLift,
        },
        administrativeQuote ? (quoteConfig?.trips ?? 1) : draft.estimatedTrips,
        administrativeQuote ? draft.distanceKmOverride : null,
        draft.noDate ? null : draft.date,
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
    setDraft((current) => {
      const bookingDraft =
        mode === 'booking' &&
        !editingBooking &&
        !catalogue.settings.enabledSlots.some(
          (slot) => `${String(slot.startHour).padStart(2, '0')}:00` === current.timeSlot,
        )
          ? {
              ...current,
              timeSlot: `${String(catalogue.settings.enabledSlots[0]?.startHour ?? 8).padStart(2, '0')}:00`,
            }
          : current;
      if (editingBooking?.vehicle.id === bookingDraft.vehicleId) return bookingDraft;
      const vehicleId = catalogue.vehicles.some(
        (v) => v.id === bookingDraft.vehicleId && v.active !== false,
      )
        ? bookingDraft.vehicleId
        : (catalogue.vehicles.find((v) => v.active !== false)?.id ?? bookingDraft.vehicleId);
      return vehicleId === bookingDraft.vehicleId ? bookingDraft : { ...bookingDraft, vehicleId };
    });
  }, [catalogue, editingBooking, mode, setDraft]);
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
    if (!normalizePhoneNumber(draft.customerPhone) || !user) {
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
    if (!normalizePhoneNumber(phone) || !user) {
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
  function validatePublicFields(scope: 'schedule' | 'contact' | 'all') {
    const errors: BookingFieldErrors = {};
    if (!administrativeQuote && scope !== 'contact') {
      if (catalogue) {
        const dateError = bookingDateError(draft.date, catalogue.settings);
        const timeError = bookingTimeError(
          draft.date,
          draft.timeSlot,
          catalogue.settings,
          new Date(),
          Boolean(editingBooking && editingBooking.timeSlot === draft.timeSlot),
        );
        if (dateError) errors.date = dateError;
        if (timeError) errors.timeSlot = timeError;
      } else {
        if (!draft.date) errors.date = 'Choisissez une date de déménagement.';
        if (!draft.timeSlot) errors.timeSlot = 'Choisissez un créneau horaire.';
      }
    }
    if (!administrativeQuote && scope !== 'schedule') {
      if (draft.customerName.trim().length < 2)
        errors.customerName = 'Saisissez votre nom et votre prénom (au moins 2 caractères).';
      if (!draft.customerPhone.trim())
        errors.customerPhone = 'Saisissez votre numéro de téléphone.';
      else if (!normalizePhoneNumber(draft.customerPhone))
        errors.customerPhone =
          'Format invalide. Ajoutez l’indicatif, par exemple +221 77 123 45 67 ou +33 6 12 34 56 78.';
    }
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
    if (
      administrativeQuote &&
      editingBooking &&
      (['completed', 'cancelled'].includes(editingBooking.status) ||
        editingBooking.quotes.some((quote) => quote.kind === 'final'))
    ) {
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
    const bookingNotes = [
      !inventorySnapshot && !editingBooking ? inventoryNote(draft.inventory) : '',
      administrativeQuote && draft.fromNote.trim()
        ? `Repère départ : ${draft.fromNote.trim()}`
        : '',
      administrativeQuote && draft.toNote.trim() ? `Repère arrivée : ${draft.toNote.trim()}` : '',
      administrativeQuote ? quoteWorkSummary : '',
      draft.notes,
    ]
      .filter(Boolean)
      .join(administrativeQuote ? '\n' : '\n\n');
    if (bookingNotes.length > (administrativeQuote ? 10000 : 2000)) {
      setSubmitError(
        `La fiche d’appel et les précisions dépassent ${administrativeQuote ? '10 000' : '2 000'} caractères. Réduisez les précisions avant l’envoi.`,
      );
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const input: BookingInput = {
        vehicleId: draft.vehicleId,
        routeId: draft.route.id,
        distanceKmOverride: administrativeQuote ? draft.distanceKmOverride : undefined,
        trips: administrativeQuote ? (quoteConfig?.trips ?? 1) : draft.estimatedTrips,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        source: administrativeQuote ? draft.source : undefined,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        date: draft.date,
        month: draft.date ? draft.date.slice(0, 7) : draft.month,
        timeSlot: draft.date ? draft.timeSlot : '',
        options: administrativeQuote && quoteOptions ? quoteOptions : draft.options,
        workAccess: {
          fromFloor: draft.inventory.fromFloor,
          toFloor: draft.inventory.toFloor,
          fromLift: draft.inventory.fromLift,
          toLift: draft.inventory.toLift,
        },
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
        workPlan: administrativeQuote ? workPlan : undefined,
        inventorySnapshot,
        requestId: draft.requestId,
      };
      const booking = editingBooking
        ? administrativeQuote
          ? await api.updateAdminBooking(editingBooking.id, input, editingBooking.version)
          : await api.updateClientBooking(editingBooking.id, input, editingBooking.version)
        : await api.createBooking(input);
      if (administrativeQuote) onAdministrativeBookingCreated?.();
      bookingLookup.current = null;
      setDraft(blankDraft());
      if (editingBooking && !administrativeQuote) {
        navigate(routes.account);
        return;
      }
      if (administrativeQuote) {
        try {
          const savedQuoteBooking = await api.quote(booking.id, {
            kind: quoteKind ?? 'provisional',
            trips: quoteConfig?.trips ?? 1,
            customPrice: quoteTier === 3 ? (quoteConfig?.customPrice ?? null) : null,
            labourUnitPriceOverride: quoteConfig?.labourUnitPriceOverride ?? null,
            discount: quoteConfig?.discount ?? 0,
            discountType: quoteConfig?.discountType ?? 'fcfa',
            discountReason: quoteConfig?.discountReason ?? '',
            notes: bookingNotes,
            extraLines: quoteExtraLines,
            tolls: quoteTollsFromLines(tollLines),
            options: administrativeQuote && quoteOptions ? quoteOptions : draft.options,
            version: booking.version,
            billingMode: quoteConfig?.billingMode ?? 'complete',
            menuIncluded: quoteConfig?.menuIncluded ?? false,
            rentalKit:
              quoteConfig?.billingMode === 'driver-rental'
                ? (quoteConfig.rentalKit ??
                  getRentalKit?.() ??
                  defaultRentalKit(
                    catalogue?.vehicles.find((vehicle) => vehicle.id === draft.vehicleId) ??
                      booking.vehicle,
                    draft.options.labour,
                    catalogue?.settings.rentalKitConfiguration,
                  ))
                : [],
            overtimeMinutes: quoteConfig?.overtimeMinutes ?? 0,
            providedCrew: draft.options.labour,
          });
          onQuoteSaved?.(savedQuoteBooking);
          navigate(`${routes.administrationBookings}?q=${encodeURIComponent(booking.reference)}`, {
            state: { successMessage: `Devis ${booking.reference} enregistré.` },
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
      setDone(booking);
      document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      const message = errorMessage(e);
      if (administrativeQuote) {
        setSubmitError(message);
      } else if (/numéro valide avec son indicatif international/i.test(message)) {
        setFieldErrors((current) => ({ ...current, customerPhone: message }));
      } else if (/date invalide|date à venir|au maximum .* jours/i.test(message)) {
        setFieldErrors((current) => ({ ...current, date: message }));
      } else if (
        /créneau invalide|créneau n’est plus disponible|préavis|heure qui n’est pas déjà passée/i.test(
          message,
        )
      ) {
        setFieldErrors((current) => ({ ...current, timeSlot: message }));
      } else {
        setSubmitError(message);
      }
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
        [key]: Math.max(0, Math.min(pricingSettings?.maxOptions ?? 0, d.options[key] + delta)),
      },
    }));
  }
  const extras: [keyof Options, string, string][] = [
    ['labour', messages.manUvres, messages.chargementEtDechargement],
    ['desk', messages.montageDemontageDeBureau, messages.unMenuisierPourVosMeubles],
    ['wardrobe', messages.montageDemontageDArmoire, messages.demontageEtRemontageSurPlace],
    ['bed', messages.montageDemontageDeLit, messages.litDeuxPlaces],
  ];
  const trips = quoteConfig?.trips ?? 1;
  const transportUnit =
    quoteTier === 3 ? (quoteConfig?.customPrice ?? 0) : (selected?.prices[quoteTier] ?? 0);
  const quoteLinesRaw =
    quoteConfig && selected && draft.route
      ? [
          {
            label: `Transport ${selected.shortName || selected.name} · ${referenceTierLabels(bounds)[quoteTier].toLowerCase()} (aller-retour)`,
            quantity: trips,
            unitPrice: transportUnit,
            total: transportUnit * trips,
          },
          ...(price?.lines.filter((line) => !line.label.startsWith('Transport ')) ?? []),
        ]
      : (price?.lines ?? []);
  const quoteLines = quoteLinesRaw.map((line) =>
    quoteConfig?.labourUnitPriceOverride && /^Manœuvre/u.test(line.label)
      ? {
          ...line,
          unitPrice: quoteConfig.labourUnitPriceOverride,
          total: line.quantity * quoteConfig.labourUnitPriceOverride,
        }
      : line,
  );
  const baseTotal =
    quoteTier === 3 && quoteConfig?.customPrice == null
      ? null
      : quoteLines.reduce((sum, line) => sum + line.total, 0);
  const rawDiscount = quoteConfig?.discount ?? 0;
  const effectiveDiscount =
    baseTotal === null
      ? 0
      : quoteConfig?.discountType === 'pct'
        ? Math.round((baseTotal * Math.min(100, rawDiscount)) / 100)
        : Math.min(baseTotal, rawDiscount);
  const quotePreviewPrice = price
    ? {
        ...price,
        tier: quoteTier,
        lines: quoteLines,
        total: baseTotal === null ? null : baseTotal - effectiveDiscount,
        discount: effectiveDiscount,
        discountLabel: `Remise${quoteConfig?.discountType === 'pct' && rawDiscount ? ` (${Math.min(100, rawDiscount)} %)` : ''}${quoteConfig?.discountReason?.trim() ? ` · ${quoteConfig.discountReason.trim()}` : ''}`,
        discountType: quoteConfig?.discountType ?? 'fcfa',
        discountValue: rawDiscount,
        discountReason: quoteConfig?.discountReason?.trim() ?? '',
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
