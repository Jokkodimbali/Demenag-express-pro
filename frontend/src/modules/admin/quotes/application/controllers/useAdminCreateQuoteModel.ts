import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBookingForm } from '../../../../booking/application/controllers/useBookingForm';
import { useApp } from '../../../../shared/application/context';
import { blankDraft } from '../../../../booking/application/booking-draft';
import { useBookingCommands } from '../../../../booking/application/controllers/useBookingCommands';
import {
  readAdminQuoteDraft,
  saveAdminQuoteDraft,
  clearAdminQuoteDraft,
  type AdminQuoteDraft,
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
  Driver,
  Options,
  Quote,
} from '../../../../shared/domain/model';
import { defaultClientQuestions } from '../../../../booking/domain/questionnaire';
import { quoteNotificationUrl } from '../services/quote-notification';
import { createAdminQuotePreview } from '../services/admin-quote-preview';
import { replaceSavedCustomLines } from '../../../../../../../shared/quote-custom-lines.js';
import {
  consolidateDuplicateQuoteLines,
  isAssemblyServiceLine,
} from '../../../../../../../shared/quote-lines.js';
import { quoteGrossMarginForDisplayedPrice } from '../services/quote-gross-margin';
import { isQuotePricePending } from '../../../../../../../shared/quote-price-status.js';
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
  persistedVehicleEstimate,
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
  quoteInventoryEstimateKey,
  quoteQuestionnaireSummary,
  quoteSettingsForEditing,
  shouldAutomaticallyEnableTaxiFees,
  taxiFeeAmountFromSavedQuote,
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
  const draftLocationKey = `${location.pathname}${location.search}`;
  const previousDraftLocationKey = useRef(draftLocationKey);
  const initialClient = (
    location.state as {
      initialClient?: { name: string; phone: string; address: string };
    } | null
  )?.initialClient;
  const calendarAppointment = (
    location.state as { calendarAppointment?: { date: string; time: string } } | null
  )?.calendarAppointment;
  const resetQuoteToken = (location.state as { resetQuote?: string } | null)?.resetQuote;
  const editSearchParams = new URLSearchParams(location.search);
  const editingReservation = editSearchParams.has('modifier') || editSearchParams.has('archive');
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
  const latestAdminQuoteDraft = useRef<AdminQuoteDraft | null>(null);
  const persistAdminQuoteDraftOnExit = useRef(false);
  const appliedVehicleEstimate = useRef<AppliedVehicleEstimate | null>(null);
  const automaticTaxiAlertShown = useRef(false);
  const [quoteConfig, setQuoteConfig] = useState<AdminQuoteConfig>(defaultAdminQuoteConfig);
  const [quoteEditedSinceSaved, setQuoteEditedSinceSaved] = useState(false);
  const [quoteEditScope, setQuoteEditScope] = useState<'none' | 'custom' | 'other'>('none');
  const [restoredQuoteConfigurationKey, setRestoredQuoteConfigurationKey] = useState('');
  const [accountingConfiguration, setAccountingConfiguration] =
    useState<AccountingFinanceConfiguration | null>(null);
  const [manoeuvreEmployees, setManoeuvreEmployees] = useState<Driver[]>([]);
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
  useEffect(() => {
    if (publicRequest || user?.role !== 'admin') {
      setManoeuvreEmployees([]);
      return;
    }
    let active = true;
    void api
      .drivers()
      .then((employees) => {
        if (active)
          setManoeuvreEmployees(
            employees.filter((employee) => employee.active && employee.role === 'manoeuvre'),
          );
      })
      .catch(() => {
        if (active) setManoeuvreEmployees([]);
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
      persistAdminQuoteDraftOnExit.current = false;
      void clearAdminQuoteDraft(api);
    },
    onQuoteStageUpdated: async (booking, previousBooking) => {
      const savedQuote = latestBookingQuote(booking);
      if (!savedQuote) return;
      setQuoteEditedSinceSaved(false);
      setQuoteEditScope('none');
      setQuoteKind(savedQuote.kind);
      showSuccessToast(
        savedQuote.kind === 'final'
          ? visibleUiText.quoteStageFinalNotice
          : visibleUiText.quoteStageProvisionalNotice,
      );
      const updated = await reassignTeamsAfterScheduleChange(api, booking, previousBooking, () =>
        (() => {
          const message =
            'Le devis a changé d’étape, mais la réaffectation automatique de l’équipe n’a pas abouti. Vérifiez le planning.';
          setStageError(message);
          showErrorToast(message);
        })(),
      );
      if (sendWhatsAppAfterSave.current) {
        sendWhatsAppAfterSave.current = false;
        const sharedBooking = updated ?? booking;
        const sharedQuote = latestBookingQuote(sharedBooking) ?? savedQuote;
        const href = quoteNotificationUrl(
          sharedBooking,
          sharedQuote,
          sharedBooking.pricingSettings ?? appCatalogue?.settings,
        );
        try {
          const settings = sharedBooking.pricingSettings ?? appCatalogue?.settings;
          if (!settings) throw new Error('Paramètres PDF indisponibles.');
          const blob = await exportQuote(sharedBooking, sharedQuote, settings);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = quotePdfFilename(sharedQuote, sharedBooking.reference);
          document.body.append(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch {
          showErrorToast('Le devis est enregistré, mais le PDF n’a pas pu être téléchargé.');
        } finally {
          if (whatsappWindow.current) whatsappWindow.current.location.replace(href);
          else window.location.assign(href);
          whatsappWindow.current = null;
          showSuccessToast(
            'Devis enregistré et ouvert dans WhatsApp. Vérifiez le destinataire avant l’envoi.',
          );
        }
      }
      return updated;
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
  const editingBooking = editingReservation && !resetAdminQuote ? state.editingBooking : null;
  const editingLocked =
    (editingReservation && state.archivedBooking) || adminQuoteIsLocked(editingBooking);
  const latestSavedQuote = editingBooking ? latestBookingQuote(editingBooking) : undefined;
  const currentSavedQuoteKey = editingBooking
    ? `${editingBooking.id}:${latestSavedQuote?.id ?? ''}`
    : '';
  const quoteConfigurationReady =
    !currentSavedQuoteKey || restoredQuoteConfigurationKey === currentSavedQuoteKey;
  useEffect(() => {
    setQuoteEditedSinceSaved(false);
    setQuoteEditScope('none');
  }, [currentSavedQuoteKey]);
  const quoteStageChanged = isQuoteStageChanged(editingBooking, quoteKind);
  const canCommitQuoteStage = canSaveQuoteStageChange(editingBooking, quoteKind);
  const savedQuoteSnapshot =
    latestSavedQuote && !quoteEditedSinceSaved ? latestSavedQuote : undefined;
  const customOnlyPrice =
    latestSavedQuote && quoteEditedSinceSaved && quoteEditScope === 'custom'
      ? replaceSavedCustomLines(
          latestSavedQuote.price,
          latestSavedQuote.pricingInput?.customLines ?? [],
          quoteConfig.customLines.filter(
            (line) =>
              quoteConfig.billingMode === 'complete' ||
              (quoteConfig.billingMode === 'driver-rental' && quoteConfig.menuIncluded) ||
              !isAssemblyServiceLine(line.label),
          ),
        )
      : null;
  const preservedTaxiFeeAmount =
    savedQuoteSnapshot || customOnlyPrice ? taxiFeeAmountFromSavedQuote(latestSavedQuote) : null;
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
  useLayoutEffect(() => {
    latestAdminQuoteDraft.current = { draft, quoteConfig, tollLines, quoteKind };
  }, [draft, quoteConfig, quoteKind, tollLines]);
  useEffect(
    () => () => {
      const value = latestAdminQuoteDraft.current;
      if (!persistAdminQuoteDraftOnExit.current || !value) return;
      draftSaveQueue.current = draftSaveQueue.current.then(() => saveAdminQuoteDraft(api, value));
    },
    [api],
  );
  const setQuoteDraftFromUser = useCallback(
    (update: Parameters<typeof setDraft>[0]) => {
      setQuoteEditedSinceSaved(true);
      setQuoteEditScope('other');
      persistAdminQuoteDraftOnExit.current = true;
      setDraft(update);
    },
    [setDraft],
  );
  const setQuoteConfigFromUser = useCallback(
    (update: Parameters<typeof setQuoteConfig>[0]) => {
      setQuoteEditedSinceSaved(true);
      setQuoteEditScope('other');
      persistAdminQuoteDraftOnExit.current = true;
      setQuoteConfig(update);
    },
    [setQuoteConfig],
  );
  const setCustomLinesFromUser = useCallback(
    (update: Parameters<typeof setQuoteConfig>[0]) => {
      setQuoteEditedSinceSaved(true);
      setQuoteEditScope((scope) => (scope === 'other' ? 'other' : 'custom'));
      persistAdminQuoteDraftOnExit.current = true;
      setQuoteConfig(update);
    },
    [setQuoteConfig],
  );
  const setTaxiConfigFromUser = useCallback(
    (update: Parameters<typeof setQuoteConfig>[0]) => {
      automaticTaxiAlertShown.current = true;
      setQuoteConfigFromUser(update);
    },
    [setQuoteConfigFromUser],
  );
  const setQuoteTollLinesFromUser = useCallback(
    (update: Parameters<typeof setTollLines>[0]) => {
      setQuoteEditedSinceSaved(true);
      setQuoteEditScope('other');
      persistAdminQuoteDraftOnExit.current = true;
      setTollLines(update);
    },
    [setTollLines],
  );
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
  useLayoutEffect(() => {
    if (!resetAdminQuote || !resetQuoteToken) return;
    let active = true;
    persistAdminQuoteDraftOnExit.current = false;
    appliedVehicleEstimate.current = null;
    setDraft(blankDraft(appCatalogue ?? undefined));
    setQuoteConfig(defaultAdminQuoteConfig());
    setQuoteEditedSinceSaved(false);
    setQuoteEditScope('none');
    setRestoredQuoteConfigurationKey('');
    setTollLines([]);
    setQuoteKind('provisional');
    setQuestionnaireOpen(false);
    setStageError('');
    setPdfError('');
    setReminderNotice('');
    setOpenQuoteSections({ client: true, route: false, tolls: false, options: false });
    setResetVersion((current) => current + 1);
    window.scrollTo({ top: 0 });
    void clearAdminQuoteDraft(api).then((cleared) => {
      if (!active) return;
      if (!cleared) {
        showErrorToast(
          'Le nouveau devis est vide, mais l’ancien brouillon n’a pas pu être effacé.',
        );
        return;
      }
      navigate(location.pathname, { replace: true, state: null });
    });
    return () => {
      active = false;
    };
  }, [
    api,
    appCatalogue,
    location.pathname,
    navigate,
    resetAdminQuote,
    resetQuoteToken,
    setDraft,
    setTollLines,
    showErrorToast,
  ]);
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
    persistAdminQuoteDraftOnExit.current = true;
    setQuoteKind(kind);
  }
  useEffect(() => {
    if (!editingReservation || resetAdminQuote || !state.editingBooking) return;
    const lastQuote = latestBookingQuote(state.editingBooking);
    setQuoteKind(
      state.editingBooking.status === 'completed' ? 'final' : (lastQuote?.kind ?? 'provisional'),
    );
  }, [editingReservation, resetAdminQuote, state.editingBooking]);
  const estimateInventory = useMemo(
    () => quoteEstimateInventory(draft.inventory, draft.questionnaireAnswers),
    [draft.inventory, draft.questionnaireAnswers],
  );
  useEffect(() => {
    if (
      editingReservation ||
      publicRequest ||
      resetAdminQuote ||
      initialClient ||
      user?.role !== 'admin'
    ) {
      restoredDraft.current = true;
      skipInitialSave.current = true;
      return;
    }
    let active = true;
    void readAdminQuoteDraft(api).then((saved) => {
      if (!active) return;
      if (saved) {
        appliedVehicleEstimate.current = persistedVehicleEstimate(
          saved.draft.vehicleId,
          quoteInventoryEstimateKey(saved.draft),
          saved.quoteConfig,
        );
        setDraft(saved.draft);
        setQuoteConfig(saved.quoteConfig);
        setTollLines(saved.tollLines);
        setQuoteKind(saved.quoteKind ?? 'provisional');
      }
      restoredDraft.current = true;
      skipInitialSave.current = true;
    });
    return () => {
      active = false;
    };
  }, [
    api,
    editingReservation,
    initialClient,
    publicRequest,
    resetAdminQuote,
    setDraft,
    setTollLines,
    user?.role,
  ]);

  useEffect(() => {
    if (!initialClient) return;
    persistAdminQuoteDraftOnExit.current = true;
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
    persistAdminQuoteDraftOnExit.current = true;
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
    if (publicRequest || editingReservation || user?.role !== 'admin') return;
    if (!restoredDraft.current) return;
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }
    persistAdminQuoteDraftOnExit.current = true;
    const timeout = window.setTimeout(() => {
      const value = { draft, quoteConfig, tollLines, quoteKind };
      draftSaveQueue.current = draftSaveQueue.current.then(() => saveAdminQuoteDraft(api, value));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    api,
    draft,
    editingReservation,
    publicRequest,
    quoteConfig,
    quoteKind,
    tollLines,
    user?.role,
  ]);

  useEffect(() => {
    if (previousDraftLocationKey.current !== draftLocationKey) {
      const value = latestAdminQuoteDraft.current;
      if (persistAdminQuoteDraftOnExit.current && value)
        draftSaveQueue.current = draftSaveQueue.current.then(() => saveAdminQuoteDraft(api, value));
      previousDraftLocationKey.current = draftLocationKey;
    }
  }, [api, draftLocationKey]);

  useEffect(() => {
    if (!publicRequest || !user) return;
    setDraft((current) => ({
      ...current,
      customerName: current.customerName || user.name || '',
      customerPhone: current.customerPhone || user.phone || '',
    }));
  }, [publicRequest, setDraft, user]);
  useEffect(() => {
    const booking = editingReservation && !resetAdminQuote ? state.editingBooking : null;
    if (!booking) {
      if (editingReservation || resetAdminQuote) {
        setRestoredQuoteConfigurationKey('');
        appliedVehicleEstimate.current = null;
      }
      return;
    }
    if (
      draft.vehicleId !== booking.vehicle.id ||
      draft.customerPhone !== booking.phone ||
      draft.fromAddress !== booking.fromAddress ||
      draft.toAddress !== booking.toAddress
    )
      return;
    const savedQuote = latestBookingQuote(booking);
    const key = `${booking.id}:${savedQuote?.id ?? ''}`;
    if (restoredQuoteConfigurationKey === key) return;
    const restored = quoteConfigurationFromBooking(booking);
    setQuoteConfig(restored.config);
    setTollLines(restored.tollLines);
    appliedVehicleEstimate.current = savedQuote
      ? persistedVehicleEstimate(
          booking.vehicle.id,
          quoteInventoryEstimateKey(draft),
          restored.config,
        )
      : null;
    setRestoredQuoteConfigurationKey(key);
  }, [
    draft,
    editingReservation,
    resetAdminQuote,
    restoredQuoteConfigurationKey,
    setTollLines,
    state.editingBooking,
  ]);
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
  const inventoryEstimateKey = quoteInventoryEstimateKey(draft);
  const preserveAppliedVehicleEstimate = shouldPreserveAppliedVehicleEstimate({
    applied: appliedVehicleEstimate.current,
    selectedVehicleId,
    inventoryKey: inventoryEstimateKey,
    configuredTrips: quoteConfig.trips,
  });
  const pricingQuoteConfig =
    quoteConfig.calcMode === 'auto' &&
    movingEstimateTrips > 0 &&
    quoteConfig.trips !== movingEstimateTrips &&
    !preserveAppliedVehicleEstimate
      ? { ...quoteConfig, trips: movingEstimateTrips }
      : quoteConfig;
  const effectiveQuoteTrips =
    savedQuoteSnapshot?.price.trips ?? customOnlyPrice?.trips ?? pricingQuoteConfig.trips;
  function applyVehicleEstimate(vehicleId: string, trips: number) {
    const vehicle = catalogue?.vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle || !Number.isInteger(trips) || trips < 1) {
      showErrorToast('Cette estimation de véhicule ne peut pas être appliquée.');
      return;
    }
    setQuoteEditedSinceSaved(true);
    setQuoteEditScope('other');
    persistAdminQuoteDraftOnExit.current = true;
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
    if (!quoteConfigurationReady) return;
    const estimatedLabour = automaticEstimateUpdates.labour;
    const estimatedTrips = automaticEstimateUpdates.trips;
    if (estimatedLabour !== null)
      setDraft((current) =>
        current.options.labour === estimatedLabour
          ? current
          : { ...current, options: { ...current.options, labour: estimatedLabour } },
      );
    if (appliedVehicleEstimate.current && !preserveAppliedVehicleEstimate)
      appliedVehicleEstimate.current = null;
    if (estimatedTrips !== null && !preserveAppliedVehicleEstimate)
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
    preserveAppliedVehicleEstimate,
    quoteConfigurationReady,
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
  const effectiveTaxiCompanyApproachDistanceKm =
    !quoteEditedSinceSaved && latestSavedQuote?.pricingInput?.taxiCompanyApproachDistanceKm != null
      ? latestSavedQuote.pricingInput.taxiCompanyApproachDistanceKm
      : taxiCompanyApproach.distanceKm;
  const preview = createAdminQuotePreview({
    draft,
    estimateInventory,
    config: pricingQuoteConfig,
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
    taxiPickupDistanceKm: effectiveTaxiCompanyApproachDistanceKm,
    savedCustomLines: latestSavedQuote?.pricingInput?.customLines,
    accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
  });
  const formulaPrices = {
    economic: createAdminQuotePreview({
      draft,
      estimateInventory,
      config: {
        ...pricingQuoteConfig,
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
      taxiPickupDistanceKm: effectiveTaxiCompanyApproachDistanceKm,
      savedCustomLines: latestSavedQuote?.pricingInput?.customLines,
      accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
    }).total,
    standard: createAdminQuotePreview({
      draft,
      estimateInventory,
      config: { ...pricingQuoteConfig, billingMode: 'standard', overtimeMinutes: 0 },
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
      taxiPickupDistanceKm: effectiveTaxiCompanyApproachDistanceKm,
      savedCustomLines: latestSavedQuote?.pricingInput?.customLines,
      accountingOvertimeHourlyRate: accountingConfiguration?.overtimeHourlyRate,
    }).total,
    complete: createAdminQuotePreview({
      draft,
      estimateInventory,
      config: { ...pricingQuoteConfig, billingMode: 'complete', overtimeMinutes: 0 },
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
      taxiPickupDistanceKm: effectiveTaxiCompanyApproachDistanceKm,
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
  const hasBillableQuoteContent =
    !resetAdminQuote &&
    Boolean(
      (editingReservation && editingBooking) ||
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
  const marginQuoteSnapshot =
    savedQuoteSnapshot ?? (customOnlyPrice ? latestSavedQuote : undefined);
  const marginBillingMode = marginQuoteSnapshot?.billingMode ?? quoteConfig.billingMode;
  const grossMargin = quoteGrossMarginForDisplayedPrice({
    displayedPrice: hasBillableQuoteContent
      ? (savedQuoteSnapshot?.price ?? customOnlyPrice ?? preview.priceSnapshot)
      : null,
    savedQuote: marginQuoteSnapshot,
    fallbackBillingMode: quoteConfig.billingMode,
    hasBillableContent: hasBillableQuoteContent,
    inventory: draft.inventory,
    accounting: accountingConfiguration,
    fallbackProvidedCrew:
      editingBooking?.crew?.manoeuvre.length ||
      (marginBillingMode === 'driver-rental' ? economicCrew : movingEstimateCrew),
    fallbackTaxiCharges: preview.taxiFeeLines.reduce((sum, line) => sum + line.total, 0),
  });
  const {
    tier: calculatedPreviewTier,
    rentalKit,
    rentalOvertimeAmount,
    taxiFeeLines,
    taxiCrew,
    manoeuvreOvertime,
    previewLines: calculatedPreviewLines,
    subtotal: calculatedPreviewSubtotal,
    discount: calculatedPreviewDiscount,
    discountLabel: calculatedPreviewDiscountLabel,
    total: calculatedPreviewTotal,
  } = preview;
  const taxiCompanyLocationConfigured =
    quoteSettings?.businessLatitude != null && quoteSettings.businessLongitude != null;
  const taxiAvailable =
    quoteConfig.billingMode !== 'driver-rental' &&
    taxiCrew > 0 &&
    taxiCompanyLocationConfigured &&
    (effectiveTaxiCompanyApproachDistanceKm != null ||
      quoteConfig.taxiCompanyApproachAmountOverride != null);
  useEffect(() => {
    automaticTaxiAlertShown.current = false;
  }, [resetVersion]);
  useEffect(() => {
    if (
      !shouldAutomaticallyEnableTaxiFees({
        estimatedManoeuvres: taxiCrew,
        isAdminQuote: !publicRequest && user?.role === 'admin',
        taxiFeesEnabled: quoteSettings?.taxiFeeEnabled === true,
        taxiAvailable,
        billingMode: quoteConfig.billingMode,
        editingReservation,
        alreadyEnabled: quoteConfig.taxiFeeApplied,
        alreadyPrompted: automaticTaxiAlertShown.current,
      })
    )
      return;

    automaticTaxiAlertShown.current = true;
    setQuoteConfigFromUser((current) => ({ ...current, taxiFeeApplied: true }));
    showSuccessToast(
      `Frais taxi activés automatiquement : ${taxiCrew} manœuvres estimées. Le montant est ajouté au devis.`,
      undefined,
      { persistent: true, toastKey: 'admin-quote-taxi-auto-enabled' },
    );
  }, [
    editingReservation,
    publicRequest,
    quoteConfig.billingMode,
    quoteConfig.taxiCompanyApproachAmountOverride,
    quoteConfig.taxiFeeApplied,
    quoteSettings?.businessLatitude,
    quoteSettings?.businessLongitude,
    quoteSettings?.taxiFeeEnabled,
    resetVersion,
    setQuoteConfigFromUser,
    showSuccessToast,
    taxiAvailable,
    effectiveTaxiCompanyApproachDistanceKm,
    taxiCrew,
    user?.role,
  ]);
  const previewLines = savedQuoteSnapshot
    ? consolidateDuplicateQuoteLines(savedQuoteSnapshot.price.lines)
    : customOnlyPrice
      ? customOnlyPrice.lines
      : hasBillableQuoteContent && !resetAdminQuote
        ? calculatedPreviewLines
        : [];
  const previewSubtotal = savedQuoteSnapshot
    ? (savedQuoteSnapshot.price.total ?? 0) + savedQuoteSnapshot.price.discount
    : customOnlyPrice
      ? (customOnlyPrice.total ?? 0) + customOnlyPrice.discount
      : hasBillableQuoteContent && !resetAdminQuote
        ? calculatedPreviewSubtotal
        : 0;
  const previewDiscount = savedQuoteSnapshot
    ? savedQuoteSnapshot.price.discount
    : customOnlyPrice
      ? customOnlyPrice.discount
      : hasBillableQuoteContent && !resetAdminQuote
        ? calculatedPreviewDiscount
        : 0;
  const previewDiscountLabel = savedQuoteSnapshot
    ? (savedQuoteSnapshot.price.discountLabel ?? '')
    : customOnlyPrice
      ? (customOnlyPrice.discountLabel ?? '')
      : hasBillableQuoteContent && !resetAdminQuote
        ? calculatedPreviewDiscountLabel
        : '';
  const previewTotal = savedQuoteSnapshot
    ? isQuotePricePending(savedQuoteSnapshot.price)
      ? null
      : savedQuoteSnapshot.price.total
    : customOnlyPrice
      ? isQuotePricePending(customOnlyPrice)
        ? null
        : customOnlyPrice.total
      : hasBillableQuoteContent && !resetAdminQuote
        ? calculatedPreviewTotal
        : null;
  const previewTier =
    savedQuoteSnapshot?.price.tier ?? customOnlyPrice?.tier ?? calculatedPreviewTier;
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
    if (editingBooking && savedQuote && savedQuoteSnapshot?.id === savedQuote.id) {
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
      openRouteSection: () => {
        setOpenQuoteSections((current) => ({ ...current, route: true }));
      },
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
      const pdfDocument =
        savedQuoteSnapshot &&
        editingBooking &&
        savedQuote &&
        savedQuote.id === savedQuoteSnapshot.id
          ? {
              booking: editingBooking,
              quote: savedQuote,
              filename: quotePdfFilename(savedQuote, editingBooking.reference),
            }
          : buildAdminQuotePdfDocument({
              now: new Date().toISOString(),
              booking: editingBooking,
              draft,
              vehicle: selected,
              settings: pdfSettings,
              quoteKind,
              savedQuote,
              config: pricingQuoteConfig,
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
      const quoteForPdf: Quote = {
        ...pdfDocument.quote,
        price: {
          ...pdfDocument.quote.price,
          lines: previewLines.map((line) => ({ ...line })),
          total: previewTotal,
          discount: previewDiscount,
          discountLabel: previewDiscountLabel,
          tier: previewTier,
          trips: effectiveQuoteTrips,
        },
      };
      const blob = await exportQuote(pdfDocument.booking, quoteForPdf, pdfSettings);
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
  const onTollToggle = (line: (typeof tollLines)[number], checked: boolean) => {
    setQuoteEditedSinceSaved(true);
    setQuoteEditScope('other');
    persistAdminQuoteDraftOnExit.current = true;
    setTollLines((current) => toggleQuoteToll(current, line, checked));
  };
  const changeQuoteOption = (key: keyof Options, delta: number) => {
    setQuoteEditedSinceSaved(true);
    setQuoteEditScope('other');
    persistAdminQuoteDraftOnExit.current = true;
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
    setQuoteEditedSinceSaved(true);
    setQuoteEditScope('other');
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
    resetAdminQuote,
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
    setQuoteConfig: setQuoteConfigFromUser,
    setCustomLines: setCustomLinesFromUser,
    customLinesOnlyEdit: Boolean(customOnlyPrice),
    setTaxiConfig: setTaxiConfigFromUser,
    quoteEditedSinceSaved,
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
    preservedTaxiFeeAmount,
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
    setDraft: setQuoteDraftFromUser,
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
    setTollLines: setQuoteTollLinesFromUser,
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
    effectiveQuoteTrips,
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
    taxiCompanyApproachDistanceKm: effectiveTaxiCompanyApproachDistanceKm,
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
    manoeuvreEmployees,
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
