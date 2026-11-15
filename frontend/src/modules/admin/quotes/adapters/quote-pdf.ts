import { assetDataUrl } from '../../../shared/adapters/pdf-assets';
import { addPdfImage, cleanPdfText, pdfParagraph } from './quote-pdf-render';
import { drawQuoteSignature } from './quote-pdf-signature';
import { drawQuoteTerms } from './quote-pdf-terms';
import { money, referenceTierLabels } from '../../../shared/application/presentation/format';
import { referenceDwellingVolume } from '../../../moving/domain/estimate/reference-inventory-note';
import { defaultQuoteTerms } from '../../../moving/domain/quote-terms';
import type { Booking, Quote, Settings } from '../../../shared/domain/model';
import { durationLabel, quotePdfNotes } from './quote-pdf-text';
import { quoteAmountInFrench } from './quote-pdf-number';

export async function downloadQuote(
  booking: Booking,
  quote: Quote | undefined,
  settings: Settings,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const documentQuote = quote;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const price = documentQuote?.price || booking.estimate;
  const { addressNotes, loadingConditions } = quotePdfNotes(booking, documentQuote);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const right = pageWidth - margin;

  const pdfMoney = (value: number | null) => cleanPdfText(money(value));
  const pdfIssuedAt = new Date();
  let y = 15;

  function ensureSpace(height: number) {
    if (y + height > 278) {
      doc.addPage();
      y = 20;
    }
  }

  function pdfHead(title: string, subtitle: string, detail: string) {
    const headY = 16;
    const logoWidth = logo ? 13 : 0;
    if (logo) addPdfImage(doc, logo, margin, headY - 4, 13, 13);
    const titleX = margin + logoWidth + (logoWidth ? 4 : 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 32, 35);
    doc.text(cleanPdfText(title), titleX, headY + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 97, 104);
    const detailWidth = detail ? doc.getTextWidth(cleanPdfText(detail)) + 6 : 0;
    if (subtitle)
      doc.text(
        doc.splitTextToSize(cleanPdfText(subtitle), pageWidth - margin - titleX - detailWidth)[0] ||
          '',
        titleX,
        headY + 8.4,
      );
    if (detail) doc.text(cleanPdfText(detail), right, headY + 8.4, { align: 'right' });
    doc.setFillColor(30, 32, 35);
    doc.rect(margin, headY + 12, contentWidth, 0.7, 'F');
    doc.setFillColor(246, 215, 60);
    doc.rect(margin, headY + 12, 26, 0.7, 'F');
    return headY + 20;
  }

  // En-tête du document de référence.
  const logo = settings.invoiceLogo || (await assetDataUrl('/assets/logo.png'));
  doc.setFillColor(30, 32, 35);
  doc.rect(0, 0, pageWidth, 40, 'F');
  addPdfImage(doc, logo, margin, 9, 22, 22);
  pdfParagraph(
    doc,
    settings.businessName || 'DEMENAG EXPRESS PRO MTH',
    margin + 27,
    19,
    91,
    16,
    true,
    [255, 255, 255],
  );
  pdfParagraph(
    doc,
    `${settings.businessAddress || 'Dakar, Sénégal'}  ·  ${settings.businessPhone}${settings.businessEmail ? `  ·  ${settings.businessEmail}` : ''}`,
    margin + 27,
    25.5,
    100,
    9,
    false,
    [174, 180, 187],
  );
  const legalDetails = [
    settings.businessNinea ? `NINEA ${settings.businessNinea}` : '',
    settings.businessRccm ? `RCCM ${settings.businessRccm}` : '',
  ].filter(Boolean);
  if (legalDetails.length)
    pdfParagraph(
      doc,
      legalDetails.join('  ·  '),
      margin + 27,
      31,
      100,
      7.5,
      false,
      [174, 180, 187],
    );
  const documentKind = documentQuote?.kind === 'final' ? 'DEVIS FINAL' : 'DEVIS PROVISOIRE';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const badgeWidth = doc.getTextWidth(cleanPdfText(documentKind)) + 10;
  if (documentQuote?.kind === 'final') doc.setFillColor(255, 255, 255);
  else doc.setFillColor(246, 215, 60);
  doc.roundedRect(right - badgeWidth, 10, badgeWidth, 8, 4, 4, 'F');
  doc.setTextColor(30, 32, 35);
  doc.text(documentKind, right - badgeWidth / 2, 15.3, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`N° ${documentQuote?.reference || booking.reference}`, right, 26.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(174, 180, 187);
  doc.text(
    `Émis le ${pdfIssuedAt.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })} · version 1`,
    right,
    31.5,
    { align: 'right' },
  );

  y = 40;
  const segmentWidth = pageWidth / 3;
  [
    [12, 107, 53],
    [246, 215, 60],
    [227, 38, 47],
  ].forEach((color, index) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(index * segmentWidth, y, segmentWidth, 1.4, 'F');
  });

  y = 49;
  const infoGap = 4;
  const infoWidth = (pageWidth - 2 * margin - 2 * infoGap) / 3;
  const infoHeight = 23;
  const infoCards = [
    ['CLIENT', booking.customerName || '-', booking.phone || ''],
    [
      'DATE PRÉVUE',
      booking.date
        ? booking.date.split('-').reverse().join('/')
        : booking.month
          ? new Date(`${booking.month}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric',
              timeZone: 'Africa/Dakar',
            })
          : '-',
      booking.timeSlot ? (booking.date ? booking.timeSlot : `Début ${booking.timeSlot}`) : '',
    ],
    [
      'VÉHICULE',
      booking.vehicle.name,
      documentQuote?.billingMode === 'driver-rental'
        ? 'Formule Économique · location avec chauffeur'
        : documentQuote?.billingMode === 'standard'
          ? 'Formule Standard'
          : 'Formule Complète',
    ],
  ] as const;
  infoCards.forEach(([label, value, detail], index) => {
    const x = margin + index * (infoWidth + infoGap);
    doc.setFillColor(244, 245, 247);
    doc.roundedRect(x, y, infoWidth, infoHeight, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text(label, x + 5, y + 7);
    doc.setFontSize(11);
    doc.setTextColor(30, 32, 35);
    const valueLines = doc.splitTextToSize(cleanPdfText(value), infoWidth - 9) as string[];
    doc.text(valueLines[0] || '', x + 5, y + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 97, 104);
    const detailLines = doc.splitTextToSize(cleanPdfText(detail), infoWidth - 9) as string[];
    if (detailLines.length > 1) doc.setFontSize(7.5);
    doc.text(detailLines, x + 5, y + (detailLines.length > 1 ? 17 : 19));
  });

  y += infoHeight + 5;
  {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const addressWidth = pageWidth - 2 * margin - 66;
    const fromLines = doc.splitTextToSize(
      cleanPdfText(booking.fromAddress || '-'),
      addressWidth,
    ) as string[];
    const toLines = doc.splitTextToSize(
      cleanPdfText(booking.toAddress || '-'),
      addressWidth,
    ) as string[];
    const routeHeight = Math.max(32, 14 + (fromLines.length + toLines.length) * 4.6 + 7);
    doc.setFillColor(244, 245, 247);
    doc.roundedRect(margin, y, contentWidth, routeHeight, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('TRAJET', margin + 5, y + 7);
    const fromY = y + 14;
    const toY = fromY + fromLines.length * 4.6 + 3.5;
    const routeDot = (top: number, color: [number, number, number], label: string) => {
      doc.setFillColor(...color);
      doc.circle(margin + 8, top - 1.4, 2.7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(label, margin + 8, top - 0.3, { align: 'center' });
    };
    doc.setDrawColor(174, 180, 187);
    doc.setLineWidth(0.4);
    if (doc.setLineDashPattern) doc.setLineDashPattern([0.8, 0.9], 0);
    doc.line(margin + 8, fromY + 1.8, margin + 8, toY - 4.6);
    if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    routeDot(fromY, [11, 107, 53], 'A');
    routeDot(toY, [227, 38, 47], 'B');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 32, 35);
    doc.text(fromLines, margin + 14, fromY);
    doc.text(toLines, margin + 14, toY);
    const routeStatsX = pageWidth - margin - 50;
    doc.setDrawColor(220, 223, 227);
    doc.setLineWidth(0.3);
    doc.line(routeStatsX, y + 5, routeStatsX, y + routeHeight - 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 32, 35);
    doc.text(
      booking.distanceKm ? `${String(booking.distanceKm).replace('.', ',')} km` : '-',
      routeStatsX + 6,
      y + 14,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 97, 104);
    doc.text('par la route', routeStatsX + 6, y + 19);
    const bounds = settings.distanceBounds ?? [15, 25, 35];
    const tierLabels = referenceTierLabels(bounds);
    doc.text(
      doc.splitTextToSize(cleanPdfText(`Tranche : ${tierLabels[price.tier]}`), 42).slice(0, 2),
      routeStatsX + 6,
      y + 24.5,
    );
    y += routeHeight + 8;
  }

  // Même bandeau et mêmes colonnes que le tableau du devis de référence.
  const qtyX = right - 70;
  const unitX = right - 38;
  const amountX = right - 4;
  const tableHeader = () => {
    doc.setFillColor(30, 32, 35);
    doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('DÉSIGNATION', margin + 4, y + 5.3);
    doc.text('QTÉ', qtyX, y + 5.3, { align: 'right' });
    doc.text('P.U.', unitX, y + 5.3, { align: 'right' });
    doc.text('MONTANT', amountX, y + 5.3, { align: 'right' });
    y += 8;
  };
  tableHeader();
  doc.setDrawColor(220, 223, 227);
  doc.setLineWidth(0.3);
  for (const [index, line] of price.lines.entries()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const labelLines = doc.splitTextToSize(
      cleanPdfText(line.label),
      qtyX - margin - 14,
    ) as string[];
    const rowHeight = labelLines.length * 4.4 + 4.4;
    if (y + rowHeight > 262) {
      doc.addPage();
      y = 24;
      tableHeader();
    }
    doc.setTextColor(30, 32, 35);
    if (index % 2) {
      doc.setFillColor(244, 245, 247);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.text(labelLines, margin + 4, y + 5.6);
    doc.setTextColor(90, 97, 104);
    doc.text(String(line.quantity), qtyX, y + 5.6, { align: 'right' });
    doc.text(pdfMoney(line.unitPrice), unitX, y + 5.6, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 32, 35);
    doc.text(pdfMoney(line.total), amountX, y + 5.6, { align: 'right' });
    y += rowHeight;
  }
  doc.line(margin, y, right, y);
  if (price.discount > 0) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 140, 80);
    doc.text(cleanPdfText(price.discountLabel ?? 'Remise'), margin + 4, y + 5.6);
    doc.text(`- ${pdfMoney(price.discount)}`, amountX, y + 5.6, { align: 'right' });
    y += 8.8;
    doc.line(margin, y, right, y);
  }
  y += 5;
  if (y > 252) {
    doc.addPage();
    y = 24;
  }
  const isFinal = documentQuote?.kind === 'final';
  const totalBackground: [number, number, number] = isFinal ? [30, 32, 35] : [246, 215, 60];
  const totalForeground: [number, number, number] = isFinal ? [255, 255, 255] : [35, 37, 40];
  doc.setFillColor(...totalBackground);
  doc.roundedRect(margin, y, contentWidth, 20, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...totalForeground);
  doc.setFontSize(11);
  doc.text(isFinal ? 'TOTAL À PAYER' : 'ESTIMATION PROVISOIRE', margin + 6, y + 9.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    cleanPdfText(
      `${price.trips} aller(s)-retour(s)${isFinal ? '' : ' estimé(s)'} · ${booking.vehicle.name}`,
    ),
    margin + 6,
    y + 14.6,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  const totalLabel =
    price.tier === 3 &&
    !price.lines.some((line) => line.label.startsWith('Transport') && line.unitPrice > 0)
      ? 'Sur devis'
      : pdfMoney(price.total);
  if (isFinal) doc.setTextColor(246, 215, 60);
  else doc.setTextColor(30, 32, 35);
  doc.text(totalLabel, right - 6, y + 13.2, { align: 'right' });
  y += 24;

  if (isFinal && (price.total ?? 0) > 0 && totalLabel !== 'Sur devis') {
    y = pdfParagraph(
      doc,
      `Arrêté le présent devis à la somme de ${quoteAmountInFrench(price.total ?? 0)} francs CFA.`,
      margin,
      y,
      contentWidth,
      9,
      true,
      [60, 66, 72],
    );
  }

  const inventory = booking.inventorySnapshot;
  const tolls = documentQuote?.tolls ?? [];
  const tollTotal = tolls.reduce((total, toll) => total + toll.quantity * toll.unitPrice, 0);
  const validityDays = settings.quoteValidityDays ?? 15;
  const depositPercent = settings.bookingDepositPercent ?? 0;
  const notices: { bold: boolean; text: string }[] = [];
  if (tolls.length)
    notices.push({
      bold: false,
      text: `Péages estimés à votre charge : ${pdfMoney(tollTotal)}  ·  Budget total à prévoir : ${pdfMoney((price.total ?? 0) + tollTotal)}`,
    });
  if ((price.total ?? 0) > 0 && depositPercent > 0) {
    const deposit = Math.round(((price.total ?? 0) * depositPercent) / 100 / 500) * 500;
    notices.push({
      bold: false,
      text: `Acompte à la réservation : ${money(deposit)} (${depositPercent} %)  ·  Solde le jour du déménagement : ${money((price.total ?? 0) - deposit)}`,
    });
  }
  if (!isFinal && validityDays > 0) {
    const issueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(
      pdfIssuedAt,
    );
    const expiry = new Date(`${issueDate}T12:00:00Z`);
    notices.push({
      bold: false,
      text: `Devis valable ${validityDays} jours${Number.isNaN(expiry.getTime()) ? '' : `, jusqu’au ${expiry.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })}`}.`,
    });
  }
  notices.forEach((notice) => {
    doc.setFont('helvetica', notice.bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 66, 72);
    const lines = doc.splitTextToSize(cleanPdfText(notice.text), contentWidth) as string[];
    doc.text(lines, margin, y);
    y += lines.length * 4.4;
  });
  if (notices.length) y += 3;

  const paymentModes = [
    settings.paymentWave !== false ? 'Wave' : '',
    settings.paymentCash !== false ? 'espèces' : '',
  ].filter(Boolean);
  const paymentText =
    paymentModes.length > 1
      ? 'Wave ou espèces (au choix)'
      : paymentModes[0] === 'Wave'
        ? 'Wave uniquement'
        : paymentModes.length
          ? 'Espèces uniquement'
          : '';
  const paymentQr =
    settings.paymentWave !== false && settings.paymentQr
      ? settings.paymentQr.startsWith('/assets/')
        ? await assetDataUrl(settings.paymentQr)
        : settings.paymentQr
      : '';
  const paymentQrSize = paymentQr ? doc.getImageProperties(paymentQr) : null;

  const hasInventoryDetails = Boolean(inventory?.items.length);
  const quoteNotes = inventory
    ? ''
    : [
        addressNotes.from ? `Repère départ : ${addressNotes.from}` : '',
        addressNotes.to ? `Repère arrivée : ${addressNotes.to}` : '',
        loadingConditions,
        addressNotes.remaining,
      ]
        .filter(Boolean)
        .join('\n');
  const loadingCards: { ok: boolean; main: string }[] = [];
  if (inventory?.ready === 'oui') loadingCards.push({ ok: true, main: 'Prêt à être chargé' });
  else if (inventory?.ready === 'non')
    loadingCards.push({ ok: false, main: 'À emballer sur place' });
  if (inventory?.stairs === 'oui')
    loadingCards.push({ ok: true, main: 'Tout passe par l’escalier' });
  else if (inventory?.stairs === 'balcon')
    loadingCards.push({
      ok: false,
      main: inventory.balcPx ? `Par le balcon · +${pdfMoney(inventory.balcPx)}` : 'Par le balcon',
    });
  else if (inventory?.stairs === 'non')
    loadingCards.push({ ok: false, main: 'Démontage ou monte-meuble' });
  else if (inventory?.stairs === 'verif') loadingCards.push({ ok: false, main: 'À confirmer' });
  if (loadingCards.length) {
    const pad = 4;
    const cardHeight = 13;
    const cardWidth = (contentWidth - pad * 2) / loadingCards.length;
    if (y + cardHeight > 280) {
      doc.addPage();
      y = 24;
    }
    doc.setFillColor(246, 247, 248);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'F');
    doc.setFillColor(246, 215, 60);
    doc.roundedRect(margin, y, 1.6, cardHeight, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 32, 35);
    doc.text('CONDITIONS DE CHARGEMENT', margin + pad + 1, y + 4.4);
    doc.setFontSize(7);
    doc.setTextColor(180, 40, 45);
    doc.text('À respecter, sinon le déménagement n’aura pas lieu.', right - pad, y + 4.4, {
      align: 'right',
    });
    loadingCards.forEach((card, index) => {
      const x = margin + pad + 1 + index * cardWidth;
      const centerY = y + 9.2;
      const color: [number, number, number] = card.ok ? [30, 140, 80] : [214, 140, 20];
      doc.setFillColor(...color);
      doc.circle(x + 1.9, centerY, 1.9, 'F');
      if (card.ok) {
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.line(x + 1, centerY, x + 1.7, centerY + 0.7);
        doc.line(x + 1.7, centerY + 0.7, x + 2.9, centerY - 0.7);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text('!', x + 1.9, centerY + 0.6, { align: 'center' });
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.3);
      doc.setTextColor(30, 32, 35);
      doc.text(
        doc.splitTextToSize(cleanPdfText(card.main), cardWidth - 7)[0] || '',
        x + 5,
        centerY + 0.6,
      );
    });
    y += cardHeight + 3;
  }
  if (!inventory && tolls.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 32, 35);
    doc.text(
      cleanPdfText(
        `Péages à la charge du client (non inclus) : ${pdfMoney(tollTotal)} - détail en page annexe.`,
      ),
      margin,
      y,
    );
    y += 7;
  }
  if (quoteNotes) {
    const noteLines = doc.splitTextToSize(
      cleanPdfText(`Note : ${quoteNotes}`),
      contentWidth,
    ) as string[];
    if (y + noteLines.length * 4.6 > 278) {
      doc.addPage();
      y = 24;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 32, 35);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.6 + 4;
  }
  const explanation = isFinal
    ? `Devis final établi sur la base du nombre réel d’allers-retours effectués (${price.trips}), au tarif de la tranche de distance appliquée.`
    : `Devis temporaire, calculé sur ${price.trips} aller(s)-retour(s) estimé(s). Le transport est facturé par aller-retour effectué : le devis final, basé sur le nombre réel d’allers-retours, sera envoyé par Demenag Express à la fin du déménagement.`;
  y = pdfParagraph(doc, explanation, margin, y, contentWidth, 8, false, [90, 97, 104]);
  if (documentQuote?.billingMode === 'driver-rental') {
    const hourlyRate =
      documentQuote.pricingInput?.rentalOvertimeHourlyRate ??
      settings.rentalOvertimeHourlyRate ??
      10000;
    const plannedEnd = booking.inventorySnapshot?.endTime;
    y = pdfParagraph(
      doc,
      `${plannedEnd ? `Fin prévue à ${plannedEnd}. ` : ''}Chaque minute de dépassement jusqu’à la fin du déchargement est facturée ${pdfMoney(Math.round(hourlyRate / 60))} par minute (${pdfMoney(hourlyRate)} par heure).`,
      margin,
      y,
      contentWidth,
      8,
      false,
      [92, 99, 106],
    );
  }
  const terms = (settings.quoteTerms || defaultQuoteTerms).trim();
  // Espaces de signature et cachet comme sur le document de référence.
  let signatureY = y + 3;
  let signatureHeight = paymentText ? Math.min(108, 286 - signatureY) : 50;
  if (
    signatureHeight < (paymentText ? 24 : 50) ||
    (!paymentText && signatureY + signatureHeight > 284)
  ) {
    doc.addPage();
    signatureY = 24;
    signatureHeight = paymentText ? Math.min(108, 286 - signatureY) : 50;
  }
  await drawQuoteSignature({
    doc,
    settings,
    top: signatureY,
    paymentText,
    paymentQr,
    paymentQrSize,
    signatureHeight,
    contentWidth,
    margin,
    right,
  });

  if (terms && settings.quoteTermsEnabled !== false) {
    y = drawQuoteTerms({
      doc,
      settings,
      reference: documentQuote?.reference || booking.reference,
      terms,
      margin,
      right,
      contentWidth,
    });
  }

  if (documentQuote?.billingMode === 'driver-rental') {
    doc.addPage();
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 32, 35);
    doc.text('LOCATION AVEC CHAUFFEUR · MATÉRIEL FOURNI', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 97, 104);
    doc.text(
      cleanPdfText(
        `${documentQuote.reference} · ${booking.customerName} · ${booking.vehicle.shortName || booking.vehicle.name}`,
      ),
      right,
      y,
      { align: 'right' },
    );
    y += 5;
    doc.setDrawColor(35, 38, 41);
    doc.setLineWidth(0.4);
    doc.line(margin, y, right, y);
    y += 10;
    y = pdfParagraph(
      doc,
      `Vous fournissez ${documentQuote.providedCrew ?? 0} manœuvre(s). Le chauffeur et le matériel indiqué ci-dessous sont fournis par Demenag Express.`,
      margin,
      y,
      contentWidth,
      9,
      false,
      [90, 97, 104],
    );
    const kit = documentQuote.rentalKit ?? [];
    const columns = 3;
    const gap = 5;
    const tileWidth = (contentWidth - gap * (columns - 1)) / columns;
    const tileHeight = 48;
    for (let row = 0; row < Math.ceil(kit.length / columns); row++) {
      ensureSpace(tileHeight + 6);
      const top = y;
      for (let column = 0; column < columns; column++) {
        const item = kit[row * columns + column];
        if (!item) continue;
        const x = margin + column * (tileWidth + gap);
        doc.setDrawColor(201, 206, 211);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, top, tileWidth, tileHeight, 2, 2, 'S');
        if (item.image) {
          try {
            const image = item.image.startsWith('data:image/')
              ? item.image
              : await assetDataUrl(item.image);
            const format = image.startsWith('data:image/jpeg')
              ? 'JPEG'
              : image.startsWith('data:image/webp')
                ? 'WEBP'
                : 'PNG';
            const dimensions = doc.getImageProperties(image);
            const maxWidth = tileWidth - 8;
            const maxHeight = 27;
            const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
            const drawnWidth = dimensions.width * scale;
            const drawnHeight = dimensions.height * scale;
            doc.addImage(
              image,
              format,
              x + (tileWidth - drawnWidth) / 2,
              top + 3,
              drawnWidth,
              drawnHeight,
            );
          } catch {
            // Une image manquante ne doit pas bloquer l’export du devis.
          }
        }
        pdfParagraph(
          doc,
          `${item.label} · ${item.quantity}`,
          x + 4,
          top + 34,
          tileWidth - 8,
          7.5,
          true,
        );
      }
      y += tileHeight + gap;
    }
    y += 4;
    const overtime = documentQuote.overtimeMinutes ?? 0;
    const overtimeAmount = price.lines
      .filter((line) => line.label.startsWith('Dépassement du planning'))
      .reduce((total, line) => total + line.total, 0);
    doc.setFillColor(247, 248, 249);
    doc.roundedRect(margin, y, contentWidth, 36, 2, 2, 'F');
    y = pdfParagraph(
      doc,
      `Dépassement déclaré : ${overtime} min · montant calculé : ${pdfMoney(overtimeAmount)}. Tarif : ${pdfMoney(documentQuote.pricingInput?.rentalOvertimeHourlyRate ?? settings.rentalOvertimeHourlyRate ?? 10000)} par heure, proratisé à la minute.`,
      margin + 5,
      y + 8,
      contentWidth - 10,
      8.5,
      true,
    );
  }

  if (tolls.length) {
    doc.addPage();
    y = pdfHead(
      'Annexe · Péages',
      'À la charge du client, non inclus dans le total',
      `${documentQuote?.reference || booking.reference} · ${booking.customerName} · ${booking.vehicle.shortName || booking.vehicle.name}`,
    );
    y += 0;
    const tollBoxHeight = 22 + tolls.length * 7.5;
    const tollAmountX = right - 5;
    const tollUnitX = tollAmountX - 38;
    doc.setDrawColor(201, 206, 211);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, tollBoxHeight, 2, 2, 'S');
    doc.setFillColor(247, 248, 249);
    doc.rect(margin + 0.2, y + 0.2, contentWidth - 0.4, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 32, 35);
    doc.text('PÉAGES À LA CHARGE DU CLIENT', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('NON INCLUS DANS LE TOTAL', tollAmountX, y + 6, { align: 'right' });
    let tollY = y + 15;
    doc.setFontSize(9.5);
    tolls.forEach((toll) => {
      const label = toll.label.replace(/^Péage · /iu, '');
      doc.setTextColor(30, 32, 35);
      doc.text(cleanPdfText(label), margin + 4, tollY);
      doc.setTextColor(90, 97, 104);
      doc.text(
        cleanPdfText(
          `${toll.quantity} × ${toll.unitPrice ? pdfMoney(toll.unitPrice) : 'prix à confirmer'}`,
        ),
        tollUnitX,
        tollY,
        { align: 'right' },
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 32, 35);
      doc.text(
        toll.unitPrice ? pdfMoney(toll.quantity * toll.unitPrice) : '—',
        tollAmountX,
        tollY,
        { align: 'right' },
      );
      doc.setFont('helvetica', 'normal');
      tollY += 7.5;
    });
    doc.setFillColor(30, 32, 35);
    doc.rect(margin + 0.2, tollY - 3.5, contentWidth - 0.4, 8.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Total péages à régler par le client', margin + 4, tollY + 2);
    doc.setTextColor(246, 215, 60);
    doc.text(pdfMoney(tollTotal), tollAmountX, tollY + 2, { align: 'right' });
    y += tollBoxHeight + 8;
    pdfParagraph(
      doc,
      'Les péages sont réglés directement par le client au passage du véhicule. Ils ne sont pas inclus dans le montant du devis.',
      margin,
      y,
      contentWidth,
      9,
      false,
      [90, 97, 104],
    );
  }

  if (inventory) {
    doc.addPage();
    const inventoryParagraph = (
      value: string,
      size: number,
      color: [number, number, number] = [30, 32, 35],
      bold = false,
    ) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(cleanPdfText(value), contentWidth) as string[];
      const blockHeight = lines.length * (size * 0.42) + 1;
      if (y + blockHeight > 278) {
        doc.addPage();
        y = 24;
      }
      doc.text(lines, margin, y);
      y += blockHeight;
      return y;
    };
    y = pdfHead(
      'Annexe · Inventaire',
      `${booking.customerName || '-'}${booking.phone ? `  ·  ${booking.phone}` : ''}`,
      `N° ${documentQuote?.reference || booking.reference}  ·  ${(booking.date ?? '').split('-').reverse().join('/')}`,
    );
    y += 1;
    const halfWidth = contentWidth / 2 - 5;
    const accessLine = (
      x: number,
      label: string,
      address: string,
      floor: number,
      lift: boolean,
      reference: string,
    ): number => {
      let nextY = pdfParagraph(doc, label, x, y, halfWidth, 8, true, [96, 103, 110]);
      nextY = pdfParagraph(doc, address, x, nextY, halfWidth, 9.5, true);
      const floorName =
        floor === 0 ? 'Rez-de-chaussée' : floor === 1 ? '1er étage' : `${floor}ème étage`;
      nextY = pdfParagraph(
        doc,
        `${floorName}${lift ? ' · ascenseur' : ' · sans ascenseur'}`,
        x,
        nextY,
        halfWidth,
        8.5,
      );
      if (reference.trim())
        nextY = pdfParagraph(doc, `Repère : ${reference.trim()}`, x, nextY, halfWidth, 8.5);
      return nextY;
    };
    y =
      Math.max(
        accessLine(
          margin,
          'DÉPART (A)',
          booking.fromAddress,
          inventory.fromFloor,
          inventory.fromLift,
          addressNotes.from,
        ),
        accessLine(
          right - halfWidth,
          'ARRIVÉE (B)',
          booking.toAddress,
          inventory.toFloor,
          inventory.toLift,
          addressNotes.to,
        ),
      ) + 10;
    const recapValues: [string, string][] = [
      ...(inventory.totalVolumeM3 > 0
        ? ([
            [
              'ESTIMATION',
              `Volume ~${inventory.totalVolumeM3.toFixed(1).replace('.', ',')} m³, soit ${inventory.estimatedTrips} aller${inventory.estimatedTrips > 1 ? 's' : ''}-retour${inventory.estimatedTrips > 1 ? 's' : ''} en ${booking.vehicle.name}.`,
            ],
          ] as [string, string][])
        : []),
      [
        'MAIN-D’ŒUVRE',
        `${inventory.moverCount} manœuvres${inventory.totalWeightKg == null ? '' : ` (~ ${inventory.totalWeightKg} kg, objet le plus lourd ~${inventory.maxItemWeightKg ?? 0} kg)`}${inventory.carpenterCount ? ` + ${inventory.carpenterCount} menuisier${inventory.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ~${durationLabel(inventory.loadingMinutes + inventory.unloadingMinutes)}.`,
      ],
      ...(tolls.length
        ? ([
            [
              'PÉAGES',
              `À la charge du client (non inclus) : ${pdfMoney(tollTotal)} - détail en page annexe.`,
            ],
          ] as [string, string][])
        : []),
      ...(addressNotes.remaining
        ? ([['NOTES', addressNotes.remaining]] as [string, string][])
        : []),
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const recapRows = recapValues.map(([label, value]) => ({
      label,
      lines: doc.splitTextToSize(cleanPdfText(value), contentWidth - 46) as string[],
    }));
    if (recapRows.length) {
      const maxLinesPerCard = 42;
      const chunks = recapRows.flatMap((row) =>
        Array.from({ length: Math.ceil(row.lines.length / maxLinesPerCard) }, (_, index) => ({
          label: index ? `${row.label} (suite)` : row.label,
          lines: row.lines.slice(index * maxLinesPerCard, (index + 1) * maxLinesPerCard),
        })),
      );
      const recapHeight = 8 + chunks.reduce((sum, row) => sum + row.lines.length * 4.6 + 2, 0);
      const drawRecapCard = (rows: typeof chunks, height: number) => {
        doc.setDrawColor(201, 206, 211);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, height, 2, 2, 'S');
        let recapY = y + 6.5;
        rows.forEach((row) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(90, 97, 104);
          doc.text(row.label, margin + 4, recapY);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(30, 32, 35);
          doc.text(row.lines, margin + 42, recapY);
          recapY += row.lines.length * 4.6 + 2;
        });
        y += height + 9;
      };
      const drawContinuationHeader = () => {
        doc.addPage();
        y = pdfHead(
          'Annexe · Inventaire (suite)',
          `${booking.customerName || '-'}${booking.phone ? `  ·  ${booking.phone}` : ''}`,
          `N° ${documentQuote?.reference || booking.reference}  ·  ${(booking.date ?? '').split('-').reverse().join('/')}`,
        );
        y += 1;
      };
      if (recapHeight <= 210) {
        if (y + recapHeight > 278) drawContinuationHeader();
        drawRecapCard(chunks, recapHeight);
      } else {
        for (const row of chunks) {
          const height = 8 + row.lines.length * 4.6 + 2;
          if (y + height > 278) drawContinuationHeader();
          drawRecapCard([row], height);
        }
      }
    }
    const columns = { item: margin, quantity: right - 92, details: right - 80, volume: right };
    const tableHeader = () => {
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(42, 45, 48);
      doc.text('OBJET', columns.item, y);
      doc.text('QTÉ', columns.quantity, y, { align: 'right' });
      doc.text('DÉTAIL', columns.details, y);
      doc.text('VOLUME', columns.volume, y, { align: 'right' });
      y += 2.5;
      doc.setDrawColor(35, 38, 41);
      doc.setLineWidth(0.35);
      doc.line(margin, y, right, y);
      y += 6;
    };
    if (hasInventoryDetails) tableHeader();
    else {
      y = pdfParagraph(
        doc,
        'Aucun objet renseigné.',
        margin,
        y,
        contentWidth,
        9.5,
        false,
        [90, 97, 104],
      );
    }
    const sections = [...new Set(inventory.items.map((item) => item.section))];
    sections.forEach((section) => {
      const sectionItems = inventory.items.filter((item) => item.section === section);
      const sectionCount = sectionItems.reduce((sum, item) => sum + item.quantity, 0);
      const sectionVolume = sectionItems.reduce((sum, item) => sum + item.volumeM3, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const rows = sectionItems.map((item) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const labelLines = doc.splitTextToSize(
          cleanPdfText(item.label),
          columns.quantity - columns.item - 14,
        ) as string[];
        doc.setFontSize(9);
        const detailLines = doc.splitTextToSize(
          cleanPdfText(item.details),
          columns.volume - columns.details - 22,
        ) as string[];
        const height = Math.max(labelLines.length, detailLines.length, 1) * 4.4 + 1.5;
        return { item, labelLines, detailLines, height };
      });
      const drawSectionBand = (title: string) => {
        doc.setFillColor(30, 32, 35);
        doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(cleanPdfText(title), margin + 4, y + 5.4);
        doc.setTextColor(246, 215, 60);
        doc.text(
          cleanPdfText(
            `${sectionCount} objet${sectionCount > 1 ? 's' : ''}  ·  ${sectionVolume.toFixed(2).replace('.', ',')} m³`,
          ),
          right - 4,
          y + 5.4,
          { align: 'right' },
        );
        y += 8;
      };
      if (y + 8 + (rows[0]?.height ?? 0) > 278) {
        doc.addPage();
        y = 24;
        tableHeader();
      }
      drawSectionBand(section);
      rows.forEach(({ item, labelLines, detailLines, height }, index) => {
        if (y + height > 278) {
          doc.addPage();
          y = 24;
          tableHeader();
          drawSectionBand(`${section} (suite)`);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(36, 40, 44);
        doc.text(labelLines, columns.item, y + 4.6);
        doc.text(String(item.quantity), columns.quantity, y + 4.6, { align: 'right' });
        doc.setFontSize(9);
        doc.setTextColor(94, 101, 108);
        doc.text(detailLines, columns.details, y + 4.6);
        doc.setFontSize(10);
        doc.setTextColor(36, 40, 44);
        doc.text(`${item.volumeM3.toFixed(2).replace('.', ',')} m³`, columns.volume, y + 4.6, {
          align: 'right',
        });
        y += height;
        doc.setDrawColor(225, 228, 231);
        doc.setLineWidth(0.15);
        doc.line(margin, y, right, y);
        y += 3.6;
      });
      doc.setDrawColor(220, 223, 227);
      doc.setLineWidth(0.3);
      doc.line(margin, y, right, y);
      y += 7;
    });
    if (inventory.dwellingType) {
      const dwelling = inventory.dwellingType === 'F5 et plus' ? 'F5 et +' : inventory.dwellingType;
      y = inventoryParagraph(`Logement : ${dwelling}`, 8.5, [90, 97, 104], true);
    }
    if (inventory.annexVolumeM3 > 0) {
      const annexDwelling =
        inventory.dwellingType === 'F5 et plus' ? 'F5 et +' : inventory.dwellingType;
      const annexDetails = `Sacs, vaisselle, linge, petits objets (forfait ${annexDwelling} ~${String(referenceDwellingVolume(inventory.dwellingType)).replace('.', ',')} m³, cartons et sacs comptés déduits)`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const annexLines = doc.splitTextToSize(
        cleanPdfText(annexDetails),
        columns.volume - columns.details - 22,
      ) as string[];
      const annexHeight = Math.max(1, annexLines.length) * 4.4 + 1.5;
      if (y + annexHeight > 278) {
        doc.addPage();
        y = 24;
        tableHeader();
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(36, 40, 44);
      doc.text('Effets annexes', columns.item, y);
      doc.setFontSize(9);
      doc.setTextColor(94, 101, 108);
      doc.text(annexLines, columns.details, y);
      doc.setFontSize(10);
      doc.setTextColor(36, 40, 44);
      doc.text(`${inventory.annexVolumeM3.toFixed(2).replace('.', ',')} m³`, columns.volume, y, {
        align: 'right',
      });
      y += annexHeight;
      doc.setDrawColor(225, 228, 231);
      doc.setLineWidth(0.15);
      doc.line(margin, y, right, y);
      y += 5;
    }
    if (y > 220) {
      doc.addPage();
      y = 24;
    }
    doc.setDrawColor(35, 38, 41);
    doc.line(margin, y, right, y);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 32, 35);
    doc.text(
      `Volume total  ·  ${inventory.itemCount} objet${inventory.itemCount > 1 ? 's' : ''}`,
      margin,
      y,
    );
    doc.text(`~ ${inventory.totalVolumeM3.toFixed(1).replace('.', ',')} m³`, right, y, {
      align: 'right',
    });
    y += 9;
    y = inventoryParagraph(
      `Estimation : ${inventory.estimatedTrips} aller${inventory.estimatedTrips > 1 ? 's' : ''}-retour${inventory.estimatedTrips > 1 ? 's' : ''} en ${booking.vehicle.name} (${String(inventory.vehicleCapacityM3).replace('.', ',')} m³, chargement à ${Math.round(inventory.fillRate * 100)} %).`,
      8.5,
      [30, 32, 35],
    );
    y = inventoryParagraph(
      `Main-d’œuvre : ${inventory.moverCount} manœuvres${inventory.totalWeightKg == null ? '' : ` (~ ${inventory.totalWeightKg} kg, objet le plus lourd ~${inventory.maxItemWeightKg ?? 0} kg)`}${inventory.carpenterCount ? ` + ${inventory.carpenterCount} menuisier${inventory.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ~${durationLabel(inventory.loadingMinutes + inventory.unloadingMinutes)}.`,
      8.5,
      [30, 32, 35],
    );
    if (inventory.packingMinutes > 0) {
      y = inventoryParagraph(
        `Emballage : ~${durationLabel(inventory.packingMinutes)}${inventory.packingMinutes > 90 ? ', la veille.' : ', le jour même avant le chargement.'}`,
        8.5,
        [30, 32, 35],
      );
    }
    if (booking.distanceKm > 0) {
      y = inventoryParagraph(
        `Trajet : ~${durationLabel(inventory.travelLegMinutes ?? inventory.travelMinutes)} par trajet (${String(booking.distanceKm).replace('.', ',')} km)${inventory.estimatedTrips > 1 ? `, ${inventory.estimatedTrips} voyages, trajets ~${durationLabel(inventory.travelMinutes)}` : ''}.`,
        8.5,
        [30, 32, 35],
      );
    }
    y = inventoryParagraph(
      `Planning prévisionnel : de ${inventory.startTime} à ${inventory.endTime}, durée de travail ~${durationLabel(inventory.totalMinutes)} (entre ${durationLabel(inventory.lowDurationMinutes, 15)} et ${durationLabel(inventory.highDurationMinutes, 15)}).`,
      8.5,
      [30, 32, 35],
    );
    const maxDayHours = booking.pricingSettings?.movingLaborPlanning?.maxDayHours ?? 8;
    const startParts = inventory.startTime.split(':').map(Number);
    const startMinute = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
    const days = Math.max(
      1,
      Math.floor((startMinute + inventory.totalMinutes - 1) / 1440) -
        Math.floor(startMinute / 1440) +
        1,
    );
    if (inventory.totalMinutes > maxDayHours * 60 + 1) {
      y = inventoryParagraph(
        `Au-delà de ${maxDayHours} h : prévoir ${days} jours ou un véhicule supplémentaire.`,
        8.5,
        [30, 32, 35],
      );
    }
    const inventoryFlags = inventory.flags.map((flag) => flag.toLocaleLowerCase('fr-FR'));
    if (inventory.ready === 'oui') inventoryFlags.push('matériel prêt à être chargé');
    if (inventory.ready === 'non') inventoryFlags.push("matériel pas prêt, emballage par l'équipe");
    if (inventory.stairs === 'oui') inventoryFlags.push('tout passe dans les escaliers');
    if (inventory.stairs === 'balcon') inventoryFlags.push('passage par le balcon');
    if (inventory.stairs === 'non')
      inventoryFlags.push(
        'certains objets ne passent pas dans les escaliers (démontage, fenêtre ou monte-meuble)',
      );
    if (inventory.stairs === 'verif') inventoryFlags.push('passage des escaliers à vérifier');
    if (inventory.stairs === 'balcon' && inventory.balcPx)
      inventoryFlags.push(`supplément balcon : ${money(inventory.balcPx)}`);
    if (inventoryFlags.length) {
      y = inventoryParagraph(`À noter : ${inventoryFlags.join(', ')}.`, 8.5, [30, 32, 35]);
    }
    y = inventoryParagraph(
      "Volumes estimés à partir de moyennes par meuble, selon le format, la taille et le démontage. Le nombre réel d'allers-retours, de manœuvres et la durée dépendent des accès et de la circulation le jour du déménagement.",
      8.5,
      [90, 97, 104],
    );
  }

  const pageCount = doc.getNumberOfPages();
  const pdfReference = documentQuote?.reference || booking.reference;
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    if (!isFinal) {
      doc.saveGraphicsState();
      doc.setGState(doc.GState({ opacity: 0.06 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(84);
      doc.setTextColor(30, 32, 35);
      doc.text('PROVISOIRE', pageWidth / 2, 175, { angle: 35, align: 'center' });
      doc.restoreGraphicsState();
    }
    doc.setDrawColor(220, 223, 227);
    doc.setLineWidth(0.3);
    doc.line(margin, 288.5, right, 288.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(96, 103, 111);
    const pageLabel = cleanPdfText(
      `Devis ${isFinal ? 'final' : 'provisoire'} ${pdfReference}  ·  Page ${page} / ${pageCount}`,
    );
    const availableWidth = contentWidth - doc.getTextWidth(pageLabel) - 8;
    const footer = [
      'DEMENAG EXPRESS PRO MTH',
      settings.businessAddress || 'Dakar, Sénégal',
      settings.businessPhone || '+221 77 510 51 04',
      settings.businessNinea ? `NINEA ${settings.businessNinea}` : '',
      settings.businessRccm ? `RCCM ${settings.businessRccm}` : '',
    ].filter(Boolean);
    while (
      footer.length > 1 &&
      doc.getTextWidth(cleanPdfText(footer.join('  ·  '))) > availableWidth
    )
      footer.splice(footer.length > 3 ? footer.length - 1 : 1, 1);
    doc.text(cleanPdfText(footer.join('  ·  ')), margin, 293);
    doc.text(pageLabel, right, 293, { align: 'right' });
  }
  const blob = doc.output('blob');
  return blob;
}
