import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBookingForm } from '../../application/useBookingForm';
import { blankDraft, useApp } from '../../application/context';
import { useBookingCommands } from '../../application/controllers/useBookingCommands';
import {
  readAdminQuoteDraft,
  saveAdminQuoteDraft,
  type AdminQuoteConfig,
} from '../../application/admin-quote-draft-storage';
import {
  referenceInventoryNote,
  referenceMovingEstimateNote,
} from '../../domain/reference-inventory-note';
import { referenceTierLabels, today } from '../../domain/format';
import {
  assemblyUnitPrice,
  labourUnitPrice,
  labourUnitPriceOverrideFromQuote,
} from '../../domain/labour-price';
import { inventoryAssemblyLines, inventoryAssemblyOptions } from '../../domain/inventory-assembly';
import { googleTrafficDuration, readGoogleMapsKey } from '../../application/google-maps-traffic';
import type { Booking, Options, Price, Quote } from '../../domain/model';
import { bookingInventorySnapshot, estimateMovingWork } from '../../domain/moving-estimate';
import { defaultClientQuestions } from '../../domain/questionnaire';
import { quoteNotificationUrl } from '../../application/services/quote-notification';
import { whatsappNumber, whatsappUrl } from '../../application/services/whatsapp';

const trafficDuration = (minutes: number) => {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return hours
    ? `${hours} h${remaining ? ` ${String(remaining).padStart(2, '0')}` : ''}`
    : `${remaining} min`;
};

export function useAdminCreateQuoteModel(publicRequest: boolean) {
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
  const { exportQuote, catalogue: appCatalogue, user } = useApp();
  const bookingCommands = useBookingCommands();
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

  return {
    location,
    navigate,
    initialClient,
    editingReservation,
    startNewRequest,
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
    reminderNotice,
    setReminderNotice,
    whatsappWindow,
    sendWhatsAppAfterSave,
    openQuoteSections,
    setOpenQuoteSections,
    googleMapsKey,
    traffic,
    setTraffic,
    trafficBusy,
    setTrafficBusy,
    trafficError,
    setTrafficError,
    trafficRequest,
    exportQuote,
    appCatalogue,
    user,
    bookingCommands,
    state,
    editingLocked,
    editingBooking,
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
    questionnaireAutoAnswers,
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
    previewTransportUnit,
    transportPreviewLine,
    fallbackServiceLines,
    rawPreviewLines,
    inventoryMenuLines,
    inventoryMenuOptions,
    previewLines,
    previewSubtotal,
    previewDiscount,
    previewDiscountLabel,
    previewTotal,
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
