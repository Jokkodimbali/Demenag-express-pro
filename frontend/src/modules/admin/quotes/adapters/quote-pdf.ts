import { assetDataUrl } from '../../../shared/adapters/pdf-assets';
import { addPdfImage, cleanPdfText, pdfParagraph } from './quote-pdf-render';
import { drawQuoteSignature } from './quote-pdf-signature';
import { drawQuoteTerms } from './quote-pdf-terms';
import {
  dateLabel,
  money,
  referenceTierLabels,
} from '../../../shared/application/presentation/format';
import { referenceDwellingVolume } from '../../../moving/domain/estimate/reference-inventory-note';
import { defaultQuoteTerms } from '../../../moving/domain/quote-terms';
import type { Booking, Quote, Settings } from '../../../shared/domain/model';
import { durationLabel, quotePdfNotes } from './quote-pdf-text';

export async function downloadQuote(
  booking: Booking,
  quote: Quote | undefined,
  settings: Settings,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const documentQuote = quote;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const price = documentQuote?.price || booking.estimate;
  const { loadingConditions, addressNotes } = quotePdfNotes(booking, documentQuote);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const right = pageWidth - margin;

  const pdfMoney = (value: number | null) => cleanPdfText(money(value));
  let y = 15;

  function ensureSpace(height: number) {
    if (y + height > 278) {
      doc.addPage();
      y = 20;
    }
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
    `Émis le ${dateLabel((documentQuote?.createdAt || booking.createdAt).slice(0, 10))}`,
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
  const infoWidth = (contentWidth - infoGap * 2) / 3;
  const infoX = [margin, margin + infoWidth + infoGap, margin + 2 * (infoWidth + infoGap)];
  pdfParagraph(doc, 'CLIENT', infoX[0]!, y, infoWidth, 8, true, [96, 103, 110]);
  pdfParagraph(doc, 'DATE PRÉVUE', infoX[1]!, y, infoWidth, 8, true, [96, 103, 110]);
  pdfParagraph(doc, 'VÉHICULE', infoX[2]!, y, infoWidth, 8, true, [96, 103, 110]);
  pdfParagraph(doc, booking.customerName, infoX[0]!, y + 7, infoWidth, 11, true);
  pdfParagraph(doc, booking.phone, infoX[0]!, y + 13, infoWidth, 9);
  const schedule = booking.date
    ? `${dateLabel(booking.date)}  -  ${booking.timeSlot}`
    : booking.month
      ? `${new Date(`${booking.month}-01T12:00:00Z`).toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric',
          timeZone: 'Africa/Dakar',
        })}${booking.timeSlot ? `  -  Début ${booking.timeSlot}` : ''}`
      : 'À convenir';
  pdfParagraph(doc, schedule, infoX[1]!, y + 7, infoWidth, 10, true);
  pdfParagraph(doc, booking.vehicle.name, infoX[2]!, y + 7, infoWidth, 11, true);
  pdfParagraph(
    doc,
    documentQuote?.billingMode === 'driver-rental'
      ? 'Formule Économique · location avec chauffeur'
      : documentQuote?.billingMode === 'standard'
        ? 'Formule Standard'
        : 'Formule Complète',
    infoX[2]!,
    y + 13,
    infoWidth,
    8,
  );

  y = 73;
  pdfParagraph(doc, 'TRAJET', margin, y, contentWidth, 8, true, [96, 103, 110]);
  y += 6;
  y = pdfParagraph(doc, `A  ${booking.fromAddress}`, margin, y, contentWidth, 10, true);
  y = pdfParagraph(doc, `B  ${booking.toAddress}`, margin, y, contentWidth, 10, true);
  const bounds = settings.distanceBounds ?? [15, 25, 35];
  y = pdfParagraph(
    doc,
    `${booking.distanceKm.toLocaleString('fr-FR')} km par la route  ·  Tranche : ${referenceTierLabels(bounds)[price.tier]}`,
    margin,
    y + 1,
    contentWidth,
    9,
  );
  y += 8;

  // Tableau des lignes : désignation, quantité, prix unitaire et montant.
  const qtyX = right - 70;
  const unitX = right - 38;
  const amountX = right;
  pdfParagraph(doc, 'DÉSIGNATION', margin, y, 96, 8, true);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('QTÉ', qtyX, y, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('P.U.', unitX, y, { align: 'right' });
  doc.text('MONTANT', amountX, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(35, 38, 41);
  doc.setLineWidth(0.65);
  doc.line(margin, y, right, y);
  y += 2;
  doc.setLineWidth(0.18);
  doc.setDrawColor(211, 216, 220);
  for (const [index, line] of price.lines.entries()) {
    const label =
      index === 0 && documentQuote?.kind !== 'final' ? `${line.label} - estimé` : line.label;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const labelLines = doc.splitTextToSize(cleanPdfText(label), qtyX - margin - 14) as string[];
    const rowHeight = Math.max(12, labelLines.length * 4.5 + 5);
    ensureSpace(rowHeight + 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(39, 42, 45);
    doc.text(labelLines, margin, y + 4);
    doc.text(String(line.quantity), qtyX, y + 4, { align: 'right' });
    doc.text(pdfMoney(line.unitPrice), unitX, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(pdfMoney(line.total), amountX, y + 4, { align: 'right' });
    y += rowHeight;
    doc.line(margin, y, right, y);
  }
  if (price.discount > 0) {
    y += 2;
    pdfParagraph(doc, price.discountLabel ?? 'Remise', margin, y + 3, 100, 9);
    doc.text(`-${pdfMoney(price.discount)}`, amountX, y + 3, { align: 'right' });
    y += 10;
  }
  y += 8;
  ensureSpace(67);
  const isFinal = documentQuote?.kind === 'final';
  const totalBackground: [number, number, number] = isFinal ? [30, 32, 35] : [246, 215, 60];
  const totalForeground: [number, number, number] = isFinal ? [255, 255, 255] : [35, 37, 40];
  doc.setFillColor(...totalBackground);
  doc.roundedRect(margin, y, contentWidth, 16, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...totalForeground);
  doc.setFontSize(11);
  doc.text(isFinal ? 'TOTAL À PAYER' : 'ESTIMATION PROVISOIRE', margin + 5, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    cleanPdfText(
      `${price.trips} aller(s)-retour(s)${isFinal ? '' : ' estimé(s)'} · ${booking.vehicle.shortName || booking.vehicle.name}`,
    ),
    margin + 5,
    y + 15,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const totalLabel =
    price.tier === 3 &&
    !price.lines.some((line) => line.label.startsWith('Transport') && line.unitPrice > 0)
      ? 'Sur devis'
      : pdfMoney(price.total);
  doc.text(totalLabel, right - 5, y + 10, { align: 'right' });
  y += 25;

  const tolls = documentQuote?.tolls ?? [];
  const tollTotal = tolls.reduce((total, toll) => total + toll.quantity * toll.unitPrice, 0);
  if (tolls.length) {
    y = pdfParagraph(
      doc,
      `Péages à la charge du client (non inclus) : ${pdfMoney(tollTotal)} · détail en page annexe.`,
      margin,
      y,
      contentWidth,
      9,
      true,
    );
    y += 2;
    y = pdfParagraph(
      doc,
      `Péages estimés à votre charge : ${pdfMoney(tollTotal)} · Budget total à prévoir : ${pdfMoney((price.total ?? 0) + tollTotal)}`,
      margin,
      y,
      contentWidth,
      9,
    );
  }

  const paymentModes = [
    settings.paymentWave !== false ? 'Wave' : '',
    settings.paymentCash !== false ? 'espèces' : '',
  ].filter(Boolean);
  const paymentText = paymentModes.length
    ? `${paymentModes.join(' ou ')}${paymentModes.length > 1 ? ' (au choix)' : ''}`
    : '';
  const paymentQr =
    settings.paymentWave !== false && settings.paymentQr
      ? settings.paymentQr.startsWith('/assets/')
        ? await assetDataUrl(settings.paymentQr)
        : settings.paymentQr
      : '';
  const paymentQrSize = paymentQr ? doc.getImageProperties(paymentQr) : null;

  const inventory = booking.inventorySnapshot;
  const hasInventoryDetails = Boolean(inventory?.items.length);
  const quoteNotes = inventory
    ? ''
    : [
        addressNotes.from ? `Repère départ : ${addressNotes.from}` : '',
        addressNotes.to ? `Repère arrivée : ${addressNotes.to}` : '',
        addressNotes.remaining,
      ]
        .filter(Boolean)
        .join('\n');
  if (quoteNotes) {
    y += 8;
    ensureSpace(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(36, 40, 44);
    const sourceLines = quoteNotes.split(/\r?\n/);
    sourceLines[0] = `Note : ${sourceLines[0]}`;
    for (const sourceLine of sourceLines) {
      if (!sourceLine) {
        y += 3;
        continue;
      }
      for (const line of doc.splitTextToSize(cleanPdfText(sourceLine), contentWidth) as string[]) {
        ensureSpace(6);
        doc.text(line, margin, y);
        y += 4.5;
      }
    }
    y += 3;
  }
  if (loadingConditions) {
    y += 3;
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(36, 40, 44);
    doc.text('CONDITIONS DE CHARGEMENT', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 66, 72);
    const conditionLines = loadingConditions.split(/\r?\n/u).slice(1);
    for (const conditionLine of conditionLines) {
      for (const line of doc.splitTextToSize(
        cleanPdfText(conditionLine),
        contentWidth,
      ) as string[]) {
        ensureSpace(6);
        doc.text(line, margin, y);
        y += 4.5;
      }
    }
    y += 2;
  }
  const explanation =
    documentQuote?.billingMode === 'driver-rental'
      ? `Location avec chauffeur : les manœuvres sont fournies et encadrées par le client. Le montant comprend le transport et les prestations de montage sélectionnées${documentQuote.providedCrew ? ` ; ${documentQuote.providedCrew} manœuvre(s) sont à prévoir côté client` : ''}.`
      : documentQuote?.kind === 'final'
        ? `Devis final établi sur la base du nombre réel d'allers-retours effectués (${price.trips}), au tarif de la tranche de distance appliquée.`
        : `Devis temporaire, calculé sur ${price.trips} aller(s)-retour(s) estimé(s). Le transport est facturé par aller-retour effectué : le devis final, basé sur le nombre réel d'allers-retours, sera envoyé par Demenag Express à la fin du déménagement.`;
  y = pdfParagraph(doc, explanation, margin, y, contentWidth, 8.5, false, [92, 99, 106]);
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
  const validityDays = settings.quoteValidityDays ?? 15;
  if (documentQuote?.kind !== 'final' && validityDays > 0) {
    const issueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(
      new Date(documentQuote?.createdAt || booking.createdAt),
    );
    const expiry = new Date(`${issueDate}T12:00:00Z`);
    expiry.setUTCDate(expiry.getUTCDate() + validityDays);
    y = pdfParagraph(
      doc,
      `Devis valable ${validityDays} jours${Number.isNaN(expiry.getTime()) ? '' : ` · jusqu’au ${expiry.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })}`}.`,
      margin,
      y,
      contentWidth,
      8,
      false,
      [92, 99, 106],
    );
  }
  const depositPercent = settings.bookingDepositPercent ?? 0;
  if (depositPercent > 0) {
    const deposit = Math.round(((price.total ?? 0) * depositPercent) / 100 / 500) * 500;
    y = pdfParagraph(
      doc,
      `Acompte à la réservation : ${money(deposit)} (${depositPercent} %) · Solde le jour du déménagement : ${money((price.total ?? 0) - deposit)}.`,
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
  let signatureY = y + 8;
  let signatureHeight = paymentText ? Math.min(112, 287 - signatureY) : 50;
  if (paymentText || signatureHeight < 70 || signatureY + signatureHeight > 287) {
    doc.addPage();
    signatureY = 24;
    signatureHeight = paymentText ? 112 : 50;
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

  if (tolls.length) {
    doc.addPage();
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 32, 35);
    doc.text('PÉAGES', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 97, 104);
    doc.text(
      `${documentQuote?.reference || ''} · ${booking.customerName} · ${booking.vehicle.shortName || booking.vehicle.name}`,
      right,
      y,
      { align: 'right' },
    );
    y += 4;
    doc.setDrawColor(30, 32, 35);
    doc.setLineWidth(0.5);
    doc.line(margin, y, right, y);
    y += 10;
    const tollBoxHeight = 22 + tolls.length * 7.5;
    const tollAmountX = right - 5;
    const tollUnitX = tollAmountX - 38;
    doc.setDrawColor(201, 206, 211);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, tollBoxHeight, 2, 2, 'S');
    doc.setFillColor(247, 248, 249);
    doc.rect(margin + 0.2, y + 0.2, contentWidth - 0.4, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 32, 35);
    doc.text('PÉAGES À LA CHARGE DU CLIENT', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
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
        {
          align: 'right',
        },
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
    y = pdfParagraph(
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

  if (inventory) {
    doc.addPage();
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 32, 35);
    doc.text('Inventaire', margin, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 97, 104);
    doc.text(
      cleanPdfText(`${booking.customerName}${booking.phone ? `  ·  ${booking.phone}` : ''}`),
      margin,
      y + 9,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(94, 101, 108);
    doc.text(
      `Réf. ${documentQuote?.reference || booking.reference} · ${dateLabel(booking.date ?? '')}`,
      right,
      y + 9,
      {
        align: 'right',
      },
    );
    y += 13;
    doc.setDrawColor(35, 38, 41);
    doc.setLineWidth(0.3);
    doc.line(margin, y, right, y);
    y += 9;
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
    const recapRows = [
      ...(inventory.totalVolumeM3 > 0
        ? [
            [
              'ESTIMATION',
              `Volume ~${inventory.totalVolumeM3.toFixed(1).replace('.', ',')} m³, soit ${inventory.estimatedTrips} aller${inventory.estimatedTrips > 1 ? 's' : ''}-retour${inventory.estimatedTrips > 1 ? 's' : ''} en ${booking.vehicle.name}.`,
            ],
          ]
        : []),
      [
        'MAIN-D’ŒUVRE',
        `${inventory.moverCount} manœuvres${inventory.totalWeightKg == null ? '' : ` (~ ${inventory.totalWeightKg} kg, objet le plus lourd ~${inventory.maxItemWeightKg ?? 0} kg)`}${inventory.carpenterCount ? ` + ${inventory.carpenterCount} menuisier${inventory.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ~${durationLabel(inventory.loadingMinutes + inventory.unloadingMinutes)}.`,
      ],
      ...(tolls.length
        ? [
            [
              'PÉAGES',
              `À la charge du client (non inclus) : ${pdfMoney(tollTotal)} - détail en page annexe.`,
            ],
          ]
        : []),
      ...(addressNotes.remaining ? [['NOTES', addressNotes.remaining]] : []),
    ].map(([label, value]) => ({
      label,
      lines: doc.splitTextToSize(cleanPdfText(value), contentWidth - 46) as string[],
    }));
    if (recapRows.length) {
      const recapHeight = 8 + recapRows.reduce((sum, row) => sum + row.lines.length * 4.6 + 2, 0);
      if (y + recapHeight > 270) {
        doc.addPage();
        y = 24;
      }
      doc.setDrawColor(201, 206, 211);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, recapHeight, 2, 2, 'S');
      let recapY = y + 6.5;
      recapRows.forEach((row) => {
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
      y += recapHeight + 9;
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
      if (y + 10 > 278) {
        doc.addPage();
        y = 20;
        tableHeader();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(90, 97, 104);
      doc.text(cleanPdfText(section), margin, y);
      const sectionCount = sectionItems.reduce((sum, item) => sum + item.quantity, 0);
      const sectionVolume = sectionItems.reduce((sum, item) => sum + item.volumeM3, 0);
      doc.text(
        cleanPdfText(
          `${sectionCount} objet${sectionCount > 1 ? 's' : ''} · ${sectionVolume.toFixed(2).replace('.', ',')} m³`,
        ),
        right,
        y,
        { align: 'right' },
      );
      y += 5.5;
      sectionItems.forEach((item) => {
        const detailLines = doc.splitTextToSize(
          cleanPdfText(item.details),
          columns.volume - columns.details - 22,
        ) as string[];
        const labelLines = doc.splitTextToSize(
          cleanPdfText(item.label),
          columns.quantity - columns.item - 14,
        ) as string[];
        const height = Math.max(1, detailLines.length) * 4.4 + 1.5;
        if (y + height > 276) {
          doc.addPage();
          y = 20;
          tableHeader();
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(36, 40, 44);
        doc.text(labelLines, columns.item, y);
        doc.text(String(item.quantity), columns.quantity, y, { align: 'right' });
        doc.setFontSize(9);
        doc.setTextColor(94, 101, 108);
        doc.text(detailLines, columns.details, y);
        doc.setFontSize(10);
        doc.setTextColor(36, 40, 44);
        doc.text(`${item.volumeM3.toFixed(2).replace('.', ',')} m³`, columns.volume, y, {
          align: 'right',
        });
        y += height;
        doc.setDrawColor(225, 228, 231);
        doc.setLineWidth(0.15);
        doc.line(margin, y, right, y);
        y += 5;
      });
    });
    if (inventory.dwellingType) {
      const dwelling = inventory.dwellingType === 'F5 et plus' ? 'F5 et +' : inventory.dwellingType;
      y = pdfParagraph(
        doc,
        `Logement : ${dwelling}`,
        margin,
        y,
        contentWidth,
        8.5,
        true,
        [90, 97, 104],
      );
    }
    if (inventory.annexVolumeM3 > 0) {
      if (y + 11 > 278) {
        doc.addPage();
        y = 20;
        tableHeader();
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(36, 40, 44);
      doc.text('Effets annexes', columns.item, y);
      const annexDwelling =
        inventory.dwellingType === 'F5 et plus' ? 'F5 et +' : inventory.dwellingType;
      const annexDetails = `Sacs, vaisselle, linge, petits objets (forfait ${annexDwelling} ~${String(referenceDwellingVolume(inventory.dwellingType)).replace('.', ',')} m³, cartons et sacs comptés déduits)`;
      const annexLines = doc.splitTextToSize(
        cleanPdfText(annexDetails),
        columns.volume - columns.details - 22,
      ) as string[];
      doc.setFontSize(9);
      doc.setTextColor(94, 101, 108);
      doc.text(annexLines, columns.details, y);
      doc.setFontSize(10);
      doc.setTextColor(36, 40, 44);
      doc.text(`${inventory.annexVolumeM3.toFixed(2).replace('.', ',')} m³`, columns.volume, y, {
        align: 'right',
      });
      y += Math.max(1, annexLines.length) * 4.4 + 1.5;
      doc.setDrawColor(225, 228, 231);
      doc.setLineWidth(0.15);
      doc.line(margin, y, right, y);
      y += 5;
    }
    if (y > 245) {
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
    y = pdfParagraph(
      doc,
      `Estimation : ${inventory.estimatedTrips} aller${inventory.estimatedTrips > 1 ? 's' : ''}-retour${inventory.estimatedTrips > 1 ? 's' : ''} en ${booking.vehicle.name} (${String(inventory.vehicleCapacityM3).replace('.', ',')} m³, chargement à ${Math.round(inventory.fillRate * 100)} %).`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    if (inventory.itemCount > 0 || y > 248) {
      doc.addPage();
      y = 24;
    }
    y = pdfParagraph(
      doc,
      `Main-d’œuvre : ${inventory.moverCount} manœuvres${inventory.totalWeightKg == null ? '' : ` (~ ${inventory.totalWeightKg} kg, objet le plus lourd ~${inventory.maxItemWeightKg ?? 0} kg)`}${inventory.carpenterCount ? ` + ${inventory.carpenterCount} menuisier${inventory.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ~${durationLabel(inventory.loadingMinutes + inventory.unloadingMinutes)}.`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    if (inventory.packingMinutes > 0) {
      y = pdfParagraph(
        doc,
        `Emballage : ~${durationLabel(inventory.packingMinutes)}${inventory.packingMinutes > 90 ? ', la veille.' : ', le jour même avant le chargement.'}`,
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    if (booking.distanceKm > 0) {
      y = pdfParagraph(
        doc,
        `Trajet : ~${durationLabel(inventory.travelLegMinutes ?? inventory.travelMinutes)} par trajet (${String(booking.distanceKm).replace('.', ',')} km)${inventory.estimatedTrips > 1 ? `, ${inventory.estimatedTrips} voyages, trajets ~${durationLabel(inventory.travelMinutes)}` : ''}.`,
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    y = pdfParagraph(
      doc,
      `Planning prévisionnel : de ${inventory.startTime} à ${inventory.endTime}, durée de travail ~${durationLabel(inventory.totalMinutes)} (entre ${durationLabel(inventory.lowDurationMinutes, 15)} et ${durationLabel(inventory.highDurationMinutes, 15)}).`,
      margin,
      y,
      contentWidth,
      8.5,
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
      y = pdfParagraph(
        doc,
        `Au-delà de ${maxDayHours} h : prévoir ${days} jours ou un véhicule supplémentaire.`,
        margin,
        y,
        contentWidth,
        8.5,
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
      y = pdfParagraph(
        doc,
        `À noter : ${inventoryFlags.join(', ')}.`,
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    y = pdfParagraph(
      doc,
      "Volumes estimés à partir de moyennes par meuble, selon le format, la taille et le démontage. Le nombre réel d'allers-retours, de manœuvres et la durée dépendent des accès et de la circulation le jour du déménagement.",
      margin,
      y + 3,
      contentWidth,
      8.5,
      false,
      [90, 97, 104],
    );
  }

  const blob = doc.output('blob');
  return blob;
}
