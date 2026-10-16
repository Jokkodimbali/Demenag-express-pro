import { messages } from '../content/fr';
import { dateLabel, money } from '../domain/format';
import type { Booking, Quote, Settings } from '../domain/model';
export async function downloadQuote(
  booking: Booking,
  quote: Quote | undefined,
  settings: Settings,
) {
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
  if (settings.invoiceLogo) doc.addImage(settings.invoiceLogo, 'PNG', margin, y, 26, 18);
  paragraph(settings.businessName, 20, true);
  paragraph(settings.businessAddress, 10);
  doc.setFillColor(11, 107, 53);
  doc.rect(margin, y, width / 3, 2, 'F');
  doc.setFillColor(246, 215, 60);
  doc.rect(margin + width / 3, y, width / 3, 2, 'F');
  doc.setFillColor(227, 38, 47);
  doc.rect(margin + (width * 2) / 3, y, width / 3, 2, 'F');
  y += 14;
  paragraph(
    quote?.kind === 'final' ? messages.labelDEVISFINAL : messages.devisProvisoire,
    16,
    true,
  );
  paragraph(
    `${quote?.reference || booking.reference} · ${dateLabel((quote?.createdAt || booking.createdAt).slice(0, 10))}`,
  );
  paragraph(messages.clientDetails(booking.customerName, booking.phone), 11, true);
  paragraph(messages.movingSchedule(dateLabel(booking.date), booking.timeSlot));
  paragraph(
    `${booking.vehicle.name} · ${booking.distanceKm} km · ${price.trips} aller(s)-retour(s)`,
  );
  paragraph(messages.departure(booking.fromAddress));
  paragraph(messages.arrival(booking.toAddress));
  for (const line of price.lines) {
    page(18);
    paragraph(
      messages.priceLine(line.label, line.quantity, money(line.unitPrice), money(line.total)),
      10,
    );
  }
  if (price.discount) paragraph(messages.discountAmount(money(price.discount)));
  page(26);
  doc.setFillColor(246, 215, 60);
  doc.roundedRect(margin, y - 4, width, 18, 2, 2, 'F');
  y += 7;
  paragraph(messages.totalAmount(money(price.total)), 16, true);
  y += 8;
  if (quote?.notes || booking.notes)
    paragraph(messages.precisions + (quote?.notes || booking.notes));
  paragraph(
    quote?.kind === 'final'
      ? messages.montantEtabliSurLaBaseDuNombreReel
      : messages.estimationProvisoireLaDisponibiliteEtLesConditionsSont,
  );
  paragraph(settings.invoiceFooter);
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`${settings.businessName} · ${booking.reference} · ${i}/${pages}`, margin, 287);
  }
  doc.save(`${quote?.reference || booking.reference}.pdf`);
}
