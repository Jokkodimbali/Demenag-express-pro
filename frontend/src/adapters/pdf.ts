import { messages } from '../content/fr';
import { dateLabel, money } from '../domain/format';
import type { Booking, Quote, Settings } from '../domain/model';

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
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const price = quote?.price || booking.estimate;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const right = pageWidth - margin;
  const clean = (value: string) =>
    value
      .replace(/[\u202f\u00a0]/g, ' ')
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
  doc.setFontSize(16);
  doc.setTextColor(35, 37, 40);
  doc.text(quote?.kind === 'final' ? 'DEVIS FINAL' : 'DEVIS PROVISOIRE', right, y + 2, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(94, 101, 108);
  doc.text(
    `Réf. ${quote?.reference || booking.reference}  ·  ${dateLabel((quote?.createdAt || booking.createdAt).slice(0, 10))}`,
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
  paragraph('ADRESSES DU DÉMÉNAGEMENT', margin, y, contentWidth, 8, true, [96, 103, 110]);
  y += 6;
  y = paragraph(`Adresse de retrait : ${booking.fromAddress}`, margin, y, contentWidth, 10, true);
  y = paragraph(`Adresse de dépôt : ${booking.toAddress}`, margin, y, contentWidth, 10, true);
  const tierLine = price.lines.find((line) =>
    line.label.toLocaleLowerCase().includes(booking.vehicle.name.toLocaleLowerCase()),
  )?.label;
  paragraph(
    `${booking.distanceKm.toLocaleString('fr-FR')} km par la route  ·  ${tierLine || `Trajet ${booking.vehicle.name}`}`,
    margin,
    y + 1,
    contentWidth,
    9,
  );
  y += 10;

  // Tableau des lignes : désignation, quantité, prix unitaire et montant.
  const qtyX = 120;
  const unitX = 142;
  const amountX = right;
  paragraph('DÉSIGNATION', margin, y, 96, 8, true);
  paragraph('QTÉ', qtyX - 3, y, 15, 8, true);
  paragraph('P.U.', unitX, y, 22, 8, true);
  doc.text('MONTANT', amountX, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(35, 38, 41);
  doc.setLineWidth(0.65);
  doc.line(margin, y, right, y);
  y += 2;
  doc.setLineWidth(0.18);
  doc.setDrawColor(211, 216, 220);
  for (const line of price.lines) {
    const labelLines = doc.splitTextToSize(clean(line.label), 96) as string[];
    const rowHeight = Math.max(12, labelLines.length * 4.5 + 5);
    ensureSpace(rowHeight + 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
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
    paragraph('Remise', margin, y + 3, 100, 9);
    doc.text(`-${pdfMoney(price.discount)}`, amountX, y + 3, { align: 'right' });
    y += 10;
  }
  y += 8;
  ensureSpace(67);
  doc.setFillColor(246, 215, 60);
  doc.roundedRect(margin, y, contentWidth, 16, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(35, 37, 40);
  doc.setFontSize(11);
  doc.text(
    quote?.kind === 'final' ? 'MONTANT DÉFINITIF' : 'ESTIMATION PROVISOIRE',
    margin + 5,
    y + 10,
  );
  doc.setFontSize(14);
  doc.text(pdfMoney(price.total), right - 5, y + 10, { align: 'right' });
  y += 25;

  const explanation =
    quote?.notes ||
    (quote?.kind === 'final'
      ? messages.montantEtabliSurLaBaseDuNombreReel
      : `Devis temporaire, calculé sur ${price.trips} aller(s)-retour(s) estimé(s). Le transport est facturé par aller-retour effectué ; le devis final, basé sur le nombre réel d'allers-retours, sera envoyé par Demenag Express à la fin du déménagement.`);
  y = paragraph(explanation, margin, y, contentWidth, 8.5, false, [92, 99, 106]);
  if (settings.invoiceFooter)
    y = paragraph(settings.invoiceFooter, margin, y + 2, contentWidth, 8, false, [92, 99, 106]);

  // Espaces de signature et cachet comme sur le document de référence.
  let signatureY = Math.max(y + 17, 181);
  if (signatureY + 52 > 278) {
    doc.addPage();
    signatureY = 30;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(42, 45, 48);
  doc.text('Signature client', margin, signatureY);
  doc.text('Cachet et signature Demenag Express', right, signatureY, { align: 'right' });
  const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/invoice-stamp.png'));
  const signature =
    settings.invoiceSignature || (await assetDataUrl('/assets/invoice-signature.png'));
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

  const blob = doc.output('blob');
  doc.save(`${quote?.reference || booking.reference}.pdf`);
  return blob;
}
