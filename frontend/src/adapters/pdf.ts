import { messages } from '../content/fr';
import { dateLabel, money, referenceTierLabels } from '../domain/format';
import type { Booking, Quote, Settings } from '../domain/model';

function notesForPdf(value: string): string {
  const lines = value.trim().split(/\r?\n/);
  if (!/^FICHE D['’]APPEL\b/u.test(lines[0] ?? '')) return value.trim();
  const departure = /^Départ\s*:.*? · étage (.+)$/u.exec(lines[1] ?? '');
  const arrival = /^Arrivée\s*:.*? · étage (.+)$/u.exec(lines[2] ?? '');
  if (!departure || !arrival) return value.trim();
  const access = (value: string) =>
    value.replace(/^(\d+)(?=\s|$)/u, (_match, floor: string) =>
      floor === '1' ? '1er étage' : `${floor}e étage`,
    );
  return [
    lines[0],
    `Accès : A · ${access(departure[1])} ; B · ${access(arrival[1])}`,
    ...lines.slice(3),
  ].join('\n');
}

function addressNotesFrom(value: string): { from: string; to: string; remaining: string } {
  let from = '';
  let to = '';
  const remaining = value
    .split(/\r?\n/u)
    .filter((line) => {
      const departure = /^Repère départ\s*:\s*(.*)$/iu.exec(line);
      if (departure) {
        from = departure[1].trim();
        return false;
      }
      const arrival = /^Repère arrivée\s*:\s*(.*)$/iu.exec(line);
      if (arrival) {
        to = arrival[1].trim();
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
  return { from, to, remaining };
}

function withoutInventoryBlock(value: string): string {
  const lines = value.split(/\r?\n/u);
  const start = lines.findIndex((line) =>
    /^FICHE D['’]APPEL\s*·\s*INVENTAIRE$/iu.test(line.trim()),
  );
  if (start < 0) return value.trim();
  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      (/^Estimation des allers-retours\s*:/iu.test(line.trim()) ||
        /^Estimation\s*:/iu.test(line.trim())),
  );
  return [...lines.slice(0, start), ...(end >= 0 ? lines.slice(end) : [])].join('\n').trim();
}

function durationLabel(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes / 5) * 5);
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}` : `${rest} min`;
}

async function assetDataUrl(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Impossible de charger ${path}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Image invalide'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function downloadQuote(
  booking: Booking,
  quote: Quote | undefined,
  settings: Settings,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const finalQuote = booking.quotes.filter((item) => item.kind === 'final').at(-1);
  const documentQuote = quote ?? finalQuote;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const price = documentQuote?.price || booking.estimate;
  const sourceNotes = notesForPdf(documentQuote ? documentQuote.notes : booking.notes);
  const addressNotes = addressNotesFrom(
    booking.inventorySnapshot ? withoutInventoryBlock(sourceNotes) : sourceNotes,
  );
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const right = pageWidth - margin;
  const clean = (value: string) =>
    value
      .replace(/[\u202f\u00a0]/g, ' ')
      .replace(/≈/g, '~')
      .replace(/[·•]/g, '-')
      .replace(/[’‘]/g, "'")
      .replace(/[“”«»]/g, '"')
      .replace(/×/g, 'x')
      .replace(/[−]/g, '-')
      .replace(/→/g, '>')
      .replace(/[–—]/g, '-')
      .replace(/œ/g, 'oe');
  const pdfMoney = (value: number | null) => clean(money(value));
  let y = 15;

  function paragraph(
    value: string,
    x: number,
    top: number,
    width: number,
    size = 9,
    bold = false,
    color: [number, number, number] = [36, 40, 44],
  ) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(value), width) as string[];
    doc.text(lines, x, top);
    return top + lines.length * (size * 0.42) + 1;
  }
  function ensureSpace(height: number) {
    if (y + height > 278) {
      doc.addPage();
      y = 20;
    }
  }
  function addImage(data: string, x: number, top: number, width: number, height: number) {
    const format = data.startsWith('data:image/jpeg')
      ? 'JPEG'
      : data.startsWith('data:image/webp')
        ? 'WEBP'
        : 'PNG';
    doc.addImage(data, format, x, top, width, height);
  }

  // En-tête : logo et coordonnées à gauche, titre et référence à droite.
  const logo = settings.invoiceLogo || (await assetDataUrl('/assets/logo.png'));
  addImage(logo, margin, y, 18, 18);
  paragraph(settings.businessName || 'DEMENAG EXPRESS PRO MTH', margin + 22, y + 7, 91, 15, true);
  paragraph(
    `${settings.businessAddress || 'Dakar, Sénégal'}  ·  ${settings.businessPhone}`,
    margin + 22,
    y + 13,
    100,
    8,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(35, 37, 40);
  doc.text(documentQuote?.kind === 'final' ? 'DEVIS FINAL' : 'DEVIS PROVISOIRE', right, y + 2, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(94, 101, 108);
  doc.text(
    `Réf. ${documentQuote?.reference || booking.reference}  ·  ${dateLabel((documentQuote?.createdAt || booking.createdAt).slice(0, 10))}`,
    right,
    y + 9,
    { align: 'right' },
  );

  y = 38;
  const segmentWidth = contentWidth / 3;
  [
    [12, 107, 53],
    [246, 215, 60],
    [227, 38, 47],
  ].forEach((color, index) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(margin + index * segmentWidth, y, segmentWidth, 1.4, 'F');
  });

  y = 49;
  paragraph('CLIENT', margin, y, 80, 8, true, [96, 103, 110]);
  paragraph('DATE PRÉVUE', 105, y, 88, 8, true, [96, 103, 110]);
  paragraph(booking.customerName, margin, y + 7, 82, 11, true);
  paragraph(booking.phone, margin, y + 13, 82, 9);
  const schedule = booking.date
    ? `${dateLabel(booking.date)}  -  ${booking.timeSlot}`
    : 'À convenir';
  paragraph(schedule, 105, y + 7, 88, 10, true);
  paragraph(booking.vehicle.name, 105, y + 13, 88, 9);

  y = 73;
  paragraph('TRAJET', margin, y, contentWidth, 8, true, [96, 103, 110]);
  y += 6;
  y = paragraph(`A  ${booking.fromAddress}`, margin, y, contentWidth, 10, true);
  y = paragraph(`B  ${booking.toAddress}`, margin, y, contentWidth, 10, true);
  const bounds = settings.distanceBounds ?? [15, 25, 35];
  y = paragraph(
    `${booking.distanceKm.toLocaleString('fr-FR')} km par la route  ·  Tranche : ${referenceTierLabels(bounds)[price.tier]}`,
    margin,
    y + 1,
    contentWidth,
    9,
  );
  y += 8;

  // Tableau des lignes : désignation, quantité, prix unitaire et montant.
  const qtyX = 120;
  const unitX = 136;
  const amountX = right;
  paragraph('DÉSIGNATION', margin, y, 96, 8, true);
  paragraph('QTÉ', qtyX - 3, y, 15, 8, true);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('P.U.', unitX + 20, y, { align: 'right' });
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
    const labelLines = doc.splitTextToSize(clean(label), 96) as string[];
    const rowHeight = Math.max(12, labelLines.length * 4.5 + 5);
    ensureSpace(rowHeight + 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(39, 42, 45);
    doc.text(labelLines, margin, y + 4);
    doc.text(String(line.quantity), qtyX + 5, y + 4, { align: 'center' });
    doc.text(pdfMoney(line.unitPrice), unitX + 20, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(pdfMoney(line.total), amountX, y + 4, { align: 'right' });
    y += rowHeight;
    doc.line(margin, y, right, y);
  }
  if (price.discount > 0) {
    y += 2;
    paragraph(price.discountLabel ?? 'Remise', margin, y + 3, 100, 9);
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
  doc.setFontSize(17);
  doc.text(pdfMoney(price.total), right - 5, y + 10, { align: 'right' });
  y += 25;

  const tolls = documentQuote?.tolls ?? [];
  if (tolls.length) {
    ensureSpace(14);
    y = paragraph(
      'PÉAGES · À LA CHARGE DU CLIENT · NON INCLUS DANS LE TOTAL',
      margin,
      y,
      contentWidth,
      8.5,
      true,
    );
    for (const toll of tolls) {
      const row = `${toll.label} · ${toll.quantity} passage(s) × ${pdfMoney(toll.unitPrice)}`;
      const rowLines = doc.splitTextToSize(clean(row), contentWidth - 30) as string[];
      ensureSpace(Math.max(10, rowLines.length * 4.5 + 4));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(39, 42, 45);
      doc.text(rowLines, margin, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfMoney(toll.quantity * toll.unitPrice), right, y + 4, { align: 'right' });
      y += Math.max(10, rowLines.length * 4.5 + 4);
      doc.setDrawColor(225, 228, 232);
      doc.line(margin, y, right, y);
    }
    const tollTotal = tolls.reduce((total, toll) => total + toll.quantity * toll.unitPrice, 0);
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(39, 42, 45);
    doc.text('Total péages à régler par le client', margin, y + 5);
    doc.text(pdfMoney(tollTotal), right, y + 5, { align: 'right' });
    y += 12;
  }

  const explanation =
    documentQuote?.kind === 'final'
      ? messages.montantEtabliSurLaBaseDuNombreReel
      : `Devis temporaire, calculé sur ${price.trips} aller(s)-retour(s) estimé(s). Le transport est facturé par aller-retour effectué ; le devis final, basé sur le nombre réel d'allers-retours, sera envoyé par Demenag Express à la fin du déménagement.`;
  y = paragraph(explanation, margin, y, contentWidth, 8.5, false, [92, 99, 106]);
  const inventory = booking.inventorySnapshot;
  const inventorySummary = inventory
    ? [
        ...(addressNotes.from ? [`Repère départ : ${addressNotes.from}`] : []),
        ...(addressNotes.to ? [`Repère arrivée : ${addressNotes.to}`] : []),
        `Estimation : ${inventory.estimatedTrips} aller${inventory.estimatedTrips > 1 ? 's' : ''}-retour${inventory.estimatedTrips > 1 ? 's' : ''} en ${booking.vehicle.name} (${inventory.vehicleCapacityM3.toFixed(1).replace('.', ',')} m³, chargement à ${Math.round(inventory.fillRate * 100)} %).`,
        `Main-d’œuvre estimée : ${inventory.moverCount} manœuvre${inventory.moverCount > 1 ? 's' : ''}${inventory.carpenterCount ? ` + ${inventory.carpenterCount} menuisier${inventory.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ≈ ${durationLabel(inventory.loadingMinutes + inventory.unloadingMinutes)}.`,
        ...(inventory.packingMinutes > 0
          ? [
              `Emballage ≈ ${durationLabel(inventory.packingMinutes)}${inventory.packingMinutes > 90 ? ', à prévoir la veille.' : ', le jour même avant le chargement.'}`,
            ]
          : []),
        ...(inventory.flags.length ? [`À noter : ${inventory.flags.join(', ')}.`] : []),
        ...(addressNotes.remaining ? [addressNotes.remaining] : []),
        'Inventaire détaillé en page suivante.',
      ].join('\n')
    : '';
  const quoteNotes = [
    inventorySummary,
    ...(!inventory ? [addressNotes.from ? `Repère départ : ${addressNotes.from}` : ''] : []),
    ...(!inventory ? [addressNotes.to ? `Repère arrivée : ${addressNotes.to}` : ''] : []),
    ...(!inventory ? [addressNotes.remaining] : []),
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
      for (const line of doc.splitTextToSize(clean(sourceLine), contentWidth) as string[]) {
        ensureSpace(6);
        doc.text(line, margin, y);
        y += 4.5;
      }
    }
    y += 3;
  }
  ensureSpace(12);
  if (settings.invoiceFooter)
    y = paragraph(settings.invoiceFooter, margin, y + 2, contentWidth, 8, false, [92, 99, 106]);

  // Espaces de signature et cachet comme sur le document de référence.
  let signatureY = Math.max(y + 16, 181);
  if (signatureY + 46 > 287) {
    doc.addPage();
    signatureY = 30;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(42, 45, 48);
  doc.text('Signature client', margin, signatureY);
  doc.text('Cachet et signature Demenag Express', right, signatureY, { align: 'right' });
  const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/cachet.png'));
  const signature = settings.invoiceSignature || (await assetDataUrl('/assets/signature.png'));
  function addContainedImage(
    data: string,
    x: number,
    top: number,
    boxWidth: number,
    boxHeight: number,
  ) {
    const dimensions = doc.getImageProperties(data);
    const scale = Math.min(boxWidth / dimensions.width, boxHeight / dimensions.height);
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;
    addImage(data, x + (boxWidth - width) / 2, top + (boxHeight - height) / 2, width, height);
  }
  addContainedImage(stamp, right - 40, signatureY + 5, 38, 38);
  addContainedImage(signature, right - 58, signatureY + 23, 31, 18);

  if (inventory) {
    doc.addPage();
    y = 18;
    paragraph('Inventaire', margin, y, 110, 14, true);
    paragraph(
      `${booking.customerName}${booking.phone ? `  ·  ${booking.phone}` : ''}`,
      margin,
      y + 8,
      110,
      9,
      false,
      [94, 101, 108],
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(94, 101, 108);
    doc.text(`Réf. ${documentQuote?.reference || booking.reference}`, right, y + 8, {
      align: 'right',
    });
    y += 18;
    doc.setDrawColor(35, 38, 41);
    doc.setLineWidth(0.3);
    doc.line(margin, y, right, y);
    y += 7;
    const halfWidth = contentWidth / 2 - 5;
    const accessLine = (
      x: number,
      label: string,
      address: string,
      floor: number,
      lift: boolean,
      reference: string,
    ): number => {
      let nextY = paragraph(label, x, y, halfWidth, 8, true, [96, 103, 110]);
      nextY = paragraph(address, x, nextY, halfWidth, 9.5, true);
      const floorName =
        floor === 0 ? 'Rez-de-chaussée' : floor === 1 ? '1er étage' : `${floor}e étage`;
      nextY = paragraph(
        `${floorName}${lift ? ' · avec ascenseur' : ' · sans ascenseur'}`,
        x,
        nextY,
        halfWidth,
        8.5,
      );
      if (reference.trim())
        nextY = paragraph(`Repère : ${reference.trim()}`, x, nextY, halfWidth, 8.5);
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
      ) + 5;
    if (inventory.dwellingType) {
      y = paragraph(
        `Logement : ${inventory.dwellingType}${inventory.annexIncluded ? ` · effets annexes ≈ ${inventory.annexVolumeM3.toFixed(2).replace('.', ',')} m³` : ' · effets annexes non inclus'}`,
        margin,
        y,
        contentWidth,
        9,
        true,
      );
    }
    if (inventory.ready) {
      y = paragraph(
        inventory.ready === 'oui'
          ? 'Matériel prêt à être chargé.'
          : 'Matériel non prêt : emballage à prévoir par l’équipe.',
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    if (inventory.stairs) {
      y = paragraph(
        inventory.stairs === 'oui'
          ? 'Tout le matériel passe dans les escaliers.'
          : inventory.stairs === 'non'
            ? 'Certains objets ne passent pas dans les escaliers.'
            : 'Passage des objets dans les escaliers à vérifier.',
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    if (booking.questionnaireAnswers?.length) {
      y += 2;
      y = paragraph('Questionnaire client', margin, y, contentWidth, 9, true);
      for (const answer of booking.questionnaireAnswers) {
        y = paragraph(`${answer.question} : ${answer.answer}`, margin, y, contentWidth, 8.5);
      }
      y += 2;
    }
    const columns = { item: margin, quantity: right - 88, details: right - 77, volume: right };
    const tableHeader = () => {
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(42, 45, 48);
      doc.text('OBJET', columns.item, y);
      doc.text('QTÉ', columns.quantity, y, { align: 'right' });
      doc.text('DÉTAIL', columns.details, y);
      doc.text('VOLUME', columns.volume, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(35, 38, 41);
      doc.setLineWidth(0.35);
      doc.line(margin, y, right, y);
      y += 5;
    };
    tableHeader();
    const sections = [...new Set(inventory.items.map((item) => item.section))];
    sections.forEach((section) => {
      const sectionItems = inventory.items.filter((item) => item.section === section);
      if (y + 10 > 278) {
        doc.addPage();
        y = 20;
        tableHeader();
      }
      y = paragraph(
        section.toLocaleUpperCase('fr-FR'),
        margin,
        y,
        contentWidth,
        8,
        true,
        [94, 101, 108],
      );
      sectionItems.forEach((item) => {
        const detailLines = doc.splitTextToSize(
          clean(item.details),
          columns.volume - columns.details - 20,
        ) as string[];
        const labelLines = doc.splitTextToSize(
          clean(item.label),
          columns.quantity - columns.item - 8,
        ) as string[];
        const height = Math.max(7, Math.max(detailLines.length, labelLines.length) * 4 + 2);
        if (y + height > 276) {
          doc.addPage();
          y = 20;
          tableHeader();
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(36, 40, 44);
        doc.text(labelLines, columns.item, y);
        doc.text(String(item.quantity), columns.quantity, y, { align: 'right' });
        doc.setTextColor(94, 101, 108);
        doc.text(detailLines, columns.details, y);
        doc.setTextColor(36, 40, 44);
        doc.text(`${item.volumeM3.toFixed(2).replace('.', ',')} m³`, columns.volume, y, {
          align: 'right',
        });
        y += height;
        doc.setDrawColor(225, 228, 231);
        doc.setLineWidth(0.15);
        doc.line(margin, y, right, y);
        y += 3;
      });
    });
    if (inventory.annexVolumeM3 > 0) {
      if (y + 11 > 278) {
        doc.addPage();
        y = 20;
        tableHeader();
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(36, 40, 44);
      doc.text('Effets annexes', columns.item, y);
      doc.text('Forfait logement, cartons déduits', columns.details, y);
      doc.text(`${inventory.annexVolumeM3.toFixed(2).replace('.', ',')} m³`, columns.volume, y, {
        align: 'right',
      });
      y += 8;
    }
    ensureSpace(52);
    doc.setDrawColor(35, 38, 41);
    doc.line(margin, y, right, y);
    y += 6;
    y = paragraph(
      `Volume total · ${inventory.itemCount} objet${inventory.itemCount > 1 ? 's' : ''} : ${inventory.totalVolumeM3.toFixed(1).replace('.', ',')} m³`,
      margin,
      y,
      contentWidth,
      10,
      true,
    );
    y = paragraph(
      `Estimation : ${inventory.estimatedTrips} aller-retour${inventory.estimatedTrips > 1 ? 's' : ''} en ${booking.vehicle.name} (${inventory.vehicleCapacityM3.toFixed(1).replace('.', ',')} m³, chargement à ${Math.round(inventory.fillRate * 100)} %).`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    y = paragraph(
      `Main-d’œuvre estimée : ${inventory.moverCount} manœuvre${inventory.moverCount > 1 ? 's' : ''}${inventory.carpenterCount ? ` + ${inventory.carpenterCount} menuisier${inventory.carpenterCount > 1 ? 's' : ''}` : ''} · chargement ≈ ${durationLabel(inventory.loadingMinutes)} · déchargement ≈ ${durationLabel(inventory.unloadingMinutes)}.`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    const quotedMovers = documentQuote?.options?.labour;
    if (quotedMovers !== undefined && quotedMovers !== inventory.moverCount) {
      y = paragraph(
        `Effectif facturé selon les lignes du devis : ${quotedMovers} manœuvre${quotedMovers > 1 ? 's' : ''}.`,
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    if (inventory.packingMinutes > 0) {
      y = paragraph(
        `Emballage : ≈ ${durationLabel(inventory.packingMinutes)}${inventory.packingMinutes > 90 ? ', à prévoir la veille.' : ', le jour même avant le chargement.'}`,
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    y = paragraph(
      `Trajets : ≈ ${durationLabel(inventory.travelMinutes)} · durée totale : ${durationLabel(inventory.totalMinutes)} (de ${inventory.startTime} à ${inventory.endTime}, entre ${durationLabel(inventory.lowDurationMinutes)} et ${durationLabel(inventory.highDurationMinutes)}).`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    if (inventory.flags.length) {
      y = paragraph(`À noter : ${inventory.flags.join(', ')}.`, margin, y, contentWidth, 8.5);
    }
    const plan = booking.workPlan ?? [];
    if (plan.length) {
      y += 3;
      ensureSpace(12);
      y = paragraph('PLANNING PRÉVISIONNEL', margin, y, contentWidth, 9, true);
      plan.forEach((step) => {
        const row = `${step.time} · ${step.title} · ${durationLabel(step.minutes)}${step.detail ? ` (${step.detail})` : ''}`;
        ensureSpace(7);
        y = paragraph(row, margin, y, contentWidth, 8);
      });
    }
  }

  const blob = doc.output('blob');
  return blob;
}
