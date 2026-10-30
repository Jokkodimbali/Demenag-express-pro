import { ChevronDown, Warehouse } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBookingForm } from '../application/useBookingForm';
import { blankDraft, useApp } from '../application/context';
import {
  readAdminQuoteDraft,
  saveAdminQuoteDraft,
  type AdminQuoteConfig,
} from '../application/admin-quote-draft-storage';
import { normalizedClientPhone } from '../application/services/client-summary';
import { CallInventory } from '../components/booking/CallInventory';
import { FleetVehicleImagePreview } from '../components/FleetVehicleDimensions';
import { ClientQuestionnaire } from '../components/booking/ClientQuestionnaire';
import { TollRateSelector } from '../components/TollRateSelector';
import {
  referenceInventoryNote,
  referenceMovingEstimateNote,
} from '../domain/reference-inventory-note';
import { money, referenceTierLabels, today } from '../domain/format';
import {
  assemblyUnitPrice,
  labourUnitPrice,
  labourUnitPriceOverrideFromQuote,
} from '../domain/labour-price';
import { inventoryAssemblyLines, inventoryAssemblyOptions } from '../domain/inventory-assembly';
import { googleTrafficDuration, readGoogleMapsKey } from '../application/google-maps-traffic';
import type { Booking, Options, Price, Quote } from '../domain/model';
import { bookingInventorySnapshot, estimateMovingWork } from '../domain/moving-estimate';
import { defaultClientQuestions } from '../domain/questionnaire';
import { quoteNotificationUrl } from '../application/services/quote-notification';
import { whatsappNumber, whatsappUrl } from '../application/services/whatsapp';
import { BookingConfirmation } from '../components/booking/BookingConfirmation';
import { routes } from '../routing/routes';

const RouteMap = lazy(() => import('../components/RouteMap'));
const trafficDuration = (minutes: number) => {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return hours
    ? `${hours} h${remaining ? ` ${String(remaining).padStart(2, '0')}` : ''}`
    : `${remaining} min`;
};

