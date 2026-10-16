import { dateLabel, money } from '../domain/format';
import type { Booking, Quote } from '../domain/model';
export async function downloadQuote(booking: Booking, quote?: Quote) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const price = quote?.price || booking.estimate;
  const text = (s: string) =>
    s
      .replace(/[\u202f\u00a0]/g, ' ')
      .replace(/[–—]/g, '-')
      .replace(/œ/g, 'oe');
  let y = 22;
  const margin = 18,
    width = 174;
  function page(height = 12) {
    if (y + height > 275) {
      doc.addPage();
      y = 20;
    }
  }
  function paragraph(value: string, size = 10, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text(value), width) as string[];
    for (const line of lines) {
      page(6);
      doc.text(line, margin, y);
      y += 6;
    }
    y += 3;
  }
  doc.setTextColor(30, 32, 35);
  paragraph('DEMENAG EXPRESS PRO MTH', 20, true);
  paragraph('Dakar, Sénégal', 10);
  doc.setFillColor(11, 107, 53);
  doc.rect(margin, y, width / 3, 2, 'F');
  doc.setFillColor(246, 215, 60);
  doc.rect(margin + width / 3, y, width / 3, 2, 'F');
  doc.setFillColor(227, 38, 47);
  doc.rect(margin + (width * 2) / 3, y, width / 3, 2, 'F');
  y += 14;
  paragraph(quote?.kind === 'final' ? 'DEVIS FINAL' : 'DEVIS PROVISOIRE', 16, true);
  paragraph(
    `${quote?.reference || booking.reference} · ${dateLabel((quote?.createdAt || booking.createdAt).slice(0, 10))}`,
  );
  paragraph(`CLIENT : ${booking.customerName} · ${booking.phone}`, 11, true);
  paragraph(`Déménagement : ${dateLabel(booking.date)} · ${booking.timeSlot}`);
  paragraph(
    `${booking.vehicle.name} · ${booking.distanceKm} km · ${price.trips} aller(s)-retour(s)`,
  );
  paragraph(`Départ : ${booking.fromAddress}`);
  paragraph(`Arrivée : ${booking.toAddress}`);
  for (const line of price.lines) {
    page(18);
    paragraph(
      `${line.label} : ${line.quantity} × ${money(line.unitPrice)} = ${money(line.total)}`,
      10,
    );
  }
  if (price.discount) paragraph(`Remise : -${money(price.discount)}`);
  page(26);
  doc.setFillColor(246, 215, 60);
  doc.roundedRect(margin, y - 4, width, 18, 2, 2, 'F');
  y += 7;
  paragraph(`TOTAL : ${money(price.total)}`, 16, true);
  y += 8;
  if (quote?.notes || booking.notes) paragraph('Précisions : ' + (quote?.notes || booking.notes));
  paragraph(
    quote?.kind === 'final'
      ? 'Montant établi sur la base du nombre réel d’allers-retours effectués.'
      : 'Estimation provisoire. La disponibilité et les conditions sont confirmées par notre équipe. Le montant final dépend des trajets réellement effectués.',
  );
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Demenag Express · ${booking.reference} · ${i}/${pages}`, margin, 287);
  }
  doc.save(`${quote?.reference || booking.reference}.pdf`);
}
