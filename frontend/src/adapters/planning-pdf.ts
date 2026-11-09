import type { Booking, Driver } from '../domain/model';
import { assetDataUrl } from './pdf-assets';

export async function downloadPlanningWeekPdf(
  bookings: Booking[],
  drivers: Driver[],
  anchor: string,
  filtersApplied = false,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const date = new Date(`${anchor}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const start = date.toISOString().slice(0, 10);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${start}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const margin = 14;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageBottom = pdf.internal.pageSize.getHeight() - 12;
  const clean = (value: string) =>
    value
      .normalize('NFC')
      .replace(/[\u2009\u202f\u00a0\u2007]/gu, ' ')
      .replace(/[’‘]/gu, "'")
      .replace(/→/gu, '>')
      .replace(/[–—]/gu, '-')
      .replace(/œ/gu, 'oe')
      .replace(/Œ/gu, 'OE');
  const dayLabel = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Africa/Dakar',
    });
  const timeRangeFor = (booking: Booking) => {
    const first =
      booking.inventorySnapshot?.startTime ||
      booking.workPlan?.[0]?.time ||
      booking.timeSlot.match(/\b\d{1,2}:\d{2}\b/u)?.[0] ||
      '08:00';
    const [hours, minutes] = first.split(':').map(Number);
    const from = (hours ?? 8) * 60 + (minutes ?? 0);
    const end = booking.inventorySnapshot?.endTime;
    const [endHours, endMinutes] = end?.split(':').map(Number) ?? [];
    const explicitEnd = end ? (endHours ?? 0) * 60 + (endMinutes ?? 0) : 0;
    const plannedDuration =
      booking.inventorySnapshot?.totalMinutes ??
      booking.workPlan?.reduce((total, step) => total + step.minutes, 0) ??
      0;
    const toMinutes = (value: number) =>
      `${String(Math.floor((value % 1440) / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    const to =
      explicitEnd > from
        ? explicitEnd
        : explicitEnd && explicitEnd <= from
          ? explicitEnd + 1440
          : plannedDuration
            ? from + plannedDuration
            : from + 240;
    return `${toMinutes(from)} - ${toMinutes(to)}${to > 1440 ? ' (lendemain)' : ''}`;
  };
  const employees = new Map(drivers.map((driver) => [driver.id, driver.name]));
  const cellX = [margin, margin + 28, margin + 52, margin + 112, margin + 138, margin + 200];
  const cellWidths = [27, 23, 58, 25, 60, pageWidth - margin - (margin + 200)];
  let y = 16;
  const logo = await assetDataUrl('/assets/logo.png').catch(() => '');
  if (logo) {
    pdf.addImage(logo, logo.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG', margin, y - 5, 13, 13);
  }
  const titleX = logo ? margin + 17 : margin;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(30, 32, 35);
  pdf.text(clean('Planning de la semaine'), titleX, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(90, 97, 104);
  pdf.text(
    clean(
      `Du ${dayLabel(days[0] ?? start)} au ${dayLabel(days[6] ?? start)}${filtersApplied ? ' - filtres appliqués' : ''}`,
    ),
    titleX,
    y + 6,
  );
  y += 15;
  pdf.setFillColor(30, 32, 35);
  pdf.rect(margin, y, pageWidth - margin * 2, 0.7, 'F');
  y += 8;

  for (const day of days) {
    const rows = bookings
      .filter((booking) => booking.date === day && booking.status !== 'cancelled')
      .sort((left, right) => timeRangeFor(left).localeCompare(timeRangeFor(right)));
    if (y > pageBottom - 10) {
      pdf.addPage();
      y = 16;
    }
    pdf.setFillColor(30, 32, 35);
    pdf.rect(margin, y - 4.6, pageWidth - margin * 2, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(
      clean(dayLabel(day).replace(/^./u, (character) => character.toUpperCase())),
      margin + 3,
      y,
    );
    pdf.setTextColor(246, 215, 60);
    pdf.text(clean(`${rows.length} rendez-vous`), pageWidth - margin - 3, y, { align: 'right' });
    y += 7;
    if (rows.length === 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120, 126, 134);
      pdf.text(clean('Aucun rendez-vous.'), margin + 3, y);
      y += 7;
      continue;
    }
    for (let index = 0; index < rows.length; index += 1) {
      const booking = rows[index];
      if (!booking) continue;
      const crewIds = [
        ...(booking.crew?.chauffeur ?? (booking.driverId ? [booking.driverId] : [])),
        ...(booking.crew?.menuisier ?? []),
        ...(booking.crew?.manoeuvre ?? []),
      ];
      const cells = [
        timeRangeFor(booking),
        booking.reference,
        `${booking.customerName}${booking.phone ? ` - ${booking.phone}` : ''}`,
        booking.vehicle.name.match(/sprinter|trafic|master/iu)?.[0] ?? booking.vehicle.name,
        crewIds.map((id) => employees.get(id) ?? '?').join(', ') || 'Sans équipe',
        `${booking.fromAddress || '-'} > ${booking.toAddress || '-'}`,
      ];
      pdf.setFontSize(9);
      const lines = cells.map(
        (text, cellIndex) =>
          pdf.splitTextToSize(clean(text), cellWidths[cellIndex] ?? 20) as string[],
      );
      const rowHeight = Math.max(...lines.map((line) => line.length)) * 4 + 2.6;
      if (y + rowHeight > pageBottom) {
        pdf.addPage();
        y = 16;
      }
      if (index % 2) {
        pdf.setFillColor(246, 247, 248);
        pdf.rect(margin, y - 3.6, pageWidth - margin * 2, rowHeight, 'F');
      }
      lines.forEach((line, cellIndex) => {
        pdf.setFont('helvetica', cellIndex < 2 ? 'bold' : 'normal');
        pdf.setTextColor(30, 32, 35);
        pdf.text(line, (cellX[cellIndex] ?? margin) + 2, y);
      });
      y += rowHeight;
    }
    y += 4;
  }
  pdf.save(clean(`Planning-semaine-${start}.pdf`));
}