export function AdminCreateQuote({ publicRequest = false }: { publicRequest?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialClient = (
    location.state as {
      initialClient?: { name: string; phone: string; address: string };
    } | null
  )?.initialClient;
  const editingReservation = new URLSearchParams(location.search).has('modifier');
  const startNewRequest = Boolean(
    publicRequest &&
    !editingReservation &&
    (location.state as { newRequest?: boolean } | null)?.newRequest,
  );
  const requestInitialized = useRef(false);
  const restoredDraft = useRef(false);
  const skipInitialSave = useRef(false);
  const [quoteConfig, setQuoteConfig] = useState<AdminQuoteConfig>({
    trips: 1,
    discount: 0,
    discountType: 'fcfa',
    discountReason: '',
    customPrice: null,
    labourUnitPriceOverride: null,
  });
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const [quoteKind, setQuoteKind] = useState<Quote['kind']>('provisional');
  const [pdfError, setPdfError] = useState('');
  const [stageError, setStageError] = useState('');
  const [reminderNotice, setReminderNotice] = useState('');
  const whatsappWindow = useRef<Window | null>(null);
  const sendWhatsAppAfterSave = useRef(false);
  const [openQuoteSections, setOpenQuoteSections] = useState({
    client: publicRequest,
    route: false,
    tolls: false,
    options: false,
  });
  const [googleMapsKey] = useState(readGoogleMapsKey);
  const [traffic, setTraffic] = useState<{
    minutes: number;
    freeMinutes: number;
    fetchedAt: number;
    future: boolean;
  } | null>(null);
  const [trafficBusy, setTrafficBusy] = useState(false);
  const [trafficError, setTrafficError] = useState(false);
  const trafficRequest = useRef(0);
  const { api, exportQuote, catalogue: appCatalogue, user } = useApp();
  const state = useBookingForm({
    mode: publicRequest && user?.role !== 'admin' ? 'booking' : 'admin-quote',
    quoteConfig,
    quoteKind,
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
        } finally {
          if (whatsappWindow.current) whatsappWindow.current.location.href = href;
          else window.open(href, '_blank', 'noopener,noreferrer');
          whatsappWindow.current = null;
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
      discount: 0,
      discountType: 'fcfa',
      discountReason: '',
      customPrice: null,
      labourUnitPriceOverride: null,
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
    stairs: draft.questionnaireAnswers['key-stairs']?.startsWith('Non')
      ? ('non' as const)
      : draft.questionnaireAnswers['key-stairs']?.startsWith('Oui')
        ? ('oui' as const)
        : draft.questionnaireAnswers['key-stairs']?.startsWith('À vérifier')
          ? ('verif' as const)
          : (draft.inventory.stairs ?? ('' as const)),
  };
  useEffect(() => {
    const saved = editingReservation || publicRequest ? null : readAdminQuoteDraft();
    if (saved) {
      setDraft(saved.draft);
      setQuoteConfig(saved.quoteConfig);
      setTollLines(saved.tollLines);
    }
    restoredDraft.current = true;
    skipInitialSave.current = true;
  }, [editingReservation, publicRequest, setDraft, setTollLines]);

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
    if (!restoredDraft.current) return;
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }
    if (!publicRequest) saveAdminQuoteDraft({ draft, quoteConfig, tollLines });
  }, [draft, publicRequest, quoteConfig, tollLines]);

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
  const inventoryText = referenceInventoryNote(
    estimateInventory,
    draft.fromAddress,
    draft.toAddress,
  );
  const route = draft.route;
  const refreshTraffic = useCallback(async () => {
    if (!googleMapsKey || !route) return;
    const request = ++trafficRequest.current;
    const timeMatch = /^(\d{1,2}):(\d{2})$/u.exec(draft.timeSlot);
    const departure =
      draft.date && timeMatch
        ? new Date(`${draft.date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`)
        : undefined;
    const future = Boolean(departure && departure.getTime() > Date.now() + 60000);
    setTrafficBusy(true);
    setTrafficError(false);
    try {
      const result = await googleTrafficDuration(route.from, route.to, googleMapsKey, departure);
      if (request === trafficRequest.current) {
        setTraffic(
          result
            ? {
                minutes: result.minutes,
                freeMinutes: result.freeMinutes,
                fetchedAt: result.fetchedAt,
                future,
              }
            : null,
        );
        setTrafficError(!result);
      }
    } catch {
      if (request === trafficRequest.current) {
        setTraffic(null);
        setTrafficError(true);
      }
    } finally {
      if (request === trafficRequest.current) setTrafficBusy(false);
    }
  }, [draft.date, draft.timeSlot, googleMapsKey, route]);
  useEffect(() => {
    if (!googleMapsKey || !route) {
      trafficRequest.current++;
      setTraffic(null);
      setTrafficBusy(false);
      setTrafficError(false);
      return;
    }
    setTraffic(null);
    void refreshTraffic();
    const interval = window.setInterval(() => void refreshTraffic(), 300000);
    return () => {
      window.clearInterval(interval);
    };
  }, [googleMapsKey, route, refreshTraffic]);
  const pricingRoute =
    draft.route && draft.distanceKmOverride != null
      ? { ...draft.route, distanceKm: draft.distanceKmOverride }
      : draft.route;
  const trafficDelay = traffic ? traffic.minutes - traffic.freeMinutes : 0;
  const trafficColor = !googleMapsKey
    ? '#6B737B'
    : !traffic
      ? '#AEB4BB'
      : trafficDelay > 15
        ? '#FF5A5F'
        : trafficDelay > 5
          ? '#FFD23F'
          : '#3DDC84';
  const labourPrice = catalogue
    ? labourUnitPrice(catalogue.settings, {
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
        laborPlanning: catalogue?.settings.movingLaborPlanning,
        trafficDurationMinutes: traffic?.minutes,
      })
    : null;
  const selectedVehicleId = selected?.id ?? '';
  const movingEstimateVolume = movingEstimate?.volume ?? 0;
  const movingEstimateCrew = movingEstimate?.crew ?? 0;
  const movingEstimateTrips = movingEstimate?.trips ?? 0;
  const readyAnswer = draft.questionnaireAnswers['key-ready'];
  const stairsAnswer = draft.questionnaireAnswers['key-stairs'];
  const inventoryEstimateKey = JSON.stringify({
    ...draft.inventory,
    crew: undefined,
    ready: estimateInventory.ready,
    stairs: estimateInventory.stairs,
  });
  useEffect(() => {
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
  ]);
  useEffect(() => {
    if (!selectedVehicleId || movingEstimateTrips <= 0) return;
    setQuoteConfig((current) =>
      current.trips === movingEstimateTrips ? current : { ...current, trips: movingEstimateTrips },
    );
  }, [inventoryEstimateKey, selectedVehicleId, movingEstimateTrips]);
  const questionnaire = (catalogue?.settings.questionnaire ?? defaultClientQuestions).map(
    (question) => {
      const legacyLabels: Record<string, string> = {
        floor: 'À quel étage, et y a-t-il un ascenseur, au départ et à l’arrivée ?',
        lift: 'L’ascenseur est-il assez grand pour un canapé ?',
      };
      const previousLabels: Record<string, string> = {
        floor: 'À quel étage, au départ et à l’arrivée ?',
        lift: 'Y a-t-il un ascenseur assez grand pour les meubles ?',
      };
      return question.label === previousLabels[question.id]
        ? { ...question, label: legacyLabels[question.id] }
        : question;
    },
  );
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
  const questionnaireAutoAnswers = {
    name: Boolean(draft.customerName.trim()),
    phone: Boolean(draft.customerPhone.trim()),
    date: Boolean(draft.date),
    time: Boolean(draft.timeSlot),
    from: Boolean(draft.fromAddress.trim()),
    to: Boolean(draft.toAddress.trim()),
    rep: Boolean(draft.fromNote.trim() && draft.toNote.trim()),
    dwelling: Boolean(draft.inventory.dwellingType),
    items: inventoryCount > 0,
  };
  const estimateText = movingEstimate?.volume
    ? referenceMovingEstimateNote(
        movingEstimate,
        draft.route?.distanceKm ?? 0,
        catalogue?.settings.movingLaborPlanning?.maxDayHours,
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
  const quoteDate = draft.date ? draft.date.split('-').reverse().join('/') : '—';
  const businessPhone = catalogue?.settings.businessPhone ?? '';
  const businessPhoneDigits = businessPhone.replace(/\D/g, '');
  const displayBusinessPhone = /^221\d{9}$/u.test(businessPhoneDigits)
    ? `+221 ${businessPhoneDigits.slice(3, 5)} ${businessPhoneDigits.slice(5, 8)} ${businessPhoneDigits.slice(8, 10)} ${businessPhoneDigits.slice(10)}`
    : businessPhone;
  const bounds = catalogue?.settings.distanceBounds ?? [15, 25, 35];
  const tiers = referenceTierLabels(bounds);
  const effectiveDistance = draft.distanceKmOverride ?? draft.route?.distanceKm;
  const previewTier = !draft.route
    ? 0
    : effectiveDistance! < bounds[0]
      ? 0
      : effectiveDistance! <= bounds[1]
        ? 1
        : effectiveDistance! <= bounds[2]
          ? 2
          : 3;
  const previewTransportUnit =
    previewTier === 3 ? (quoteConfig.customPrice ?? 0) : (selected?.prices[previewTier] ?? 0);
  const transportPreviewLine = selected
    ? {
        label: `Transport ${selected.shortName || selected.name} · ${(tiers[previewTier] ?? 'Moins de 15 km').toLowerCase()} (aller-retour)`,
        quantity: quoteConfig.trips,
        unitPrice: previewTransportUnit,
        total: previewTransportUnit * quoteConfig.trips,
      }
    : null;
  const fallbackServiceLines = extras
    .filter(([key]) => draft.options[key] > 0)
    .map(([key, label]) => ({
      label,
      quantity: draft.options[key],
      unitPrice:
        key === 'labour'
          ? quoteConfig.labourUnitPriceOverride || labourPrice
          : catalogue
            ? assemblyUnitPrice(
                catalogue.settings,
                key === 'desk' ? 'bureau' : key === 'wardrobe' ? 'armoire' : 'lit',
              )
            : 0,
      total:
        draft.options[key] *
        (key === 'labour'
          ? quoteConfig.labourUnitPriceOverride || labourPrice
          : catalogue
            ? assemblyUnitPrice(
                catalogue.settings,
                key === 'desk' ? 'bureau' : key === 'wardrobe' ? 'armoire' : 'lit',
              )
            : 0),
    }));
  const rawPreviewLines = [
    ...(transportPreviewLine ? [transportPreviewLine] : []),
    ...(price?.lines ?? fallbackServiceLines)
      .filter((line) => !line.label.startsWith('Transport '))
      .map((line) =>
        line.label.startsWith('Manœuvre') && quoteConfig.labourUnitPriceOverride
          ? {
              ...line,
              unitPrice: quoteConfig.labourUnitPriceOverride,
              total: line.quantity * quoteConfig.labourUnitPriceOverride,
            }
          : line,
      ),
  ];
  const inventoryMenuLines = catalogue
    ? inventoryAssemblyLines(draft.inventory, catalogue.settings)
    : [];
  const inventoryMenuOptions = inventoryAssemblyOptions(draft.inventory);
  const previewLines = inventoryMenuLines.length
    ? [
        ...rawPreviewLines.filter((line) => !line.label.startsWith('Menuisier ·')),
        ...extras
          .filter(([key]) => key !== 'labour')
          .map(([key, label]) => {
            const inventoryCount = inventoryMenuOptions[key];
            const quantity = Math.max(0, draft.options[key] - inventoryCount);
            const unitPrice = catalogue
              ? assemblyUnitPrice(
                  catalogue.settings,
                  key === 'desk' ? 'bureau' : key === 'wardrobe' ? 'armoire' : 'lit',
                )
              : 0;
            return { label, quantity, unitPrice, total: quantity * unitPrice };
          })
          .filter((line) => line.quantity > 0),
        ...inventoryMenuLines.map((line) => ({
          ...line,
          total: line.quantity * line.unitPrice,
        })),
      ]
    : rawPreviewLines;
  const previewSubtotal = previewLines.reduce((sum, line) => sum + line.total, 0);
  const previewDiscount =
    quoteConfig.discountType === 'pct'
      ? Math.round((previewSubtotal * Math.min(100, quoteConfig.discount)) / 100)
      : Math.min(previewSubtotal, quoteConfig.discount);
  const previewDiscountLabel = `Remise${quoteConfig.discountType === 'pct' && quoteConfig.discount ? ` (${Math.min(100, quoteConfig.discount)} %)` : ''}${quoteConfig.discountReason.trim() ? ` · ${quoteConfig.discountReason.trim()}` : ''}`;
  const previewTotal =
    previewTier === 3 && !quoteConfig.customPrice ? null : previewSubtotal - previewDiscount;
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
  const reminderPayment = [
    catalogue?.settings.paymentWave !== false ? 'Wave' : '',
    catalogue?.settings.paymentCash !== false ? 'espèces' : '',
  ].filter(Boolean);
  const reminderHref = editingBooking
    ? whatsappUrl(
        draft.customerPhone,
        `Bonjour ${draft.customerName}, petit rappel de Demenag Express : votre déménagement (${editingBooking.reference}) est prévu ${reminderWhen}, le ${reminderDateLabel}${draft.timeSlot ? ` à ${draft.timeSlot}` : ''}.\n${draft.fromAddress ? `Départ : ${draft.fromAddress}\n` : ''}${draft.toAddress ? `Arrivée : ${draft.toAddress}\n` : ''}Merci de préparer vos affaires pour le chargement.${reminderPayment.length ? `\nMode de paiement : ${reminderPayment.join(' ou ')}${reminderPayment.length > 1 ? ' (au choix)' : ''}.` : ''} Pour toute question, contactez-nous au ${catalogue?.settings.businessPhone ?? ''}. À bientôt !`,
        catalogue?.settings,
      )
    : '';
  function sendCurrentQuoteOnWhatsApp() {
    if (!canSendQuoteWhatsApp) {
      setStageError('Numéro WhatsApp du client invalide.');
      setOpenQuoteSections((current) => ({ ...current, client: true }));
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
    const pdfSettings = catalogue?.settings;
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
          draft.notes,
        ]
          .filter(Boolean)
          .join('\n'),
        options: draft.options,
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
        inventorySnapshot: movingEstimate?.volume
          ? bookingInventorySnapshot(estimateInventory, movingEstimate)
          : editingBooking?.inventorySnapshot,
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
        Math.min(catalogue?.settings.maxOptions ?? 20, current.options.labour + delta),
      );
      return {
        ...current,
        options: { ...current.options, labour },
        inventory: { ...current.inventory, crew: labour },
      };
    });
  };

  function toggleQuoteSection(section: keyof typeof openQuoteSections) {
    setOpenQuoteSections((current) => ({ ...current, [section]: !current[section] }));
  }

  if (loading)
    return (
      <div className="panel loading" role="status">
        Chargement du catalogue…
      </div>
    );
  if (error || !catalogue || !selected)
    return (
      <div className="alert error" role="alert">
        {error || 'Catalogue indisponible.'}
        <button className="button secondary" onClick={reload}>
          Réessayer
        </button>
      </div>
    );
  if (publicRequest && catalogue.settings.bookingsEnabled === false && !editingReservation)
    return (
      <section className="reference-request-page">
        <div className="booking-closed" role="status" aria-live="polite">
          <p className="eyebrow">FORMULAIRE DE RÉSERVATION</p>
          <h3>Les réservations sont temporairement fermées.</h3>
          <Link className="button secondary" to={routes.home}>
            Retour à l’accueil
          </Link>
        </div>
      </section>
    );
  if (publicRequest && done)
    return (
      <div className="reference-request-page">
        <BookingConfirmation booking={done} settings={catalogue.settings} isClient />
      </div>
    );

  return (
    <div className={`admin-quote-page${publicRequest ? ' reference-request-page' : ''}`}>
      {publicRequest && (
        <div className="reference-request-heading">
          <div>
            <span>RÉSERVATION</span>
            <h2>MA DEMANDE DE DÉMÉNAGEMENT</h2>
          </div>
          <Link
            className="reference-request-back"
            to={editingReservation ? routes.account : routes.home}
          >
            {editingReservation ? 'Retour à mon espace' : 'Retour à l’accueil'}
          </Link>
        </div>
      )}
      {editLoading && (
        <p className="panel loading" role="status">
          Chargement de la réservation…
        </p>
      )}
      {editError && (
        <p className="alert error" role="alert">
          {editError}
        </p>
      )}
      {editingLocked && (
        <p className="alert error" role="status">
          Cette réservation est clôturée. Son devis reste consultable, mais ses informations ne
          peuvent plus être modifiées.
        </p>
      )}
      <form
        id="admin-quote-form"
        onSubmit={(event) => {
          if (draft.customerPhone.replace(/\D/g, '').length < 9) {
            event.preventDefault();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            setStageError('Indiquez votre numéro de téléphone (9 chiffres).');
            return;
          }
          if (publicRequest && !draft.date) {
            event.preventDefault();
            setOpenQuoteSections((current) => ({ ...current, client: true }));
            setStageError('Choisissez une date.');
            return;
          }
          if (quoteKind === 'final' && (!draft.date || draft.noDate)) {
            event.preventDefault();
            setStageError(
              'Un devis sans date reste provisoire. Choisissez une date pour passer en final.',
            );
            return;
          }
          setStageError('');
          void submit(
            event,
            [visibleInventoryText, estimateText, questionnaireText].filter(Boolean).join('\n'),
            (movingEstimate?.planning ?? []).map((step, index) => ({
              id: `plan-${index + 1}`,
              time: step.time,
              title: step.title,
              detail: step.detail,
              minutes: step.minutes,
            })),
            movingEstimate &&
              (movingEstimate.volume > 0 ||
                state.editingBooking?.inventorySnapshot?.sourceInventory)
              ? bookingInventorySnapshot(estimateInventory, movingEstimate)
              : undefined,
            movingEstimate?.volume
              ? { ...draft.options, labour: movingEstimate.crew }
              : draft.options,
          );
        }}
        className="admin-quote-layout"
      >
        <div className="admin-quote-fields">
          {publicRequest && (
            <section className="reference-request-vehicle">
              <span>VÉHICULE</span>
              <div className="reference-vehicle-list">
                {catalogue.vehicles
                  .filter((vehicle) => vehicle.active !== false)
                  .map((vehicle) => (
                    <button
                      type="button"
                      key={vehicle.id}
                      className={draft.vehicleId === vehicle.id ? 'selected' : ''}
                      aria-pressed={draft.vehicleId === vehicle.id}
                      onClick={() => setDraft((current) => ({ ...current, vehicleId: vehicle.id }))}
                    >
                      <img src={vehicle.image} alt="" />
                      <span>
                        <strong>
                          {vehicle.shortName || vehicle.name.replace(/\s+(?:III|IV)$/i, '')}
                        </strong>
                        <small>
                          {vehicle.volume} · dès {money(vehicle.prices[0])}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
              <div className="reference-vehicle-detail reference-request-vehicle-detail">
                <FleetVehicleImagePreview vehicle={selected} />
                <strong>{selected.name.toUpperCase()}</strong>
                <div className="reference-vehicle-facts">
                  <span className="volume">{selected.volume}</span>
                  <span>Longueur {selected.length}</span>
                  <span>Hauteur {selected.height}</span>
                  <span>Largeur {selected.width}</span>
                  <span>Passages de roue {selected.wheelWidth}</span>
                </div>
                <div className="reference-prices">
                  {selected.prices.map((amount, index) => (
                    <span key={index}>
                      {referenceTierLabels(catalogue.settings.distanceBounds)[index]} :{' '}
                      <strong>{money(amount)}</strong>
                    </span>
                  ))}
                  <span>
                    {referenceTierLabels(catalogue.settings.distanceBounds)[3]} :{' '}
                    <strong>Sur devis</strong>
                  </span>
                  <span>
                    Manœuvre : <strong>{money(catalogue.settings.labourPrice)}</strong> / pers.
                  </span>
                  <span>
                    Menuisier : <strong>{money(catalogue.settings.assemblyPrice)}</strong> / meuble
                  </span>
                </div>
              </div>
            </section>
          )}
          <section className="admin-quote-card">
            <button
              className="admin-quote-section-toggle"
              type="button"
              aria-expanded={openQuoteSections.client}
              aria-controls="admin-quote-client-fields"
              onClick={() => toggleQuoteSection('client')}
            >
              <ChevronDown size={16} aria-hidden="true" />
              <span>
                {state.editingBooking
                  ? `DEVIS POUR ${state.editingBooking.reference}`
                  : publicRequest
                    ? 'VOS INFORMATIONS'
                    : 'NOUVEAU DEVIS · CLIENT EN AGENCE'}
              </span>
            </button>
            {openQuoteSections.client && (
              <div id="admin-quote-client-fields">
                <div className="admin-quote-identity">
                  <div className="admin-quote-client-name">
                    <input
                      required
                      maxLength={100}
                      value={draft.customerName}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, customerName: event.target.value }))
                      }
                      placeholder="Nom du client"
                      aria-label="Nom du client"
                    />
                  </div>
                  <div>
                    <input
                      required
                      type="tel"
                      maxLength={25}
                      value={draft.customerPhone}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, customerPhone: event.target.value }))
                      }
                      placeholder="Téléphone"
                      aria-label="Téléphone"
                    />
                  </div>
                  {!publicRequest && (
                    <div className="admin-quote-source">
                      <span>COMMENT LE CLIENT NOUS A CONNUS ?</span>
                      <div>
                        {[
                          'Facebook',
                          'YouTube',
                          'Instagram',
                          'Snapchat',
                          'TikTok',
                          'Autre pub',
                          'Bouche-à-oreille',
                          'Client fidèle',
                          'Autre',
                        ].map((source) => {
                          const selected = draft.source === source;
                          return (
                            <button
                              type="button"
                              key={source}
                              className={selected ? 'selected' : ''}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  source: selected ? '' : source,
                                }))
                              }
                            >
                              {source}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="admin-quote-date-control">
                    {!draft.noDate && (
                      <input
                        type="date"
                        min={editingReservation ? undefined : today()}
                        value={draft.date}
                        aria-label="Date prévue"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            date: event.target.value,
                            month: event.target.value
                              ? event.target.value.slice(0, 7)
                              : current.month,
                          }))
                        }
                      />
                    )}
                    {draft.noDate && state.administrativeQuote && (
                      <input
                        type="month"
                        required
                        value={draft.month}
                        aria-label="Mois souhaité"
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, month: event.target.value }))
                        }
                      />
                    )}
                    {state.administrativeQuote && (
                      <label className="admin-quote-no-date">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.noDate)}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              noDate: event.target.checked,
                              date: event.target.checked ? '' : current.date,
                              timeSlot: event.target.checked ? '' : current.timeSlot,
                            }))
                          }
                        />
                        <span>Date à définir (mois seulement)</span>
                      </label>
                    )}
                  </div>
                  <label className="admin-quote-start-time">
                    <span>Début</span>
                    <input
                      type="time"
                      required={Boolean(draft.date)}
                      value={draft.timeSlot}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, timeSlot: event.target.value }))
                      }
                    />
                  </label>
                  {!publicRequest && (
                    <div className="admin-quote-vehicles" role="group" aria-label="Véhicule">
                      {catalogue.vehicles.map((vehicle) => (
                        <button
                          type="button"
                          key={vehicle.id}
                          disabled={vehicle.active === false}
                          aria-pressed={draft.vehicleId === vehicle.id}
                          className={draft.vehicleId === vehicle.id ? 'active' : ''}
                          onClick={() =>
                            setDraft((current) => ({ ...current, vehicleId: vehicle.id }))
                          }
                        >
                          {vehicle.name.replace(/^(Mercedes|Renault) /, '')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {recognizingClient && (
                  <p className="muted" role="status">
                    Vérification du client…
                  </p>
                )}
                {clientRecognition &&
                  clientRecognition.phone === normalizedClientPhone(draft.customerPhone) && (
                    <p className="client-recognition">
                      Client déjà connu : {clientRecognition.name} ·{' '}
                      {clientRecognition.bookingCount} réservation(s)
                    </p>
                  )}
              </div>
            )}
          </section>

          <section
            className={`admin-quote-card${publicRequest ? ' reference-request-route-card' : ''}`}
          >
            <button
              className="admin-quote-section-toggle"
              type="button"
              aria-expanded={openQuoteSections.route}
              aria-controls="admin-quote-route-fields"
              onClick={() => toggleQuoteSection('route')}
            >
              <ChevronDown size={16} aria-hidden="true" />
              <span>TRAJET · CARTE</span>
            </button>
            {openQuoteSections.route && (
              <div id="admin-quote-route-fields">
                <Suspense fallback={<div className="map loading">Chargement de la carte…</div>}>
                  <RouteMap
                    {...(!publicRequest ? { tollLines, onTollToggle } : {})}
                    adminQuote
                    fromNote={draft.fromNote}
                    toNote={draft.toNote}
                    onNoteChange={(side, value) =>
                      setDraft((current) => ({
                        ...current,
                        [side === 'from' ? 'fromNote' : 'toNote']: value,
                      }))
                    }
                  />
                </Suspense>
                <a
                  className="button secondary small admin-quote-map-link"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(draft.from?.join(',') || draft.fromAddress || 'Dakar')}&destination=${encodeURIComponent(draft.to?.join(',') || draft.toAddress || 'Dakar')}&travelmode=driving`}
                >
                  Vérifier dans Google Maps
                </a>
                <label className="admin-quote-distance-editor">
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    step="0.1"
                    placeholder="Distance km"
                    value={effectiveDistance ?? ''}
                    disabled={!draft.route && !publicRequest}
                    aria-label="Distance du trajet en kilomètres"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        distanceKmOverride:
                          event.target.value === '' ? null : Number(event.target.value),
                      }))
                    }
                  />
                  <span>
                    Calculée par l’itinéraire, modifiable. Tranche appliquée :{' '}
                    <strong>{draft.route ? tiers[previewTier] : '—'}</strong>
                  </span>
                </label>
                {draft.from && draft.to && (
                  <div className="admin-quote-traffic" role="status">
                    <span aria-hidden="true" style={{ background: trafficColor }} />
                    <strong>
                      {!googleMapsKey
                        ? 'Trafic en direct inactif'
                        : traffic
                          ? `Trajet avec trafic : ${trafficDuration(traffic.minutes)}`
                          : trafficError
                            ? 'Trafic indisponible'
                            : 'Calcul du trafic…'}
                    </strong>
                    <small>
                      {!googleMapsKey
                        ? 'Ajoutez votre clé Google Maps dans Paramètres.'
                        : traffic
                          ? `${traffic.future ? 'Prévision Google pour le départ prévu' : 'Google, trafic actuel'}${trafficDelay > 0 ? ` · +${trafficDuration(trafficDelay)} de bouchons` : ''} · mis à jour à ${new Date(traffic.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                          : trafficError
                            ? 'Vérifiez la clé et l’activation de Distance Matrix.'
                            : ''}
                    </small>
                    <button
                      type="button"
                      disabled={!publicRequest && (!googleMapsKey || !route || trafficBusy)}
                      onClick={() => void refreshTraffic()}
                    >
                      Actualiser
                    </button>
                  </div>
                )}
                {draft.route && previewTier === 3 && (
                  <input
                    className="admin-quote-custom-price"
                    aria-label="Prix par aller-retour (au-delà de 35 km)"
                    placeholder="Prix par aller-retour (au-delà de 35 km)"
                    type="number"
                    min={1}
                    max={10000000}
                    required={!publicRequest}
                    value={quoteConfig.customPrice ?? ''}
                    onChange={(event) =>
                      setQuoteConfig((current) => ({
                        ...current,
                        customPrice: event.target.value
                          ? Math.max(1, Number(event.target.value))
                          : null,
                      }))
                    }
                  />
                )}
              </div>
            )}
          </section>

          {!publicRequest && (
            <section className="admin-quote-card">
              <div className="admin-quote-card-head">
                <button
                  className="admin-quote-section-toggle"
                  type="button"
                  aria-expanded={openQuoteSections.tolls}
                  aria-controls="admin-quote-toll-fields"
                  onClick={() => toggleQuoteSection('tolls')}
                >
                  <ChevronDown size={16} aria-hidden="true" />
                  <span>PÉAGES</span>
                </button>
                <strong>{totalTolls ? money(totalTolls) : ''}</strong>
              </div>
              {openQuoteSections.tolls && (
                <div id="admin-quote-toll-fields">
                  <TollRateSelector
                    lines={tollLines}
                    onToggle={onTollToggle}
                    roundTrips={quoteConfig.trips}
                  />
                </div>
              )}
            </section>
          )}

          <section
            className={`admin-quote-card admin-quote-services${publicRequest ? ' reference-request-options' : ''}`}
          >
            <button
              className="admin-quote-section-toggle"
              type="button"
              aria-expanded={openQuoteSections.options}
              aria-controls="admin-quote-option-fields"
              onClick={() => toggleQuoteSection('options')}
            >
              <ChevronDown size={16} aria-hidden="true" />
              <span>OPTIONS ET QUANTITÉS</span>
            </button>
            {openQuoteSections.options && (
              <div id="admin-quote-option-fields" className="admin-quote-option-fields">
                <div className="admin-quote-service-row">
                  <strong>Allers-retours</strong>
                  <div className="admin-quote-stepper">
                    <button
                      type="button"
                      aria-label="Retirer un aller-retour"
                      disabled={quoteConfig.trips <= 1}
                      onClick={() => {
                        const trips = Math.max(1, quoteConfig.trips - 1);
                        setQuoteConfig((current) => ({ ...current, trips }));
                        if (publicRequest)
                          setDraft((current) => ({ ...current, estimatedTrips: trips }));
                      }}
                    >
                      −
                    </button>
                    <output>{quoteConfig.trips}</output>
                    <button
                      type="button"
                      aria-label="Ajouter un aller-retour"
                      disabled={quoteConfig.trips >= catalogue.settings.maxTrips}
                      onClick={() => {
                        const trips = Math.min(catalogue.settings.maxTrips, quoteConfig.trips + 1);
                        setQuoteConfig((current) => ({ ...current, trips }));
                        if (publicRequest)
                          setDraft((current) => ({ ...current, estimatedTrips: trips }));
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                {extras.map(([key, label]) => (
                  <div className="admin-quote-service-row" key={key}>
                    <strong>
                      {key === 'labour'
                        ? 'Manœuvres'
                        : key === 'desk'
                          ? 'Montage/démontage bureau'
                          : key === 'wardrobe'
                            ? 'Montage/démontage armoire'
                            : 'Montage/démontage lit 2 places'}
                    </strong>
                    <div className="admin-quote-stepper">
                      <button
                        type="button"
                        aria-label={`Retirer ${label}`}
                        disabled={
                          draft.options[key] === 0 ||
                          (key === 'labour' &&
                            Boolean(movingEstimate?.volume) &&
                            draft.options.labour <= 1)
                        }
                        onClick={() => changeQuoteOption(key, -1)}
                      >
                        −
                      </button>
                      <output>{draft.options[key]}</output>
                      <button
                        type="button"
                        aria-label={`Ajouter ${label}`}
                        disabled={draft.options[key] >= catalogue.settings.maxOptions}
                        onClick={() => changeQuoteOption(key, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {!publicRequest && (
                  <div className="admin-quote-options-bottom">
                    <div className="admin-quote-discount-panel">
                      <div className="admin-quote-discount-heading">
                        <strong>REMISE</strong>
                        {quoteConfig.discount > 0 && (
                          <span>
                            − {money(previewDiscount)} sur {money(previewSubtotal)}
                          </span>
                        )}
                      </div>
                      <div className="admin-quote-discount-entry">
                        <input
                          type="number"
                          min={0}
                          value={quoteConfig.discount || ''}
                          aria-label="Remise"
                          placeholder={
                            quoteConfig.discountType === 'pct' ? 'Remise en %' : 'Remise en FCFA'
                          }
                          onChange={(event) =>
                            setQuoteConfig((current) => ({
                              ...current,
                              discount: Math.max(0, Number(event.target.value) || 0),
                            }))
                          }
                        />
                        <div
                          className="admin-quote-discount-types"
                          role="group"
                          aria-label="Type de remise"
                        >
                          {(['fcfa', 'pct'] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              className={quoteConfig.discountType === type ? 'selected' : ''}
                              aria-pressed={quoteConfig.discountType === type}
                              onClick={() =>
                                setQuoteConfig((current) => ({ ...current, discountType: type }))
                              }
                            >
                              {type === 'fcfa' ? 'FCFA' : '%'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        className="admin-quote-discount-reason-input"
                        type="text"
                        maxLength={200}
                        value={quoteConfig.discountReason}
                        placeholder="Motif de la remise"
                        aria-label="Motif de la remise"
                        onChange={(event) =>
                          setQuoteConfig((current) => ({
                            ...current,
                            discountReason: event.target.value,
                          }))
                        }
                      />
                      <div
                        className="admin-quote-discount-reasons"
                        aria-label="Motifs de remise proposés"
                      >
                        {['Client fidèle', 'Promotion', 'Geste commercial', 'Parrainage'].map(
                          (reason) => (
                            <button
                              type="button"
                              key={reason}
                              aria-pressed={quoteConfig.discountReason === reason}
                              onClick={() =>
                                setQuoteConfig((current) => ({
                                  ...current,
                                  discountReason: reason,
                                }))
                              }
                            >
                              {reason}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <textarea
                      className="admin-quote-free-note"
                      aria-label="Remarque libre"
                      rows={3}
                      maxLength={2000}
                      value={draft.notes}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, notes: event.target.value }))
                      }
                      placeholder="Remarque libre (ajoutée sous l'inventaire de la fiche d'appel)"
                    />
                  </div>
                )}
                {publicRequest && (
                  <textarea
                    className="admin-quote-free-note"
                    aria-label="Remarque libre"
                    rows={3}
                    maxLength={2000}
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Précisions utiles : étages, ascenseur, accès au camion, objets fragiles…"
                  />
                )}
              </div>
            )}
          </section>
          <CallInventory
            draft={draft}
            setDraft={setDraft}
            maxOptions={catalogue.settings.maxOptions}
            vehicles={catalogue.vehicles}
            selectedVehicleId={draft.vehicleId}
            quoteTrips={quoteConfig.trips}
            maxTrips={catalogue.settings.maxTrips}
            laborPlanning={catalogue.settings.movingLaborPlanning}
            trafficDurationMinutes={traffic?.minutes}
            audience={publicRequest ? 'client' : 'admin'}
            referenceMode={publicRequest}
            labourPriceEditor={
              publicRequest ? undefined : (
                <div className="admin-quote-labour-override">
                  <label htmlFor="admin-labour-unit-price">Prix par manœuvre (FCFA)</label>
                  <input
                    id="admin-labour-unit-price"
                    type="number"
                    min="0"
                    value={quoteConfig.labourUnitPriceOverride ?? ''}
                    placeholder={String(labourPrice)}
                    onChange={(event) =>
                      setQuoteConfig((current) => ({
                        ...current,
                        labourUnitPriceOverride: event.target.value
                          ? Math.max(0, Number(event.target.value)) || null
                          : null,
                      }))
                    }
                  />
                  <small>Vide = grille admin ({money(labourPrice)})</small>
                </div>
              )
            }
            estimateInventory={estimateInventory}
            onApplyEstimate={(vehicleId, trips) => {
              setDraft((current) => ({ ...current, vehicleId, estimatedTrips: trips }));
              setQuoteConfig((current) => ({ ...current, trips }));
            }}
          />
          {!publicRequest && (
            <ClientQuestionnaire
              questions={questionnaire}
              answers={draft.questionnaireAnswers}
              autoAnswers={questionnaireAutoAnswers}
              autoQuestionIds={[
                'name',
                'phone',
                'date',
                'time',
                'from',
                'to',
                'rep',
                'dwelling',
                'items',
              ]}
              open={questionnaireOpen}
              onToggle={() => setQuestionnaireOpen((value) => !value)}
              onChange={(id, value) =>
                setDraft((current) => ({
                  ...current,
                  questionnaireAnswers: { ...current.questionnaireAnswers, [id]: value },
                }))
              }
            />
          )}
        </div>

        <aside className="admin-quote-aside">
          <div className="admin-quote-paper" aria-label="Aperçu du devis en direct">
            <header>
              <div className="admin-quote-brand">
                <img src="/assets/logo.png" alt="" />
                <div>
                  <strong>DEMENAG EXPRESS PRO MTH</strong>
                  <span>Dakar · {displayBusinessPhone}</span>
                </div>
              </div>
              <div className="admin-quote-paper-title">
                <strong>{quoteKind === 'final' ? 'DEVIS FINAL' : 'DEVIS PROVISOIRE'}</strong>
                <span>Brouillon</span>
              </div>
            </header>
            <div className="admin-quote-stripe">
              <i />
              <i />
              <i />
            </div>
            <div className="admin-quote-paper-meta">
              <div>
                <small>CLIENT</small>
                <strong>{draft.customerName || '—'}</strong>
                <span>{draft.customerPhone || '—'}</span>
              </div>
              <div>
                <small>DATE PRÉVUE</small>
                <strong>
                  {quoteDate}
                  {draft.timeSlot ? ` · ${draft.timeSlot}` : ''}
                </strong>
                <span>{selected.name}</span>
              </div>
              <div className="admin-quote-route">
                <small>TRAJET</small>
                <strong>
                  {draft.fromAddress || '—'} → {draft.toAddress || '—'}
                </strong>
                <span>
                  {draft.route
                    ? `${effectiveDistance} km (itinéraire calculé)`
                    : 'Distance à relever'}
                </span>
              </div>
            </div>
            <div className="admin-quote-paper-lines">
              <div className="admin-quote-paper-table-head">
                <span>DÉSIGNATION</span>
                <span>MONTANT</span>
              </div>
              {previewLines.map((line, index) => (
                <div className="admin-quote-paper-line" key={`${line.label}-${index}`}>
                  <div>
                    <span>{line.label}</span>
                    <small>
                      {line.quantity} × {money(line.unitPrice)}
                    </small>
                  </div>
                  <strong>{money(line.total)}</strong>
                </div>
              ))}
              {!previewLines.length && (
                <div className="admin-quote-paper-line">
                  <span>Transport · trajet à définir</span>
                  <strong>—</strong>
                </div>
              )}
              {quoteConfig.discount > 0 && (
                <div className="admin-quote-paper-line">
                  <span>{previewDiscountLabel}</span>
                  <strong>− {money(previewDiscount)}</strong>
                </div>
              )}
              <div className="admin-quote-paper-total">
                <strong>{quoteKind === 'final' ? 'TOTAL' : 'TOTAL ESTIMÉ'}</strong>
                <strong>{previewTotal === null ? 'À calculer' : money(previewTotal)}</strong>
              </div>
            </div>
            {tollLines.length > 0 && (
              <div className="admin-quote-paper-tolls">
                <div className="admin-quote-paper-tolls-head">
                  <span className="admin-quote-paper-tolls-icon">
                    <Warehouse size={16} strokeWidth={2.2} />
                  </span>
                  <span>
                    <strong>PÉAGES À LA CHARGE DU CLIENT</strong>
                    <small>
                      {tollLines.length} péage{tollLines.length > 1 ? 's' : ''} · à régler sur place
                      par le client
                    </small>
                  </span>
                  <b>NON INCLUS DANS LE TOTAL</b>
                </div>
                <div className="admin-quote-paper-tolls-grid">
                  <span>PÉAGE</span>
                  <span>PASSAGES</span>
                  <span>PRIX UNIT.</span>
                  <span>MONTANT</span>
                  {tollLines.map((line) => (
                    <div className="admin-quote-paper-tolls-row" key={line.id}>
                      <span>
                        <strong>{line.label}</strong>
                        <small>{selected.name}</small>
                      </span>
                      <span>{line.quantity}</span>
                      <span>{money(line.unitPrice)}</span>
                      <strong>{money(line.quantity * line.unitPrice)}</strong>
                    </div>
                  ))}
                </div>
                <div className="admin-quote-paper-tolls-total">
                  <span>Total péages à régler par le client</span>
                  <strong>{money(totalTolls)}</strong>
                </div>
              </div>
            )}
            {(draft.fromNote ||
              draft.toNote ||
              visibleInventoryText ||
              estimateText ||
              questionnaireText ||
              draft.notes) && (
              <div className="admin-quote-paper-note">
                {[
                  draft.fromNote.trim() ? `Repère départ : ${draft.fromNote.trim()}` : '',
                  draft.toNote.trim() ? `Repère arrivée : ${draft.toNote.trim()}` : '',
                  visibleInventoryText,
                  estimateText,
                  questionnaireText,
                  draft.notes,
                ]
                  .filter(Boolean)
                  .join('\n')}
              </div>
            )}
            <p>
              {quoteKind === 'final'
                ? `Devis final établi sur la base du nombre réel d'allers-retours effectués (${quoteConfig.trips}), au tarif de la tranche de distance appliquée.`
                : `Devis temporaire, calculé sur ${quoteConfig.trips} aller(s)-retour(s) estimé(s). Le transport est facturé par aller-retour effectué : le devis final, basé sur le nombre réel d'allers-retours, sera envoyé par Demenag Express à la fin du déménagement.`}
            </p>
          </div>
          {!publicRequest && (
            <section className="admin-quote-stage" aria-label="Étape actuelle du devis">
              <span className="admin-quote-stage-label">ÉTAPE ACTUELLE</span>
              <div className="admin-quote-stage-switch" role="group" aria-label="Type de devis">
                <button
                  type="button"
                  aria-pressed={quoteKind === 'provisional'}
                  className={quoteKind === 'provisional' ? 'active provisional' : ''}
                  onClick={() => setQuoteKind('provisional')}
                >
                  Provisoire
                </button>
                <button
                  type="button"
                  aria-pressed={quoteKind === 'final'}
                  className={quoteKind === 'final' ? 'active final' : ''}
                  disabled={Boolean(editingBooking?.quotes.some((quote) => quote.kind === 'final'))}
                  title={
                    canCreateFinal
                      ? undefined
                      : 'Une date est nécessaire pour enregistrer un devis final.'
                  }
                  onClick={() => {
                    setQuoteKind('final');
                    setStageError('');
                  }}
                >
                  Final
                </button>
              </div>
              {quoteKind === 'final' && (
                <span className="admin-quote-stage-instruction">
                  Indiquez le nombre réel d'allers-retours, puis enregistrez.
                </span>
              )}
              <div className="admin-quote-stage-actions">
                <button
                  type="button"
                  className="admin-quote-action-whatsapp"
                  disabled={submitting || estimating || editingLocked}
                  onClick={sendCurrentQuoteOnWhatsApp}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                  </svg>
                  Envoyer le devis {quoteKind === 'final' ? 'final' : 'provisoire'} sur WhatsApp
                </button>
                {reminderCanSend && editingBooking && (
                  <a
                    className="admin-quote-reminder"
                    href={reminderHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Message : rendez-vous ${reminderWhen}`}
                    onClick={() => {
                      setReminderNotice('');
                      void api
                        .recordBookingReminder(editingBooking.id)
                        .then(() =>
                          setReminderNotice(
                            `Rappel WhatsApp envoyé à ${draft.customerName || 'client'} (${reminderWhen}).`,
                          ),
                        )
                        .catch((reason: unknown) =>
                          setStageError(
                            reason instanceof Error
                              ? reason.message
                              : 'Le rappel n’a pas pu être enregistré.',
                          ),
                        );
                    }}
                  >
                    Rappel ·{' '}
                    {reminderDays === 0
                      ? 'aujourd’hui'
                      : reminderDays === 1
                        ? 'demain'
                        : `J-${reminderDays}`}
                  </a>
                )}
              </div>
              {!reminderCanSend && (
                <span className="admin-quote-reminder-disabled">
                  Rappel indisponible · {reminderDisabledReason}
                </span>
              )}
              {reminderNotice && (
                <span className="admin-quote-reminder-notice" role="status">
                  {reminderNotice}
                </span>
              )}
              <span className="admin-quote-recipient">
                Destinataire :{' '}
                <strong>
                  {canSendQuoteWhatsApp
                    ? `+${whatsappNumber(draft.customerPhone, catalogue?.settings.whatsappCountryCode ?? '221')}`
                    : 'aucun numéro'}
                </strong>
              </span>
              {stageError && (
                <span className="admin-quote-stage-error" role="alert">
                  {stageError}
                </span>
              )}
              {pdfError && (
                <span className="admin-quote-stage-error" role="alert">
                  {pdfError}
                </span>
              )}
            </section>
          )}
          {estimateError && (
            <p className="alert error" role="alert">
              {estimateError}
            </p>
          )}
          {submitError && (
            <p className="alert error" role="alert">
              {submitError}
            </p>
          )}
          <button
            className={`button primary admin-quote-submit${publicRequest ? ' reference-request-submit' : ''}`}
            disabled={
              submitting ||
              estimating ||
              editLoading ||
              Boolean(editError) ||
              editingLocked ||
              (publicRequest && !editingReservation && catalogue.settings.bookingsEnabled === false)
            }
          >
            {publicRequest
              ? submitting
                ? 'Envoi…'
                : editingReservation
                  ? 'Envoyer les modifications'
                  : 'Envoyer ma demande'
              : submitting
                ? 'Enregistrement…'
                : editingReservation
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer'}
          </button>
          {!publicRequest && (
            <button
              type="button"
              className="admin-quote-action-pdf"
              onClick={() => void downloadCurrentQuote()}
            >
              {`Télécharger le PDF ${quoteKind === 'final' ? 'final' : 'provisoire'}`}
            </button>
          )}
        </aside>
      </form>
    </div>
  );
}
