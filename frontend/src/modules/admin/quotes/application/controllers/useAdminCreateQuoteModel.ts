import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBookingForm } from '../../../../booking/application/controllers/useBookingForm';
import { blankDraft, useApp } from '../../../../shared/application/context';
import { useBookingCommands } from '../../../../booking/application/controllers/useBookingCommands';
import {
  readAdminQuoteDraft,
  saveAdminQuoteDraft,
  clearAdminQuoteDraft,
  type AdminQuoteConfig,
} from '../admin-quote-draft-storage';
import {
  referenceInventoryNote,
  referenceMovingEstimateNote,
} from '../../../../moving/domain/estimate/reference-inventory-note';
import { referenceTierLabels } from '../../../../shared/application/presentation/format';
import { today } from '../../../../shared/domain/date';
import { labourUnitPrice, labourUnitPriceOverrideFromQuote } from '../../../../moving/domain/pricing/labour-price';
import { useAdminQuoteTraffic } from './useAdminQuoteTraffic';
import type { Booking, Options, Price, Quote } from '../../../../shared/domain/model';
import { bookingInventorySnapshot, estimateMovingWork } from '../../../../moving/domain/estimate/moving-estimate';
import { defaultClientQuestions } from '../../../../booking/domain/questionnaire';
import { quoteNotificationUrl } from '../services/quote-notification';
import { whatsappNumber, whatsappUrl } from '../../../../shared/messaging/application/services/whatsapp';
import {
  quoteConditionsText,
  whatsappPaymentLine,
} from '../../../../shared/messaging/application/services/whatsapp-templates';
import { createAdminQuotePreview } from '../services/admin-quote-preview';
import {
  cheaperCompatibleVehicle,
  vehicleFitWarnings,
} from '../services/quote-vehicle-fit';
import { fitConfirmationCopy } from '../services/quote-fit-confirmation';
import { errorMessage } from '../../../../shared/application/error-message';

