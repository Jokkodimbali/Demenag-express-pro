import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBookingForm } from '../../../../booking/application/controllers/useBookingForm';
import { useApp } from '../../../../shared/application/context';
import { blankDraft } from '../../../../booking/application/booking-draft';
import { useBookingCommands } from '../../../../booking/application/controllers/useBookingCommands';
import {
  readAdminQuoteDraft,
  saveAdminQuoteDraft,
  clearAdminQuoteDraft,
  type AdminQuoteConfig,
} from '../services/admin-quote-draft-storage';
import {
  referenceInventoryNote,
  referenceMovingEstimateNote,
} from '../../../../moving/domain/estimate/reference-inventory-note';
import { referenceTierLabels } from '../../../../shared/application/presentation/format';
import { referenceTrafficDetails } from '../../../../moving/domain/routing/reference-traffic';
import { useAdminQuoteTraffic } from './useAdminQuoteTraffic';
import { useCompanyApproachDistance } from './useCompanyApproachDistance';
import type {
  AccountingEntry,
  AccountingFinanceConfiguration,
  Options,
  Quote,
} from '../../../../shared/domain/model';
import { defaultClientQuestions } from '../../../../booking/domain/questionnaire';
import { quoteNotificationUrl } from '../services/quote-notification';
import { createAdminQuotePreview } from '../services/admin-quote-preview';
import { quoteGrossMargin } from '../services/quote-gross-margin';
import { normalizeAccountingConfiguration } from '../../../accounting/application/services/accounting-dashboard';
import {
  adminQuoteVehicleFitWarnings,
  cheaperCompatibleVehicle,
} from '../services/quote-vehicle-fit';
import { fitConfirmationCopy } from '../services/quote-fit-confirmation';
import { quoteReminder } from '../services/quote-reminder';
import { quoteContactCard } from '../services/quote-contact-card';
import {
  quoteAccountingConfirmation,
  quoteAccountingJournalRows,
} from '../services/quote-accounting-confirmation';
import {
  automaticQuoteEstimateUpdates,
  shouldPreserveAppliedVehicleEstimate,
  type AppliedVehicleEstimate,
} from '../services/automatic-quote-estimate';
import { buildAdminQuotePdfDocument } from '../services/admin-quote-pdf-document';
import { defaultAdminQuoteConfig } from '../services/admin-quote-config';
import { buildAdminQuoteSubmission } from '../services/admin-quote-submission';
import {
  adminQuoteIsLocked,
  canSaveQuoteStageChange,
  latestBookingQuote,
  latestQuoteOfKind,
  quoteStageChanged as isQuoteStageChanged,
  quotePdfFilename,
  quoteTollPointsWithSavedPrices,
  quoteVehicleWithSavedPrices,
} from '../services/admin-quote-edit-policy';
import { startQuoteWhatsAppSubmission } from '../services/quote-whatsapp-submission';
import {
  businessPhonePresentation,
  canCreateFinalQuote,
  changedQuoteLaborDraft,
  inventoryItemCount,
  quoteConfigurationFromBooking,
  quoteDateLabel,
  quoteEstimateInventory,
  quoteQuestionnaireSummary,
  quoteSettingsForEditing,
  toggleQuoteToll,
  totalTollCost,
} from '../services/admin-quote-form-policy';
import {
  estimateAdminQuoteWork,
  labourPriceForQuote,
  quoteHasPaidTolls,
  routeForQuotePricing,
} from '../services/admin-quote-estimation';
import { referenceRentalKitNeeds } from '../../../../moving/application/services/loading-simulation-model';
import { errorMessage } from '../../../../shared/application/error-message';
import { visibleUiText } from '../../../../shared/content/visible-ui-text';
import { reassignTeamsAfterScheduleChange } from '../services/quote-stage-team-reassignment';
import {
  mergeClientSuggestionProfiles,
  type ClientSuggestionProfile,
} from '../services/client-suggestions';

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
  const appliedVehicleEstimate = useRef<AppliedVehicleEstimate | null>(null);
  const [quoteConfig, setQuoteConfig] = useState<AdminQuoteConfig>(defaultAdminQuoteConfig);
  const [accountingConfiguration, setAccountingConfiguration] =
    useState<AccountingFinanceConfiguration | null>(null);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [quoteKind, setQuoteKind] = useState<Quote['kind']>('provisional');
  const [journalSnapshot, setJournalSnapshot] = useState<{
    key: string;
    entries: AccountingEntry[] | null;
  } | null>(null);
  const [resetVersion, setResetVersion] = useState(0);
  const [pdfError, setPdfError] = useState('');
  const [stageError, setStageError] = useState('');
  const [pricingSnapshotBusy, setPricingSnapshotBusy] = useState(false);
  const [pricingSnapshotError, setPricingSnapshotError] = useState('');
  const [reminderNotice, setReminderNotice] = useState('');
  const whatsappWindow = useRef<Window | null>(null);
  const sendWhatsAppAfterSave = useRef(false);
  function cancelPendingWhatsApp() {
    if (!sendWhatsAppAfterSave.current) return;
    whatsappWindow.current?.close();
    whatsappWindow.current = null;
    sendWhatsAppAfterSave.current = false;
  }
  const [openQuoteSections, setOpenQuoteSections] = useState({
    client: true,
    route: false,
    tolls: false,
    options: false,
  });
  const [clientProfiles, setClientProfiles] = useState<ClientSuggestionProfile[]>([]);
  const {
    exportQuote,
    catalogue: appCatalogue,
    tollPoints: appTollPoints,
    user,
    api,
    requestConfirmation,
    showSuccessToast,
    showErrorToast,
  } = useApp();
  useEffect(() => {
    if (user?.role !== 'admin') {
      setClientProfiles([]);
      return;
    }
    let active = true;
    void Promise.all([api.clientProfiles(), api.bookings(), api.hiddenClients()])
      .then(([profiles, bookings, hiddenClients]) => {
        if (active)
          setClientProfiles(mergeClientSuggestionProfiles(profiles, bookings, hiddenClients));
      })
      .catch(() => {
        if (active) setClientProfiles([]);
      });
    return () => {
      active = false;
    };
  }, [api, user?.role]);
  useEffect(() => {
    if (publicRequest || user?.role !== 'admin') {
      setAccountingConfiguration(null);
      return;
    }
    let active = true;
    void api
      .accountingConfiguration()
      .then((configuration) => {
        if (active) setAccountingConfiguration(normalizeAccountingConfiguration(configuration));
      })
      .catch(() => {
        if (active) setAccountingConfiguration(null);
      });
    return () => {
      active = false;
    };
  }, [api, publicRequest, user?.role]);
  const bookingCommands = useBookingCommands();
  const state = useBookingForm({
    mode: publicRequest && user?.role !== 'admin' ? 'booking' : 'admin-quote',
    quoteConfig,
    quoteKind,
    buildAdministrativeQuoteSubmission: buildAdminQuoteSubmission,
    onAdministrativeBookingCreated: () => {
      void clearAdminQuoteDraft(api);
    },
    onQuoteStageUpdated: (booking, previousBooking) => {
      const savedQuote = latestBookingQuote(booking);
      if (!savedQuote) return;
      setQuoteKind(savedQuote.kind);
      showSuccessToast(
        savedQuote.kind === 'final'
          ? visibleUiText.quoteStageFinalNotice
          : visibleUiText.quoteStageProvisionalNotice,
      );
      return reassignTeamsAfterScheduleChange(api, booking, previousBooking, () =>
        (() => {
          const message =
            'Le devis a changé d’étape, mais la réaffectation automatique de l’équipe n’a pas abouti. Vérifiez le planning.';
          setStageError(message);
          showErrorToast(message);
        })(),
      );
    },
    getRentalKit: () => rentalKit,
    getProvidedCrew: () =>
      quoteConfig.billingMode === 'driver-rental' ? economicCrew : movingEstimateCrew,
    onQuoteSaved: async (booking) => {
      const savedQuote = latestBookingQuote(booking);
      if (!savedQuote) {
        whatsappWindow.current?.close();
        whatsappWindow.current = null;
        sendWhatsAppAfterSave.current = false;
        return;
      }
      const whatsappRequested = sendWhatsAppAfterSave.current;
      showSuccessToast(`Devis ${booking.reference} enregistré.`);
      if (sendWhatsAppAfterSave.current) {
        sendWhatsAppAfterSave.current = false;
        const href = quoteNotificationUrl(
          booking,
          savedQuote,
          booking.pricingSettings ?? appCatalogue?.settings,
        );
        if (whatsappWindow.current) whatsappWindow.current.location.replace(href);
        else window.location.assign(href);
        whatsappWindow.current = null;
        showSuccessToast('Devis ouvert dans WhatsApp. Vérifiez le destinataire avant l’envoi.');
      }
      void (async () => {
        try {
          const settings = booking.pricingSettings ?? appCatalogue?.settings;
          if (settings) {
            const blob = await exportQuote(booking, savedQuote, settings);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = quotePdfFilename(savedQuote, booking.reference);
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
            showSuccessToast(
              whatsappRequested
                ? `Devis ${booking.reference} enregistré, PDF téléchargé et WhatsApp ouvert. Vérifiez le destinataire avant l’envoi.`
                : `PDF du devis ${booking.reference} téléchargé.`,
            );
          }
        } catch {
          const message = 'Le devis est enregistré, mais le PDF n’a pas pu être téléchargé.';
          setPdfError(message);
          showErrorToast(message);
        }
      })();
      if (savedQuote.kind !== 'final') return;
      try {
        const entries = await api.accountingEntries();
        return quoteAccountingConfirmation(booking, savedQuote, entries);
      } catch {
        return `Devis final ${savedQuote.reference} enregistré. Consultez la comptabilité pour vérifier son journal.`;
      }
    },
  });
  const editingLocked = adminQuoteIsLocked(state.editingBooking);
  const editingBooking = state.editingBooking;
  const latestSavedQuote = editingBooking ? latestBookingQuote(editingBooking) : undefined;
  const quoteStageChanged = isQuoteStageChanged(editingBooking, quoteKind);
  const canCommitQuoteStage = canSaveQuoteStageChange(editingBooking, quoteKind);
  const quoteSettings = quoteSettingsForEditing(
    editingBooking?.pricingSettings,
    state.catalogue?.settings,
  );
  const quoteTollPoints = quoteTollPointsWithSavedPrices(appTollPoints, editingBooking);
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
  const quoteVehicle = quoteVehicleWithSavedPrices(selected ?? null, editingBooking);
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
    setQuoteConfig(defaultAdminQuoteConfig());
    setTollLines([]);
    setQuoteKind('provisional');
    setQuestionnaireOpen(false);
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
    setQuoteConfig(defaultAdminQuoteConfig());
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, navigate, setDraft, startNewRequest, user]);
  const canCreateFinal = canCreateFinalQuote(editingBooking, draft.date, Boolean(draft.noDate));
  const canSelectFinal = canCreateFinal;
  function selectQuoteKind(kind: Quote['kind']) {
    if (kind === quoteKind) return;
    setStageError('');
    if (kind === 'final' && !canSelectFinal) {
      const message =
        'Un devis sans date reste provisoire. Choisissez une date pour passer en final.';
      setStageError(message);
      showErrorToast(message);
      return;
    }
    setQuoteKind(kind);
  }
  useEffect(() => {
    if (!state.editingBooking) return;
    const lastQuote = latestBookingQuote(state.editingBooking);
    setQuoteKind(
      state.editingBooking.status === 'completed' ? 'final' : (lastQuote?.kind ?? 'provisional'),
    );
  }, [state.editingBooking]);
  const estimateInventory = useMemo(
    () => quoteEstimateInventory(draft.inventory, draft.questionnaireAnswers),
    [draft.inventory, draft.questionnaireAnswers],
  );
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
    const restored = quoteConfigurationFromBooking(booking);
    setQuoteConfig(restored.config);
    setTollLines(restored.tollLines);
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
  const pricingRoute = useMemo(
    () => routeForQuotePricing(draft.route, draft.distanceKmOverride ?? null),
    [draft.distanceKmOverride, draft.route],
  );
  const labourPrice = labourPriceForQuote(quoteSettings, draft);
  const movingEstimate = useMemo(
    () =>
      estimateAdminQuoteWork({
        inventory: estimateInventory,
        vehicle: selected,
        route: pricingRoute,
        draft,
        config: quoteConfig,
        settings: quoteSettings,
        tollLines,
      }),
    [estimateInventory, selected, pricingRoute, draft, quoteConfig, quoteSettings, tollLines],
  );
  const selectedVehicleId = selected?.id ?? '';
  const movingEstimateVolume = movingEstimate?.volume ?? 0;
  const movingEstimateCrew = movingEstimate?.crew ?? 0;
  const movingEstimateTrips = movingEstimate?.trips ?? 0;
  const automaticEstimateUpdates = automaticQuoteEstimateUpdates({
    config: quoteConfig,
    draft,
    selectedVehicleId,
    estimatedVolume: movingEstimateVolume,
    estimatedCrew: movingEstimateCrew,
    estimatedTrips: movingEstimateTrips,
  });
  const cheaperVehicle = useMemo(
    () =>
      selected
        ? cheaperCompatibleVehicle({
            manualMode: quoteConfig.calcMode === 'manual',
            inventory: estimateInventory,
            current: selected,
            vehicles: catalogue?.vehicles ?? [],
            route: pricingRoute,
            date: draft.date,
            month: draft.month,
            fromAddress: draft.fromAddress,
            toAddress: draft.toAddress,
            startTime: draft.timeSlot,
            hasToll: quoteHasPaidTolls(tollLines),
            settings: quoteSettings,
            estimate: movingEstimate,
            accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
          })
        : null,
    [
      catalogue?.vehicles,
      quoteConfig.calcMode,
      draft.date,
      draft.fromAddress,
      draft.month,
      draft.timeSlot,
      draft.toAddress,
      estimateInventory,
      movingEstimate,
      accountingConfiguration?.overtimeHourlyRate,
      pricingRoute,
      quoteSettings,
      selected,
      tollLines,
    ],
  );
  const readyAnswer = draft.questionnaireAnswers['key-ready'];
  const stairsAnswer = draft.questionnaireAnswers['key-stairs'];
  const inventoryEstimateKey = JSON.stringify({
    ...draft.inventory,
    crew: undefined,
    ready: estimateInventory.ready,
    stairs: estimateInventory.stairs,
  });
  function applyVehicleEstimate(vehicleId: string, trips: number) {
    const vehicle = catalogue?.vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle || !Number.isInteger(trips) || trips < 1) {
      showErrorToast('Cette estimation de véhicule ne peut pas être appliquée.');
      return;
    }
    appliedVehicleEstimate.current =
      quoteConfig.calcMode === 'manual'
        ? null
        : { vehicleId, inventoryKey: inventoryEstimateKey, trips };
    setDraft((current) => ({ ...current, vehicleId, estimatedTrips: trips }));
    setQuoteConfig((current) => ({ ...current, trips }));
    showSuccessToast(
      `${vehicle.shortName || vehicle.name} sélectionné : ${trips} aller${trips > 1 ? 's' : ''}-retour${trips > 1 ? 's' : ''} appliqué${trips > 1 ? 's' : ''} au devis.`,
    );
  }
  useEffect(() => {
    const estimatedLabour = automaticEstimateUpdates.labour;
    const estimatedTrips = automaticEstimateUpdates.trips;
    if (estimatedLabour !== null)
      setDraft((current) =>
        current.options.labour === estimatedLabour
          ? current
          : { ...current, options: { ...current.options, labour: estimatedLabour } },
      );
    const keepAppliedVehicleEstimate = shouldPreserveAppliedVehicleEstimate({
      applied: appliedVehicleEstimate.current,
      selectedVehicleId,
      inventoryKey: inventoryEstimateKey,
      configuredTrips: quoteConfig.trips,
    });
    if (appliedVehicleEstimate.current && !keepAppliedVehicleEstimate)
      appliedVehicleEstimate.current = null;
    if (estimatedTrips !== null && !keepAppliedVehicleEstimate)
      setQuoteConfig((current) =>
        current.trips === estimatedTrips ? current : { ...current, trips: estimatedTrips },
      );
  }, [
    automaticEstimateUpdates.labour,
    automaticEstimateUpdates.trips,
    quoteConfig.trips,
    inventoryEstimateKey,
    selectedVehicleId,
    readyAnswer,
    stairsAnswer,
    draft.timeSlot,
    setDraft,
  ]);
  const configuredQuestions = catalogue?.settings.questionnaire;
  const questionnaire = configuredQuestions?.length ? configuredQuestions : defaultClientQuestions;
  const inventoryCount = inventoryItemCount(draft.inventory);
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
  const questionnaireText = quoteQuestionnaireSummary(questionnaire, draft.questionnaireAnswers);
  const totalTolls = totalTollCost(tollLines);
  const quoteDate = quoteDateLabel(draft.date, draft.month);
  const businessPhone = catalogue?.settings.businessPhone ?? '';
  const { digits: businessPhoneDigits, display: displayBusinessPhone } =
    businessPhonePresentation(businessPhone);
  const rentalKitNeeds = useMemo(
    () =>
      selected
        ? referenceRentalKitNeeds(estimateInventory, selected, quoteSettings?.movingLaborPlanning)
        : null,
    [estimateInventory, selected, quoteSettings?.movingLaborPlanning],
  );
  const taxiCompanyApproach = useCompanyApproachDistance(
    quoteSettings?.businessLatitude,
    quoteSettings?.businessLongitude,
    draft.route?.from,
  );
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
    applySnapshotLabourPrice: Boolean(
      editingBooking?.pricingSnapshot || latestSavedQuote?.pricingInput?.taxiFeeAmount,
    ),
    simulationNeeds: rentalKitNeeds,
    taxiPickupDistanceKm: taxiCompanyApproach.distanceKm,
    savedCustomLines: latestSavedQuote?.pricingInput?.customLines,
    accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
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
      applySnapshotLabourPrice: Boolean(
        editingBooking?.pricingSnapshot || latestSavedQuote?.pricingInput?.taxiFeeAmount,
      ),
      simulationNeeds: rentalKitNeeds,
      taxiPickupDistanceKm: taxiCompanyApproach.distanceKm,
      savedCustomLines: latestSavedQuote?.pricingInput?.customLines,
      accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
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
      applySnapshotLabourPrice: Boolean(
        editingBooking?.pricingSnapshot || latestSavedQuote?.pricingInput?.taxiFeeAmount,
      ),
      simulationNeeds: rentalKitNeeds,
      taxiPickupDistanceKm: taxiCompanyApproach.distanceKm,
      savedCustomLines: latestSavedQuote?.pricingInput?.customLines,
      accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
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
      applySnapshotLabourPrice: Boolean(
        editingBooking?.pricingSnapshot || latestSavedQuote?.pricingInput?.taxiFeeAmount,
      ),
      simulationNeeds: rentalKitNeeds,
      taxiPickupDistanceKm: taxiCompanyApproach.distanceKm,
      savedCustomLines: latestSavedQuote?.pricingInput?.customLines,
      accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
    }).total,
  };
  const economicMovingEstimate = useMemo(
    () =>
      selected
        ? estimateAdminQuoteWork({
            inventory: estimateInventory,
            vehicle: selected,
            route: pricingRoute,
            draft,
            config: {
              ...quoteConfig,
              billingMode: 'driver-rental',
              menuIncluded: false,
              overtimeMinutes: 0,
            },
            settings: quoteSettings,
            tollLines,
          })
        : null,
    [selected, estimateInventory, pricingRoute, draft, quoteConfig, quoteSettings, tollLines],
  );
  const economicCrew = economicMovingEstimate?.crew ?? movingEstimateCrew;
  const hasBillableQuoteContent = Boolean(
    editingBooking ||
    draft.route ||
    inventoryCount > 0 ||
    Object.values(draft.options).some((quantity) => quantity > 0) ||
    tollLines.some((line) => line.quantity > 0) ||
    (quoteConfig.customLines ?? []).some(
      (line) => line.label.trim() && line.quantity > 0 && line.unitPrice > 0,
    ) ||
    (estimateInventory.stairs === 'balcon' && Number(estimateInventory.balcPx) > 0) ||
    (quoteConfig.billingMode === 'driver-rental' && (quoteConfig.overtimeMinutes ?? 0) > 0),
  );
  const grossMargin = quoteGrossMargin({
    quoteTotal: hasBillableQuoteContent ? preview.total : null,
    hasBillableContent: hasBillableQuoteContent,
    inventory: draft.inventory,
    accounting: accountingConfiguration,
    billingMode: quoteConfig.billingMode,
    providedCrew:
      editingBooking?.crew?.manoeuvre.length ||
      (quoteConfig.billingMode === 'driver-rental' ? economicCrew : movingEstimateCrew),
    manoeuvreCount: preview.previewLines
      .filter((line) => /man[œo]uvre/iu.test(line.label) && !/heures au-delà/iu.test(line.label))
      .reduce((sum, line) => sum + line.quantity, 0),
    taxiCharges: preview.taxiFeeLines.reduce((sum, line) => sum + line.total, 0),
    nightWorkCharge: preview.manoeuvreOvertime
      ? Math.round(preview.manoeuvreOvertime.quantity * preview.manoeuvreOvertime.unitPrice)
      : 0,
  });
  const {
    tier: previewTier,
    rentalKit,
    rentalOvertimeAmount,
    taxiFeeLines,
    taxiCrew,
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
  const trafficDetails = selected
    ? referenceTrafficDetails({
        distanceKm: effectiveDistance ?? 0,
        startTime: draft.timeSlot,
        date: draft.date || undefined,
        month: draft.month,
        from: draft.fromAddress,
        to: draft.toAddress,
        hasToll: tollLines.some((line) => line.quantity * line.unitPrice > 0),
        ignoreTraffic: quoteConfig.trafficOff,
        manualMinutes: quoteConfig.calcMode === 'manual' ? quoteConfig.legMinutes : 0,
        vehicleId: selected.id,
      })
    : null;
  const estimatedTravelMinutes = trafficDetails?.minutes ?? 0;
  const freeTravelMinutes = trafficDetails?.freeMinutes ?? 0;
  const trafficCoefficient = trafficDetails?.coefficient ?? 0;
  const availableMenuLines = preview.availableMenuLines;
  const menuIncluded = preview.menuIncluded;
  const savedQuote = editingBooking
    ? latestQuoteOfKind(editingBooking.quotes, quoteKind)
    : undefined;
  const journalKey =
    quoteKind === 'final' &&
    editingBooking?.status === 'completed' &&
    latestSavedQuote?.kind === 'final'
      ? `${editingBooking.id}:${editingBooking.version}:${latestSavedQuote.id}`
      : null;
  useEffect(() => {
    if (!journalKey || user?.role !== 'admin') return;
    let active = true;
    void api
      .accountingEntries()
      .then((entries) => {
        if (active) setJournalSnapshot({ key: journalKey, entries });
      })
      .catch(() => {
        if (active) setJournalSnapshot({ key: journalKey, entries: null });
      });
    return () => {
      active = false;
    };
  }, [api, journalKey, user?.role]);
  const journalEntries =
    journalKey && journalSnapshot?.key === journalKey ? journalSnapshot.entries : null;
  const quoteJournalRows =
    editingBooking && savedQuote && journalEntries
      ? quoteAccountingJournalRows(editingBooking, savedQuote, journalEntries)
      : [];
  const {
    canSendQuoteWhatsApp,
    reminderDays,
    reminderWhen,
    reminderCanSend,
    reminderDisabledReason,
    reminderHref,
    balconyPrice,
  } = quoteReminder({
    draft,
    booking: editingBooking,
    settings: catalogue?.settings,
    inventory: estimateInventory,
    billingMode: quoteConfig.billingMode,
  });
  function sendCurrentQuoteOnWhatsApp() {
    if (editingLocked && editingBooking && savedQuote?.kind === 'final') {
      if (!canSendQuoteWhatsApp) {
        const message = 'Numéro WhatsApp du client invalide.';
        setStageError(message);
        showErrorToast(message);
        setOpenQuoteSections((current) => ({ ...current, client: true }));
        return;
      }
      const whatsappTab = window.open('about:blank', '_blank');
      if (!whatsappTab) {
        const message = 'Autorisez les fenêtres pour ouvrir WhatsApp.';
        setStageError(message);
        showErrorToast(message);
        return;
      }
      setStageError('');
      const href = quoteNotificationUrl(
        editingBooking,
        savedQuote,
        editingBooking.pricingSettings ?? catalogue?.settings,
      );
      let pdfDownloaded = false;
      void (async () => {
        try {
          const settings = editingBooking.pricingSettings ?? catalogue?.settings;
          if (!settings) throw new Error('Paramètres PDF indisponibles.');
          const blob = await exportQuote(editingBooking, savedQuote, settings);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = quotePdfFilename(savedQuote, editingBooking.reference);
          document.body.append(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30000);
          pdfDownloaded = true;
        } catch {
          const message =
            'Le PDF n’a pas pu être téléchargé, mais le message WhatsApp va s’ouvrir.';
          setPdfError(message);
          showErrorToast(message);
        } finally {
          whatsappTab.location.replace(href);
          if (pdfDownloaded)
            showSuccessToast(
              'PDF téléchargé et devis ouvert dans WhatsApp. Vérifiez le destinataire avant l’envoi.',
            );
        }
      })();
      return;
    }
    startQuoteWhatsAppSubmission({
      canSendQuoteWhatsApp,
      quoteKind,
      stairs: estimateInventory.stairs,
      balconyPrice,
      previewTier,
      customPrice: quoteConfig.customPrice,
      maximumDistance: bounds[2],
      draft,
      setStageError,
      showErrorToast,
      openClientSection: () => setOpenQuoteSections((current) => ({ ...current, client: true })),
      whatsappWindow,
      sendWhatsAppAfterSave,
    });
  }
  async function downloadCurrentQuote() {
    const pdfSettings = quoteSettings ?? catalogue?.settings;
    if (!pdfSettings || !selected) {
      const message =
        'Sélectionnez un véhicule et attendez le chargement des paramètres avant de télécharger le PDF.';
      setPdfError(message);
      showErrorToast(message);
      return;
    }
    setPdfError('');
    try {
      const pdfDocument = buildAdminQuotePdfDocument({
        now: new Date().toISOString(),
        booking: editingBooking,
        draft,
        vehicle: selected,
        settings: pdfSettings,
        quoteKind,
        savedQuote,
        config: quoteConfig,
        lines: previewLines,
        total: previewTotal,
        subtotal: previewSubtotal,
        discount: previewDiscount,
        discountLabel: previewDiscountLabel,
        tier: previewTier,
        estimateInventory,
        estimate: movingEstimate,
        providedCrew:
          quoteConfig.billingMode === 'driver-rental' ? economicCrew : movingEstimateCrew,
        visibleInventoryText,
        estimateText,
        questionnaireText,
        rentalKit,
        tolls: tollLines,
        effectiveDistance,
      });
      const blob = await exportQuote(pdfDocument.booking, pdfDocument.quote, pdfSettings);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfDocument.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      showSuccessToast(`PDF du devis ${pdfDocument.booking.reference} téléchargé.`);
    } catch (cause) {
      const message = errorMessage(cause);
      setPdfError(message);
      showErrorToast(message);
    }
  }
  const onTollToggle = (line: (typeof tollLines)[number], checked: boolean) =>
    setTollLines((current) => toggleQuoteToll(current, line, checked));
  const changeQuoteOption = (key: keyof Options, delta: number) => {
    if (key !== 'labour') {
      option(key, delta);
      return;
    }
    setDraft((current) =>
      changedQuoteLaborDraft(
        current,
        delta,
        quoteSettings?.maxOptions ?? 20,
        Boolean(movingEstimate?.volume),
      ),
    );
    setQuoteConfig((current) => ({ ...current, calcMode: 'manual' }));
  };

  async function confirmVehicleFit() {
    const warnings = adminQuoteVehicleFitWarnings({
      manualMode: quoteConfig.calcMode === 'manual',
      inventory: estimateInventory,
      vehicle: selected ?? null,
      settings: quoteSettings ?? catalogue?.settings,
    });
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
      showSuccessToast('Tarifs actuels appliqués à la réservation.');
    } catch (reason) {
      const message = errorMessage(reason);
      setPricingSnapshotError(message);
      showErrorToast(message);
    } finally {
      setPricingSnapshotBusy(false);
    }
  }

  const contactCard = quoteContactCard(
    draft,
    editingBooking?.reference,
    selected ?? undefined,
    catalogue?.settings,
  );

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
    selectQuoteKind,
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
    cancelPendingWhatsApp,
    openQuoteSections,
    setOpenQuoteSections,
    clientProfiles,
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
    quoteStageChanged,
    canCommitQuoteStage,
    latestSavedQuote,
    grossMargin,
    editingBooking,
    quoteSettings,
    accountingConfiguration,
    contactCard,
    quoteTollPoints,
    catalogue,
    loading,
    error,
    reload,
    draft,
    setDraft,
    applyVehicleEstimate,
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
    canSelectFinal,
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
    economicCrew,
    rentalKitNeeds,
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
    taxiCompanyApproachDistanceKm: taxiCompanyApproach.distanceKm,
    taxiCompanyApproachBusy: taxiCompanyApproach.busy,
    taxiCompanyApproachError: taxiCompanyApproach.error,
    estimatedTravelMinutes,
    freeTravelMinutes,
    trafficCoefficient,
    trafficFactors: trafficDetails?.factors ?? [],
    previewTier,
    availableMenuLines,
    menuIncluded,
    previewLines,
    rentalKit,
    rentalOvertimeAmount,
    taxiFeeLines,
    taxiCrew,
    manoeuvreOvertimeLine: manoeuvreOvertime,
    previewSubtotal,
    previewDiscount,
    previewDiscountLabel,
    previewTotal,
    formulaPrices,
    savedQuote,
    quoteJournalRows,
    quoteJournalLoading: Boolean(journalKey && journalSnapshot?.key !== journalKey),
    quoteJournalError: Boolean(
      journalKey && journalSnapshot?.key === journalKey && !journalEntries,
    ),
    canSendQuoteWhatsApp,
    reminderDays,
    reminderWhen,
    reminderCanSend,
    reminderDisabledReason,
    reminderHref,
    sendCurrentQuoteOnWhatsApp,
    downloadCurrentQuote,
    onTollToggle,
    changeQuoteOption,
    toggleQuoteSection,
    trafficDuration,
  };
}
