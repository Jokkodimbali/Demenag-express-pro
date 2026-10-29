import { messages } from '../content/fr';
import { dateLabel, money, referenceTierLabels } from '../domain/format';
import { referenceInventoryNote } from '../domain/reference-inventory-note';
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

function withoutInventoryBlock(
  value: string,
  inventory: NonNullable<Booking['inventorySnapshot']> | undefined,
  fromAddress: string,
  toAddress: string,
): string {
  if (inventory?.sourceInventory) {
    const expected = referenceInventoryNote(inventory.sourceInventory, fromAddress, toAddress);
    const exactStart = value.indexOf(expected);
    if (exactStart >= 0) {
      return `${value.slice(0, exactStart)}${value.slice(exactStart + expected.length)}`.trim();
    }
  }
  const lines = value.split(/\r?\n/u);
  const noteStart = lines.findIndex((line) =>
    /^Déménagement du .+ de .+ \/ au .+$/iu.test(line.trim()),
  );
  if (noteStart >= 0) {
    const estimateStart = lines.findIndex(
      (line, index) => index > noteStart && /^Estimation\s*:/iu.test(line.trim()),
    );
    return [...lines.slice(0, noteStart), ...(estimateStart >= 0 ? lines.slice(estimateStart) : [])]
      .join('\n')
      .trim();
  }
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

function durationLabel(minutes: number, step = 5): string {
  const rounded = Math.max(0, Math.round(minutes / step) * step);
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
  const documentQuote = quote;
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const price = documentQuote?.price || booking.estimate;
  const sourceNotes = notesForPdf(documentQuote ? documentQuote.notes : booking.notes);
  const addressNotes = addressNotesFrom(
    booking.inventorySnapshot
      ? withoutInventoryBlock(
          sourceNotes,
          booking.inventorySnapshot,
          booking.fromAddress,
          booking.toAddress,
        )
      : sourceNotes,
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
    `Réf. ${documentQuote?.reference || booking.reference}  ·  ${dateLabel(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(new Date()))}`,
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
  const qtyX = right - 70;
  const unitX = right - 38;
  const amountX = right;
  paragraph('DÉSIGNATION', margin, y, 96, 8, true);
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
    const labelLines = doc.splitTextToSize(clean(label), qtyX - margin - 14) as string[];
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
    y = paragraph(
      `Péages à la charge du client (non inclus) : ${pdfMoney(tollTotal)} · détail en page annexe.`,
      margin,
      y,
      contentWidth,
      9,
      true,
    );
    y += 2;
  }

  const inventory = booking.inventorySnapshot;
  const hasInventoryDetails = Boolean(inventory?.items.length);
  const inventorySummary = inventory
    ? [
        ...(addressNotes.from ? [`Repère départ : ${addressNotes.from}`] : []),
        ...(addressNotes.to ? [`Repère arrivée : ${addressNotes.to}`] : []),
        ...(addressNotes.remaining ? [addressNotes.remaining] : []),
        ...(hasInventoryDetails ? ['Inventaire détaillé en page suivante.'] : []),
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
  const explanation =
    documentQuote?.kind === 'final'
      ? messages.montantEtabliSurLaBaseDuNombreReel
      : `Devis temporaire, calculé sur ${price.trips} aller(s)-retour(s) estimé(s). Le transport est facturé par aller-retour effectué ; le devis final, basé sur le nombre réel d'allers-retours, sera envoyé par Demenag Express à la fin du déménagement.`;
  y = paragraph(explanation, margin, y, contentWidth, 8.5, false, [92, 99, 106]);
  ensureSpace(12);
  if (settings.invoiceFooter)
    y = paragraph(settings.invoiceFooter, margin, y + 2, contentWidth, 8, false, [92, 99, 106]);

  // Espaces de signature et cachet comme sur le document de référence.
  let signatureY = Math.max(y + 16, 181);
  let deferredSignature = false;
  if (signatureY + 46 > 287) {
    if (tolls.length || hasInventoryDetails) deferredSignature = true;
    else {
      doc.addPage();
      signatureY = 30;
    }
  }
  async function drawSignature(top: number) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(42, 45, 48);
    doc.text('Signature client', margin, top);
    doc.text('Cachet et signature Demenag Express', right, top, { align: 'right' });
    const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/cachet.png'));
    const signature = settings.invoiceSignature || (await assetDataUrl('/assets/signature.png'));
    function addContainedImage(
      data: string,
      x: number,
      imageTop: number,
      boxWidth: number,
      boxHeight: number,
    ) {
      const dimensions = doc.getImageProperties(data);
      const scale = Math.min(boxWidth / dimensions.width, boxHeight / dimensions.height);
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      addImage(
        data,
        x + (boxWidth - width) / 2,
        imageTop + (boxHeight - height) / 2,
        width,
        height,
      );
    }
    addContainedImage(stamp, right - 40, top + 5, 38, 38);
    addContainedImage(signature, right - 58, top + 23, 31, 18);
  }
  if (!deferredSignature) await drawSignature(signatureY);

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
      doc.text(clean(label), margin + 4, tollY);
      doc.setTextColor(90, 97, 104);
      doc.text(
        clean(`${toll.quantity} × ${toll.unitPrice ? pdfMoney(toll.unitPrice) : 'prix à confirmer'}`),
        tollUnitX,
        tollY,
        { align: 'right' },
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 32, 35);
      doc.text(toll.unitPrice ? pdfMoney(toll.quantity * toll.unitPrice) : '—', tollAmountX, tollY, {
        align: 'right',
      });
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
    y = paragraph(
      'Les péages sont réglés directement par le client au passage du véhicule. Ils ne sont pas inclus dans le montant du devis.',
      margin,
      y,
      contentWidth,
      9,
      false,
      [90, 97, 104],
    );
  }

  if (inventory && hasInventoryDetails) {
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
      clean(`${booking.customerName}${booking.phone ? `  ·  ${booking.phone}` : ''}`),
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
      ) + 10;
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
    tableHeader();
    const sections = [...new Set(inventory.items.map((item) => item.section))];
    sections.forEach((section) => {
      const sectionItems = inventory.items.filter((item) => item.section === section);
      if (y + 10 > 278) {
        doc.addPage();
        y = 20;
        tableHeader();
      }
      y = paragraph(section, margin, y, contentWidth, 8.5, true, [90, 97, 104]) + 1;
      sectionItems.forEach((item) => {
        const detailLines = doc.splitTextToSize(
          clean(item.details),
          columns.volume - columns.details - 22,
        ) as string[];
        const labelLines = doc.splitTextToSize(
          clean(item.label),
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
      y = paragraph(`Logement : ${dwelling}`, margin, y, contentWidth, 8.5, true, [90, 97, 104]);
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
      const annexDwelling = inventory.dwellingType === 'F5 et plus' ? 'F5 et +' : inventory.dwellingType;
      const annexDetails = `Sacs, vaisselle, linge, petits objets (forfait ${annexDwelling} ~${inventory.annexVolumeM3.toFixed(2).replace('.', ',')} m³, cartons et sacs comptés déduits)`;
      const annexLines = doc.splitTextToSize(
        clean(annexDetails),
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
    y = paragraph(
      `Estimation : volume ~${inventory.totalVolumeM3.toFixed(1).replace('.', ',')} m³, soit ${inventory.estimatedTrips} aller${inventory.estimatedTrips > 1 ? 's' : ''}-retour${inventory.estimatedTrips > 1 ? 's' : ''} en ${booking.vehicle.shortName || booking.vehicle.name}.`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    if (y > 248) {
      doc.addPage();
      y = 24;
    }
    y = paragraph(
      `Main-d’œuvre : ${inventory.moverCount} manœuvres${inventory.carpenterCount ? ` + ${inventory.carpenterCount} menuisier${inventory.carpenterCount > 1 ? 's' : ''}` : ''}, chargement + déchargement ~${durationLabel(inventory.loadingMinutes + inventory.unloadingMinutes)}.`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    if (inventory.packingMinutes > 0) {
      y = paragraph(
        `Emballage : ~${durationLabel(inventory.packingMinutes)}${inventory.packingMinutes > 90 ? ', la veille.' : ', le jour même avant le chargement.'}`,
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    if (booking.distanceKm > 0) {
      y = paragraph(
        `Trajet : ~${durationLabel(inventory.travelLegMinutes ?? inventory.travelMinutes)} par trajet (${String(booking.distanceKm).replace('.', ',')} km)${inventory.estimatedTrips > 1 ? `, ${inventory.estimatedTrips} voyages, trajets ~${durationLabel(inventory.travelMinutes)}` : ''}.`,
        margin,
        y,
        contentWidth,
        8.5,
      );
    }
    y = paragraph(
      `Planning prévisionnel : de ${inventory.startTime} à ${inventory.endTime}, durée ~${durationLabel(inventory.totalMinutes)} (entre ${durationLabel(inventory.lowDurationMinutes, 15)} et ${durationLabel(inventory.highDurationMinutes, 15)}).`,
      margin,
      y,
      contentWidth,
      8.5,
    );
    const maxDayHours = booking.pricingSettings?.movingLaborPlanning?.maxDayHours ?? 8;
    const days = Math.max(2, Math.ceil(inventory.totalMinutes / (maxDayHours * 60)));
    if (inventory.totalMinutes > maxDayHours * 60 + 1) {
      y = paragraph(
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
    if (inventory.stairs === 'non')
      inventoryFlags.push('certains objets ne passent pas dans les escaliers (démontage, fenêtre ou monte-meuble)');
    if (inventory.stairs === 'verif') inventoryFlags.push('passage des escaliers à vérifier');
    if (inventoryFlags.length) {
      y = paragraph(`À noter : ${inventoryFlags.join(', ')}.`, margin, y, contentWidth, 8.5);
    }
    y = paragraph(
      "Volumes estimés à partir de moyennes par meuble, selon le format, la taille et le démontage. Le nombre réel d'allers-retours, de manœuvres et la durée dépendent des accès et de la circulation le jour du déménagement.",
      margin,
      y + 3,
      contentWidth,
      8.5,
      false,
      [90, 97, 104],
    );
  }

  if (deferredSignature) {
    signatureY = Math.max(y + 16, 181);
    if (signatureY + 46 > 287) {
      doc.addPage();
      signatureY = 30;
    }
    await drawSignature(signatureY);
  }

  const blob = doc.output('blob');
  return blob;
}