export function useAdminCreateQuoteModel(publicRequest: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const quoteHandoff = location.state as {
    initialTollLines?: { id: string; label: string; quantity: number; unitPrice: number }[];
    quoteError?: string;
  } | null;
  const quoteHandoffError = quoteHandoff?.quoteError ?? '';
  const quoteHandoffApplied = useRef('');
  const initialClient = (
    location.state as {
      initialClient?: { name: string; phone: string; address: string };
    } | null
  )?.initialClient;
  const calendarAppointment = (
    location.state as { calendarAppointment?: { date: string; time: string } } | null
  )?.calendarAppointment;
  const resetQuoteToken = (location.state as { resetQuote?: string } | null)?.resetQuote;
  const editingReservation = new URLSearchParams(location.search).has('modifier');
  const resetAdminQuote = Boolean(
    resetQuoteToken && !editingReservation && !initialClient && !calendarAppointment,
  );
  const startNewRequest = Boolean(
    publicRequest &&
    !editingReservation &&
    (location.state as { newRequest?: boolean } | null)?.newRequest,
  );
  const requestInitialized = useRef(false);
  const restoredDraft = useRef(false);
  const skipInitialSave = useRef(false);
  const draftSaveQueue = useRef(Promise.resolve());
  const [quoteConfig, setQuoteConfig] = useState<AdminQuoteConfig>({
    trips: 1,
    calcMode: 'auto',
    legMinutes: 0,
    trafficOff: false,
    heatOff: false,
    heatRest: 0,
    discount: 0,
    discountType: 'fcfa',
    discountReason: '',
    customPrice: null,
    labourUnitPriceOverride: null,
    billingMode: 'complete',
    menuIncluded: false,
    overtimeMinutes: 0,
    rentalKit: null,
  });
  const [simulationNeeds, setSimulationNeeds] = useState<{
    blankets: number;
    straps: number;
  } | null>(null);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [quoteKind, setQuoteKind] = useState<Quote['kind']>('provisional');
  const [resetVersion, setResetVersion] = useState(0);
  const [pdfError, setPdfError] = useState('');
  const [stageError, setStageError] = useState('');
  const [pricingSnapshotBusy, setPricingSnapshotBusy] = useState(false);
  const [pricingSnapshotError, setPricingSnapshotError] = useState('');
  const [reminderNotice, setReminderNotice] = useState('');
  const whatsappWindow = useRef<Window | null>(null);
  const sendWhatsAppAfterSave = useRef(false);
  const [openQuoteSections, setOpenQuoteSections] = useState({
    client: true,
    route: false,
    tolls: false,
    options: false,
  });
  const {
    exportQuote,
    catalogue: appCatalogue,
    tollPoints: appTollPoints,
    user,
    api,
    requestConfirmation,
  } = useApp();
  const bookingCommands = useBookingCommands();
  const state = useBookingForm({
    mode: publicRequest && user?.role !== 'admin' ? 'booking' : 'admin-quote',
    quoteConfig,
    quoteKind,
    getRentalKit: () => rentalKit,
    onQuoteSaved: (booking) => {
      if (!sendWhatsAppAfterSave.current) return;
      sendWhatsAppAfterSave.current = false;
      const quote = booking.quotes.filter((item) => item.kind === quoteKind).at(-1);
      if (!quote) {
        whatsappWindow.current?.close();
        whatsappWindow.current = null;
        return;
      }
      const href = quoteNotificationUrl(
        booking,
        quote,
        booking.pricingSettings ?? appCatalogue?.settings,
      );
      if (whatsappWindow.current) whatsappWindow.current.location.replace(href);
      else window.location.assign(href);
      whatsappWindow.current = null;
      void (async () => {
        try {
          const settings = booking.pricingSettings ?? appCatalogue?.settings;
          if (settings) {
            const blob = await exportQuote(booking, quote, settings);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Devis-${quote.kind === 'final' ? 'final' : 'provisoire'}-${quote.reference}.pdf`;
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
          }
        } catch {
          setPdfError('Le devis est enregistré, mais le PDF n’a pas pu être téléchargé.');
        }
      })();
    },
  });
  const editingLocked = Boolean(
    state.editingBooking &&
    (['completed', 'cancelled'].includes(state.editingBooking.status) ||
      state.editingBooking.quotes.some((quote) => quote.kind === 'final')),
  );
  const editingBooking = state.editingBooking;
  const quoteSettings = editingBooking?.pricingSettings ?? state.catalogue?.settings;
  const savedTollPrices = new Map(
    editingBooking?.pricingSnapshot?.tollPoints.map((point) => [point.id, point]) ?? [],
  );
  const quoteTollPoints = appTollPoints.map((point) => {
    const saved = savedTollPrices.get(point.id);
    return saved
      ? { ...point, heavyPrice: saved.heavyPrice, vehiclePrices: saved.vehiclePrices }
      : point;
  });
  const {
    catalogue,
    loading,
    error,
    reload,
    draft,
    setDraft,
    selected,
    price,
    estimating,
    estimateError,
    submitError,
    submitting,
    done,
    submit,
    tollLines,
    setTollLines,
    option,
    extras,
    clientRecognition,
    recognizingClient,
    editLoading,
    editError,
  } = state;
  const quoteVehicle = selected
    ? {
        ...selected,
        prices:
          editingBooking?.pricingSnapshot?.vehiclePrices[selected.id] ??
          (editingBooking?.vehicle.id === selected.id
            ? editingBooking.vehicle.prices
            : selected.prices),
      }
    : null;
  const route = draft.route ?? undefined;
  const {
    googleMapsKey,
    traffic,
    trafficBusy,
    trafficError,
    trafficDuration,
    refreshTraffic,
    trafficDelay,
    trafficColor,
  } = useAdminQuoteTraffic({
    enabled: user?.role === 'admin' && !publicRequest,
    route,
    date: draft.date,
    timeSlot: draft.timeSlot,
  });
  useEffect(() => {
    if (!resetAdminQuote) return;
    void clearAdminQuoteDraft(api);
    setDraft(blankDraft(appCatalogue ?? undefined));
    setQuoteConfig({
      trips: 1,
      calcMode: 'auto',
      legMinutes: 0,
      trafficOff: false,
      heatOff: false,
      heatRest: 0,
      discount: 0,
      discountType: 'fcfa',
      discountReason: '',
      customPrice: null,
      labourUnitPriceOverride: null,
      billingMode: 'complete',
      menuIncluded: false,
      overtimeMinutes: 0,
      rentalKit: null,
    });
    setTollLines([]);
    setQuoteKind('provisional');
    setQuestionnaireOpen(false);
    setSimulationNeeds(null);
    setStageError('');
    setPdfError('');
    setReminderNotice('');
    setOpenQuoteSections({ client: true, route: false, tolls: false, options: false });
    setResetVersion((current) => current + 1);
    window.scrollTo({ top: 0 });
    navigate(location.pathname, { replace: true, state: null });
  }, [api, appCatalogue, location.pathname, navigate, resetAdminQuote, setDraft, setTollLines]);
  useEffect(() => {
    if (!startNewRequest || requestInitialized.current) return;
    requestInitialized.current = true;
    setDraft((current) => ({
      ...blankDraft(),
      vehicleId: current.vehicleId,
      customerName: user?.role === 'client' ? user.name : '',
      customerPhone: user?.role === 'client' ? user.phone : '',
    }));
    setQuoteConfig({
      trips: 1,
      calcMode: 'auto',
      legMinutes: 0,
      trafficOff: false,
      heatOff: false,
      heatRest: 0,
      discount: 0,
      discountType: 'fcfa',
      discountReason: '',
      customPrice: null,
      labourUnitPriceOverride: null,
      billingMode: 'complete',
      menuIncluded: false,
      overtimeMinutes: 0,
      rentalKit: null,
    });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, navigate, setDraft, startNewRequest, user]);
  const canCreateFinal = Boolean(
    editingBooking?.status !== 'cancelled' &&
    !editingBooking?.quotes.some((quote) => quote.kind === 'final') &&
    Boolean(draft.date) &&
    !draft.noDate,
  );
  useEffect(() => {
    const lastQuote = state.editingBooking?.quotes.at(-1);
    if (lastQuote) setQuoteKind(lastQuote.kind);
  }, [state.editingBooking]);
  const estimateInventory = {
    ...draft.inventory,
    ready: draft.questionnaireAnswers['key-ready']?.startsWith('Non')
      ? ('non' as const)
      : draft.questionnaireAnswers['key-ready']?.startsWith('Oui')
        ? ('oui' as const)
        : (draft.inventory.ready ?? ('' as const)),
    stairs: draft.questionnaireAnswers['key-stairs']?.startsWith('Non, par le balcon')
      ? ('balcon' as const)
      : draft.questionnaireAnswers['key-stairs']?.startsWith('Non')
        ? ('non' as const)
        : draft.questionnaireAnswers['key-stairs']?.startsWith('Oui')
          ? ('oui' as const)
          : draft.questionnaireAnswers['key-stairs']?.startsWith('À vérifier')
            ? ('verif' as const)
            : (draft.inventory.stairs ?? ('' as const)),
  };
  useEffect(() => {
    if (editingReservation || publicRequest || resetAdminQuote || user?.role !== 'admin') {
      restoredDraft.current = true;
      skipInitialSave.current = true;
      return;
    }
    let active = true;
    void readAdminQuoteDraft(api).then((saved) => {
      if (!active) return;
      if (saved) {
        setDraft(saved.draft);
        setQuoteConfig(saved.quoteConfig);
        setTollLines(saved.tollLines);
      }
      restoredDraft.current = true;
      skipInitialSave.current = true;
    });
    return () => {
      active = false;
    };
  }, [api, editingReservation, publicRequest, resetAdminQuote, setDraft, setTollLines, user?.role]);

  useEffect(() => {
    if (!initialClient) return;
    setDraft((current) => ({
      ...current,
      customerName: initialClient.name,
      customerPhone: initialClient.phone,
      fromAddress: initialClient.address || current.fromAddress,
    }));
    setOpenQuoteSections((current) => ({ ...current, client: true }));
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [initialClient, location.pathname, location.search, navigate, setDraft]);
  useEffect(() => {
    if (!calendarAppointment) return;
    setDraft((current) => ({
      ...current,
      date: calendarAppointment.date,
      month: calendarAppointment.date.slice(0, 7),
      timeSlot: calendarAppointment.time,
      noDate: false,
    }));
    setOpenQuoteSections((current) => ({ ...current, client: true }));
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [calendarAppointment, location.pathname, location.search, navigate, setDraft]);
  useEffect(() => {
    if (!restoredDraft.current) return;
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }
    if (publicRequest || user?.role !== 'admin') return;
    const timeout = window.setTimeout(() => {
      const value = { draft, quoteConfig, tollLines };
      draftSaveQueue.current = draftSaveQueue.current.then(() => saveAdminQuoteDraft(api, value));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [api, draft, publicRequest, quoteConfig, tollLines, user?.role]);

  useEffect(() => {
    if (!publicRequest || !user) return;
    setDraft((current) => ({
      ...current,
      customerName: current.customerName || user.name || '',
      customerPhone: current.customerPhone || user.phone || '',
    }));
  }, [publicRequest, setDraft, user]);
  useEffect(() => {
    const booking = state.editingBooking;
    if (!booking) return;
    const quote = booking.quotes.at(-1);
    const labourOverride = labourUnitPriceOverrideFromQuote(
      quote?.price,
      booking.pricingSettings,
      booking.workAccess,
    );
    setQuoteConfig({
      trips: quote?.price.trips ?? booking.estimate.trips,
      calcMode: 'auto',
      legMinutes: 0,
      trafficOff: false,
      heatOff: false,
      heatRest: 0,
      discount: quote?.price.discountValue ?? quote?.price.discount ?? booking.estimate.discount,
      discountType: quote?.price.discountType ?? 'fcfa',
      discountReason: quote?.price.discountReason ?? '',
      customPrice:
        (quote?.price ?? booking.estimate).tier === 3
          ? ((quote?.price ?? booking.estimate).lines.find((line) =>
              line.label.startsWith('Transport'),
            )?.unitPrice ?? null)
          : null,
      labourUnitPriceOverride: labourOverride,
      billingMode: quote?.billingMode ?? 'complete',
      menuIncluded: quote?.menuIncluded ?? false,
      overtimeMinutes: quote?.overtimeMinutes ?? 0,
      rentalKit: quote?.rentalKit ?? null,
    });
    setTollLines(
      (quote?.tolls ?? []).map((line) => ({
        id: line.tollPointId,
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    );
  }, [state.editingBooking, setTollLines]);
  useEffect(() => {
    if (
      !state.editingBooking ||
      !quoteHandoff?.initialTollLines?.length ||
      quoteHandoffApplied.current === location.key
    )
      return;
    quoteHandoffApplied.current = location.key;
    setTollLines(quoteHandoff.initialTollLines);
  }, [location.key, quoteHandoff, setTollLines, state.editingBooking]);
  const inventoryText = referenceInventoryNote(
    estimateInventory,
    draft.fromAddress,
    draft.toAddress,
  );
  const pricingRoute =
    draft.route && draft.distanceKmOverride != null
      ? { ...draft.route, distanceKm: draft.distanceKmOverride }
      : draft.route;
  const labourPrice = quoteSettings
    ? labourUnitPrice(quoteSettings, {
        fromFloor: draft.inventory.fromFloor,
        toFloor: draft.inventory.toFloor,
        fromLift: draft.inventory.fromLift,
        toLift: draft.inventory.toLift,
      })
    : 0;
  const movingEstimate = selected
    ? estimateMovingWork(estimateInventory, selected, pricingRoute, {
        trips: quoteConfig.trips,
        crew: draft.inventory.crew,
        startTime: draft.timeSlot,
        laborPlanning: quoteSettings?.movingLaborPlanning,
        ignoreTraffic: quoteConfig.trafficOff,
        manualLegMinutes: quoteConfig.calcMode === 'manual' ? quoteConfig.legMinutes : 0,
        date: draft.date,
        month: draft.month,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        hasToll: tollLines.some((line) => line.quantity * line.unitPrice > 0),
        heatOff: quoteConfig.heatOff,
        heatRest: quoteConfig.heatRest,
      })
    : null;
  const selectedVehicleId = selected?.id ?? '';
  const movingEstimateVolume = movingEstimate?.volume ?? 0;
  const movingEstimateCrew = movingEstimate?.crew ?? 0;
  const movingEstimateTrips = movingEstimate?.trips ?? 0;
  const cheaperVehicle = selected
    ? cheaperCompatibleVehicle({
        inventory: estimateInventory,
        current: selected,
        vehicles: catalogue?.vehicles ?? [],
        route: pricingRoute
          ? { distanceKm: pricingRoute.distanceKm, durationMinutes: pricingRoute.durationMinutes }
          : null,
        date: draft.date,
        month: draft.month,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        startTime: draft.timeSlot,
        hasToll: tollLines.some((line) => line.quantity * line.unitPrice > 0),
        settings: quoteSettings,
        estimate: movingEstimate,
      })
    : null;
  const readyAnswer = draft.questionnaireAnswers['key-ready'];
  const stairsAnswer = draft.questionnaireAnswers['key-stairs'];
  const inventoryEstimateKey = JSON.stringify({
    ...draft.inventory,
    crew: undefined,
    ready: estimateInventory.ready,
    stairs: estimateInventory.stairs,
  });
  useEffect(() => {
    if (quoteConfig.calcMode === 'manual') return;
    if (!selectedVehicleId || movingEstimateVolume <= 0) return;
    setDraft((current) => {
      if (current.options.labour === movingEstimateCrew) return current;
      return {
        ...current,
        options: { ...current.options, labour: movingEstimateCrew },
      };
    });
  }, [
    draft.inventory,
    readyAnswer,
    stairsAnswer,
    draft.timeSlot,
    selectedVehicleId,
    movingEstimateCrew,
    movingEstimateVolume,
    setDraft,
    quoteConfig.calcMode,
  ]);
  useEffect(() => {
    if (quoteConfig.calcMode === 'manual') return;
    if (!selectedVehicleId || movingEstimateTrips <= 0) return;
    setQuoteConfig((current) =>
      current.trips === movingEstimateTrips ? current : { ...current, trips: movingEstimateTrips },
    );
  }, [inventoryEstimateKey, selectedVehicleId, movingEstimateTrips, quoteConfig.calcMode]);
  const configuredQuestions = catalogue?.settings.questionnaire;
  const questionnaire = configuredQuestions?.length ? configuredQuestions : defaultClientQuestions;
  const inventoryCount =
    Object.values(draft.inventory.entries).reduce((sum, entry) => sum + entry.quantity, 0) +
    draft.inventory.variants.reduce((sum, entry) => sum + entry.quantity, 0) +
    draft.inventory.custom.reduce((sum, entry) => sum + entry.quantity, 0);
  const visibleInventoryText =
    inventoryCount > 0 ||
    Boolean(draft.inventory.dwellingType) ||
    draft.inventory.fromFloor > 0 ||
    draft.inventory.toFloor > 0 ||
    draft.inventory.fromLift ||
    draft.inventory.toLift
      ? inventoryText
      : '';
  const estimateText = movingEstimate?.volume
    ? referenceMovingEstimateNote(
        movingEstimate,
        draft.route?.distanceKm ?? 0,
        quoteSettings?.movingLaborPlanning?.maxDayHours,
      )
    : '';
  const questionnaireText = [
    ...questionnaire
      .filter(
        (question) =>
          question.active &&
          draft.questionnaireAnswers[question.id]?.trim() &&
          !['Question posée', 'À poser'].includes(draft.questionnaireAnswers[question.id].trim()),
      )
      .map((question) => question.label + ' : ' + draft.questionnaireAnswers[question.id].trim()),
    ...[
      ['key-ready', 'Le matériel sera-t-il prêt à être chargé ?'],
      ['key-stairs', 'Tout le matériel passe-t-il dans les escaliers ?'],
    ]
      .filter(([id]) => draft.questionnaireAnswers[id]?.trim())
      .map(([id, label]) => `${label} : ${draft.questionnaireAnswers[id].trim()}`),
  ].join('\n');
  const totalTolls = tollLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const quoteDate = draft.date
    ? draft.date.split('-').reverse().join('/')
    : draft.month
      ? new Date(`${draft.month}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric',
          timeZone: 'Africa/Dakar',
        })
      : '—';
  const businessPhone = catalogue?.settings.businessPhone ?? '';
  const businessPhoneDigits = businessPhone.replace(/\D/g, '');
  const displayBusinessPhone = /^221\d{9}$/u.test(businessPhoneDigits)
    ? `+221 ${businessPhoneDigits.slice(3, 5)} ${businessPhoneDigits.slice(5, 8)} ${businessPhoneDigits.slice(8, 10)} ${businessPhoneDigits.slice(10)}`
    : businessPhone;
  const preview = createAdminQuotePreview({
    draft,
    estimateInventory,
    config: quoteConfig,
    vehicle: quoteVehicle,
    estimate: movingEstimate,
    settings: quoteSettings,
    price,
    extras,
    labourPrice,
    applySnapshotLabourPrice: Boolean(editingBooking?.pricingSnapshot),
    simulationNeeds,
  });
  const formulaPrices = {
    economic: createAdminQuotePreview({
      draft,
      estimateInventory,
      config: {
        ...quoteConfig,
        billingMode: 'driver-rental',
        menuIncluded: false,
        overtimeMinutes: 0,
      },
      vehicle: quoteVehicle,
      estimate: movingEstimate,
      settings: quoteSettings,
      price,
      extras,
      labourPrice,
      applySnapshotLabourPrice: Boolean(editingBooking?.pricingSnapshot),
      simulationNeeds,
    }).total,
    standard: createAdminQuotePreview({
      draft,
      estimateInventory,
      config: { ...quoteConfig, billingMode: 'standard', overtimeMinutes: 0 },
      vehicle: quoteVehicle,
      estimate: movingEstimate,
      settings: quoteSettings,
      price,
      extras,
      labourPrice,
      applySnapshotLabourPrice: Boolean(editingBooking?.pricingSnapshot),
      simulationNeeds,
    }).total,
    complete: createAdminQuotePreview({
      draft,
      estimateInventory,
      config: { ...quoteConfig, billingMode: 'complete', overtimeMinutes: 0 },
      vehicle: quoteVehicle,
      estimate: movingEstimate,
      settings: quoteSettings,
      price,
      extras,
      labourPrice,
      applySnapshotLabourPrice: Boolean(editingBooking?.pricingSnapshot),
      simulationNeeds,
    }).total,
  };
  const {
    tier: previewTier,
    rentalKit,
    rentalOvertimeAmount,
    manoeuvreOvertime,
    previewLines,
    subtotal: previewSubtotal,
    discount: previewDiscount,
    discountLabel: previewDiscountLabel,
    total: previewTotal,
  } = preview;
  const bounds = quoteSettings?.distanceBounds ?? [15, 25, 35];
  const tiers = referenceTierLabels(bounds);
  const effectiveDistance = draft.distanceKmOverride ?? draft.route?.distanceKm;
  const availableMenuLines = preview.availableMenuLines;
  const menuIncluded = preview.menuIncluded;
  const savedQuote = editingBooking?.quotes.filter((quote) => quote.kind === quoteKind).at(-1);
  const canSendQuoteWhatsApp = Boolean(
    whatsappNumber(draft.customerPhone, catalogue?.settings.whatsappCountryCode ?? '221').length >=
    10,
  );
  const reminderDays = draft.date
    ? Math.round(
        (+new Date(`${draft.date}T12:00:00Z`) - +new Date(`${today()}T12:00:00Z`)) / 86400000,
      )
    : -1;
  const reminderCanSend = Boolean(
    editingBooking && draft.date && reminderDays >= 0 && canSendQuoteWhatsApp,
  );
  const reminderDisabledReason = !editingBooking
    ? 'Enregistrez le devis pour envoyer un rappel'
    : !canSendQuoteWhatsApp
      ? 'Ajoutez le numéro du client'
      : !draft.date
        ? 'Choisissez la date du rendez-vous'
        : reminderDays < 0
          ? 'La date du rendez-vous est passée'
          : '';
  const reminderWhen =
    reminderDays === 0
      ? 'aujourd’hui'
      : reminderDays === 1
        ? 'demain'
        : reminderDays % 7 === 0
          ? `dans ${reminderDays / 7} semaine${reminderDays > 7 ? 's' : ''}`
          : `dans ${reminderDays} jours`;
  const reminderDateLabel = draft.date
    ? new Date(`${draft.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Africa/Dakar',
      })
    : '';
  const reminderPayment = whatsappPaymentLine(catalogue?.settings);
  const reminderConditions = quoteConditionsText(estimateInventory, quoteConfig.billingMode);
  const balconyPrice = Math.max(0, Math.round(Number(estimateInventory.balcPx) || 0));
  const reminderHref = editingBooking
    ? whatsappUrl(
        draft.customerPhone,
        `Bonjour ${draft.customerName}, petit rappel de Demenag Express : votre déménagement (${editingBooking.reference}) est prévu ${reminderWhen}, le ${reminderDateLabel}${draft.timeSlot && draft.timeSlot !== 'À définir' ? ` à ${draft.timeSlot}` : ''}.\n${draft.fromAddress ? `Départ : ${draft.fromAddress}\n` : ''}${draft.toAddress ? `Arrivée : ${draft.toAddress}\n` : ''}${reminderConditions || 'Merci de préparer vos affaires pour le chargement.'}${reminderPayment ? `\n${reminderPayment}` : ''}\nPour toute question, contactez-nous au ${catalogue?.settings.whatsappPhone || catalogue?.settings.businessPhone || ''}. À bientôt !`,
        catalogue?.settings,
      )
    : '';
  function sendCurrentQuoteOnWhatsApp() {
    if (!canSendQuoteWhatsApp) {
      setStageError('Numéro WhatsApp du client invalide.');
      setOpenQuoteSections((current) => ({ ...current, client: true }));
      return;
    }
    if (quoteKind === 'final' && estimateInventory.stairs === 'balcon' && balconyPrice <= 0) {
      setStageError('Passage par le balcon : fixez le supplément avant le devis final.');
      return;
    }
    if (quoteKind === 'final' && previewTier === 3 && !(Number(quoteConfig.customPrice) > 0)) {
      setStageError(
        `Distance au-delà de ${bounds[2]} km : fixez le prix par aller-retour avant le devis final.`,
      );
      return;
    }
    if (quoteKind === 'final' && (!draft.date || draft.noDate)) {
      setStageError(
        'Un devis sans date reste provisoire. Choisissez une date pour passer en final.',
      );
      return;
    }
    const form = document.getElementById('admin-quote-form') as HTMLFormElement | null;
    if (!form?.reportValidity()) return;
    whatsappWindow.current = window.open('about:blank', '_blank');
    if (!whatsappWindow.current) {
      setStageError('Autorisez les fenêtres pour ouvrir WhatsApp après l’enregistrement du devis.');
      return;
    }
    sendWhatsAppAfterSave.current = true;
    setStageError('');
    form.requestSubmit();
  }
  async function downloadCurrentQuote() {
    const pdfSettings = quoteSettings ?? catalogue?.settings;
    if (!pdfSettings || !selected) return;
    setPdfError('');
    try {
      const currentPrice: Price = {
        lines: previewLines.map((line) => ({ ...line })),
        total: previewTotal ?? previewSubtotal - previewDiscount,
        discount: previewDiscount,
        discountLabel: previewDiscountLabel,
        discountType: quoteConfig.discountType,
        discountValue: quoteConfig.discount,
        discountReason: quoteConfig.discountReason,
        tier: previewTier,
        trips: quoteConfig.trips,
        currency: 'XOF',
      };
      const quote: Quote = {
        id: savedQuote?.id ?? 'preview',
        reference: savedQuote?.reference ?? 'DEVIS-EN-COURS',
        kind: quoteKind,
        createdAt: savedQuote?.createdAt ?? new Date().toISOString(),
        price: currentPrice,
        notes: [
          draft.fromNote.trim() ? `Repère départ : ${draft.fromNote.trim()}` : '',
          draft.toNote.trim() ? `Repère arrivée : ${draft.toNote.trim()}` : '',
          visibleInventoryText,
          estimateText,
          questionnaireText,
          quoteConditionsText(estimateInventory, quoteConfig.billingMode),
          draft.notes,
        ]
          .filter(Boolean)
          .join('\n'),
        options: draft.options,
        billingMode: quoteConfig.billingMode,
        menuIncluded: quoteConfig.billingMode === 'driver-rental' && quoteConfig.menuIncluded,
        rentalKit: quoteConfig.billingMode === 'driver-rental' ? rentalKit : [],
        overtimeMinutes:
          quoteConfig.billingMode === 'driver-rental' ? quoteConfig.overtimeMinutes : 0,
        providedCrew: movingEstimate?.crew ?? draft.options.labour,
        tolls: tollLines.map((line) => ({
          tollPointId: line.id,
          label: line.label,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
      };
      const previewBooking: Booking = {
        ...(editingBooking ?? {
          id: 'preview',
          reference: 'DEVIS-EN-COURS',
          userId: '',
          customerName: '',
          phone: '',
          vehicle: selected,
          fromAddress: '',
          toAddress: '',
          from: [0, 0],
          to: [0, 0],
          distanceKm: 0,
          date: null,
          timeSlot: '',
          options: draft.options,
          notes: '',
          status: 'pending',
          estimate: currentPrice,
          quotes: [],
          createdAt: new Date().toISOString(),
          version: 1,
        }),
        customerName: draft.customerName,
        phone: draft.customerPhone,
        vehicle: selected,
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
        from: draft.route?.from ?? editingBooking?.from ?? [0, 0],
        to: draft.route?.to ?? editingBooking?.to ?? [0, 0],
        distanceKm: effectiveDistance ?? editingBooking?.distanceKm ?? 0,
        date: draft.date || null,
        month: draft.month,
        timeSlot: draft.timeSlot,
        options: draft.options,
        notes: quote.notes,
        status: quoteKind === 'final' ? 'completed' : (editingBooking?.status ?? 'pending'),
        pricingSettings: pdfSettings,
        inventorySnapshot:
          movingEstimate &&
          (visibleInventoryText || estimateInventory.ready || estimateInventory.stairs)
            ? bookingInventorySnapshot(estimateInventory, movingEstimate)
            : undefined,
        estimate: currentPrice,
        quotes: editingBooking?.quotes ?? [],
      };
      const blob = await exportQuote(previewBooking, quote, pdfSettings);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filenameKind = quoteKind === 'final' ? 'final' : 'provisoire';
      link.download = `Devis-${filenameKind}-${quote.reference || editingBooking?.reference || 'demande'}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setPdfError('Le PDF n’a pas pu être généré. Réessayez.');
    }
  }
  const onTollToggle = (line: (typeof tollLines)[number], checked: boolean) =>
    setTollLines((current) =>
      checked
        ? [...current.filter((existing) => existing.id !== line.id), line]
        : current.filter((existing) => existing.id !== line.id),
    );
  const changeQuoteOption = (key: keyof Options, delta: number) => {
    if (key !== 'labour') {
      option(key, delta);
      return;
    }
    setDraft((current) => {
      const minimum = movingEstimate?.volume ? 1 : 0;
      const labour = Math.max(
        minimum,
        Math.min(quoteSettings?.maxOptions ?? 20, current.options.labour + delta),
      );
      return {
        ...current,
        options: { ...current.options, labour },
        inventory: { ...current.inventory, crew: labour },
      };
    });
    setQuoteConfig((current) => ({ ...current, calcMode: 'manual' }));
  };

  async function confirmVehicleFit() {
    const warnings =
      quoteConfig.calcMode === 'manual' || !selected || !catalogue
        ? []
        : vehicleFitWarnings(estimateInventory, selected, quoteSettings ?? catalogue.settings);
    if (!warnings.length) return true;
    const copy = fitConfirmationCopy(warnings);
    const confirmed = await requestConfirmation({
      titleId: 'admin-quote-vehicle-fit-confirmation',
      eyebrow: 'Vérification du véhicule',
      title: copy.title,
      description: copy.description,
      confirmLabel: 'Enregistrer quand même',
    });
    if (!confirmed && whatsappWindow.current) {
      whatsappWindow.current.close();
      whatsappWindow.current = null;
      sendWhatsAppAfterSave.current = false;
    }
    return confirmed;
  }

  function toggleQuoteSection(section: keyof typeof openQuoteSections) {
    setOpenQuoteSections((current) => ({ ...current, [section]: !current[section] }));
  }

  async function applyCurrentPricingSnapshot() {
    if (!editingBooking || user?.role !== 'admin' || pricingSnapshotBusy) return;
    setPricingSnapshotBusy(true);
    setPricingSnapshotError('');
    try {
      const updated = await api.applyCurrentPricingSnapshot(
        editingBooking.id,
        editingBooking.version,
      );
      state.setEditingBooking(updated);
    } catch (reason) {
      setPricingSnapshotError(errorMessage(reason));
    } finally {
      setPricingSnapshotBusy(false);
    }
  }

  return {
    location,
    navigate,
    quoteHandoffError,
    initialClient,
    editingReservation,
    startNewRequest,
    resetVersion,
    requestInitialized,
    restoredDraft,
    skipInitialSave,
    quoteConfig,
    setQuoteConfig,
    questionnaireOpen,
    setQuestionnaireOpen,
    quoteKind,
    setQuoteKind,
    pdfError,
    setPdfError,
    stageError,
    setStageError,
    pricingSnapshotBusy,
    pricingSnapshotError,
    applyCurrentPricingSnapshot,
    reminderNotice,
    setReminderNotice,
    whatsappWindow,
    sendWhatsAppAfterSave,
    openQuoteSections,
    setOpenQuoteSections,
    googleMapsKey,
    traffic,
    trafficBusy,
    trafficError,
    exportQuote,
    appCatalogue,
    user,
    bookingCommands,
    state,
    editingLocked,
    editingBooking,
    quoteSettings,
    quoteTollPoints,
    catalogue,
    loading,
    error,
    reload,
    draft,
    setDraft,
    selected,
    price,
    estimating,
    estimateError,
    submitError,
    submitting,
    done,
    submit,
    tollLines,
    setTollLines,
    option,
    extras,
    clientRecognition,
    recognizingClient,
    editLoading,
    editError,
    canCreateFinal,
    estimateInventory,
    inventoryText,
    route,
    refreshTraffic,
    pricingRoute,
    trafficDelay,
    trafficColor,
    labourPrice,
    movingEstimate,
    cheaperVehicle,
    confirmVehicleFit,
    selectedVehicleId,
    movingEstimateVolume,
    movingEstimateCrew,
    movingEstimateTrips,
    readyAnswer,
    stairsAnswer,
    inventoryEstimateKey,
    questionnaire,
    inventoryCount,
    visibleInventoryText,
    estimateText,
    questionnaireText,
    totalTolls,
    quoteDate,
    businessPhone,
    businessPhoneDigits,
    displayBusinessPhone,
    bounds,
    tiers,
    effectiveDistance,
    previewTier,
    availableMenuLines,
    menuIncluded,
    previewLines,
    rentalKit,
    setSimulationNeeds,
    rentalOvertimeAmount,
    manoeuvreOvertimeLine: manoeuvreOvertime,
    previewSubtotal,
    previewDiscount,
    previewDiscountLabel,
    previewTotal,
    formulaPrices,
    savedQuote,
    canSendQuoteWhatsApp,
    reminderDays,
    reminderCanSend,
    reminderDisabledReason,
    reminderWhen,
    reminderDateLabel,
    reminderPayment,
    reminderHref,
    sendCurrentQuoteOnWhatsApp,
    downloadCurrentQuote,
    onTollToggle,
    changeQuoteOption,
    toggleQuoteSection,
    trafficDuration,
  };
}
