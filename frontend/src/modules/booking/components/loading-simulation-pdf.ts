import type { Draft } from '../application/booking-draft';
import type { MovingEstimate } from '../../moving/domain/estimate/moving-estimate';
import type { Vehicle } from '../../shared/domain/model';
import { loadingRules, type SimPlan } from '../application/services/loading-simulation-model';

type PdfEquipment = { key: string; name: string; quantity: string; why: string; norm: string };
type PdfInput = {
  plan: SimPlan;
  draft: Draft;
  vehicle?: Vehicle;
  blanketLengthCm: number;
  blanketWidthCm: number;
  stock: number;
  estimate?: MovingEstimate | null;
  details: { equipment: PdfEquipment[] };
  imageDataUrl: (path: string) => Promise<string | null>;
};

function pdfLines(
  pdf: InstanceType<(typeof import('jspdf'))['jsPDF']>,
  value: string,
  width: number,
) {
  const result: unknown = pdf.splitTextToSize(value, width);
  if (typeof result === 'string') return [result];
  return Array.isArray(result) && result.every((line): line is string => typeof line === 'string')
    ? result
    : [value];
}

export async function generateLoadingSimulationPdf({
  plan,
  draft,
  vehicle,
  blanketLengthCm,
  blanketWidthCm,
  stock,
  estimate,
  details,
  imageDataUrl,
}: PdfInput): Promise<boolean> {
  try {
    if (!window.DemSim) return false;
    try {
      const { default: JsPDF } = await import('jspdf');
      const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const margin = 16;
      const maxY = 284;
      let y = 18;
      const safe = (value: unknown) =>
        String(value ?? '')
          .normalize('NFC')
          .replace(/[\u2009\u202f\u00a0\u2007]/g, ' ')
          .replace(/[≈]/g, '~')
          .replace(/[·•]/g, '-')
          .replace(/[’‘]/g, "'")
          .replace(/[“”«»]/g, '"')
          .replace(/×/g, 'x')
          .replace(/[−]/g, '-')
          .replace(/→/g, '>')
          .replace(/[—–]/g, '-');
      const addSpace = (height: number) => {
        if (y + height > maxY) {
          pdf.addPage();
          y = 18;
        }
      };
      const imageData = await imageDataUrl('/assets/logo.png');
      const trips = plan.trips;
      const tripTotal = (count: number) =>
        `${count} ${count > 1 ? 'allers-retours' : 'aller-retour'}`;
      const number = (value: number) => (Math.round(value * 10) / 10).toString().replace('.', ',');
      const duration = (minutes: number) => {
        const rounded = Math.max(5, Math.round(minutes / 5) * 5);
        const hours = Math.floor(rounded / 60);
        const remainder = rounded % 60;
        return hours
          ? `${hours} h${remainder ? ` ${String(remainder).padStart(2, '0')}` : ''}`
          : `${remainder} min`;
      };

      if (imageData) pdf.addImage(imageData, 'PNG', margin, y - 4, 14, 14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 32, 35);
      pdf.text('Plan de chargement', margin + (imageData ? 18 : 0), y + 3);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(90, 97, 104);
      pdf.text(safe(`${draft.fromAddress || '-'}  >  ${draft.toAddress || '-'}`), margin, y + 9);
      pdf.text(
        safe(
          `${vehicle?.shortName || vehicle?.name || ''} · ${tripTotal(trips.length)} · volume utile ${number(plan.V.net)} m³`,
        ),
        margin,
        y + 14,
      );
      pdf.text(safe(draft.customerName), pageWidth - margin, y + 14, { align: 'right' });
      y += 20;
      pdf.setDrawColor(30, 32, 35);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      const maxBlankets = Math.max(...trips.map((item) => item.need));
      const totalBlankets = trips.reduce((sum, item) => sum + item.need, 0);
      pdf.setFillColor(30, 32, 35);
      pdf.roundedRect(margin, y - 5, pageWidth - 2 * margin, 16, 1.5, 1.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(246, 215, 60);
      pdf.text(safe(`Serviettes de déménagement à emporter : ${maxBlankets}`), margin + 4, y + 1.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text(
        safe(
          `Format ${blanketLengthCm} x ${blanketWidthCm} cm - ${trips.length > 1 ? `maximum sur un aller-retour (elles reviennent avec le camion), ${totalBlankets} poses au total` : 'pour l’aller-retour'}${maxBlankets > stock ? ` - stock actuel ${stock} : manque ${maxBlankets - stock}` : ''}`,
        ),
        margin + 4,
        y + 7.5,
      );
      y += 18;
      addSpace(80);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(30, 32, 35);
      pdf.text('Méthode de chargement', margin, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11.5);
      pdf.setTextColor(45, 50, 56);
      loadingRules.forEach((rule, index) => {
        const lines = pdfLines(pdf, safe(`${index + 1}. ${rule}`), pageWidth - 2 * margin);
        addSpace(lines.length * 5.4 + 2);
        pdf.text(lines, margin, y);
        y += lines.length * 5.4 + 1.6;
      });
      y += 6;

      for (const [tripIndex, item] of trips.entries()) {
        addSpace(70);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 32, 35);
        pdf.text(`Aller-retour ${tripIndex + 1}`, margin, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        pdf.text(
          safe(
            `${item.nItems} objets · ${number(item.vol)} m³ · remplissage ${item.fill} % · ~${item.kg} kg`,
          ),
          pageWidth - margin,
          y,
          { align: 'right' },
        );
        y += 5;
        const blanketLine = safe(
          `SERVIETTES À PRÉVOIR : ${item.need} (${blanketLengthCm} x ${blanketWidthCm} cm) - stock : ${item.stock}${item.need > item.stock ? ` - manque ${item.need - item.stock}` : ''} - sangles : ${item.straps ?? 0}`,
        );
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        const blanketLines = pdfLines(pdf, blanketLine, pageWidth - 2 * margin - 6);
        const blanketHeight = blanketLines.length * 4.5 + 2;
        pdf.setFillColor(
          item.need <= item.stock ? 255 : 255,
          item.need <= item.stock ? 226 : 205,
          item.need <= item.stock ? 102 : 205,
        );
        pdf.roundedRect(margin, y - 4.2, pageWidth - 2 * margin, blanketHeight, 1, 1, 'F');
        pdf.setTextColor(30, 32, 35);
        pdf.text(blanketLines, margin + 3, y);
        y += blanketHeight + 1;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        const checkText = safe(
          `Contrôles : ${item.checks.map((check) => `${check.ok ? 'OK ' : 'À revoir : '}${check.txt || check.text || check.t || ''}`).join(' · ')}`,
        );
        const checkLines = pdfLines(pdf, checkText, pageWidth - 2 * margin);
        addSpace(checkLines.length * 4 + 3);
        pdf.text(checkLines, margin, y);
        y += checkLines.length * 4 + 2;
        try {
          const snapshot = window.DemSim.snapshot(plan, tripIndex, { wrap: false });
          if (snapshot) {
            const imageHeight = (pageWidth - 2 * margin) * (640 / 1200);
            addSpace(imageHeight + 4);
            pdf.addImage(snapshot, 'JPEG', margin, y, pageWidth - 2 * margin, imageHeight);
            y += imageHeight + 5;
          }
        } catch {
          // Continue with the per-step plan if the device cannot capture the 3D view.
        }

        let stepImages: string[] = [];
        try {
          stepImages =
            window.DemSim.stepShots?.(
              plan,
              tripIndex,
              { wrap: false, bg: 0xffffff, aspect: 1 / 0.92 },
              `pdfc|${vehicle?.id ?? ''}|${tripIndex}|${item.boxes.length}|${item.vol.toFixed(3)}`,
            ) ?? [];
        } catch {
          stepImages = [];
        }
        pdf.addPage();
        y = 18;
        for (const wall of item.walls) {
          addSpace(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(30, 32, 35);
          pdf.text(safe(wall.title.toUpperCase()), margin, y);
          y += 6;
          for (let rowIndex = 0; rowIndex < wall.steps.length; rowIndex += 2) {
            const row = wall.steps.slice(rowIndex, rowIndex + 2);
            const gap = 6;
            const cellWidth = (pageWidth - 2 * margin - gap) / 2;
            const imageHeight = cellWidth * 0.92;
            const prepared = row.map((box) => {
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(10.5);
              const title = pdfLines(pdf, safe(`${box.step}. ${box.u.label}`), cellWidth);
              pdf.setFont('helvetica', 'normal');
              const description = pdfLines(
                pdf,
                safe(
                  `${box.txt}${box.tip ? ` ${box.tip.charAt(0).toUpperCase()}${box.tip.slice(1)}.` : ''}`,
                ),
                cellWidth,
              );
              const protection = box.protTxt
                ? pdfLines(pdf, safe(`${box.protTxt}.`), cellWidth - 3.2)
                : [];
              return {
                box,
                title,
                description,
                protection,
                height:
                  imageHeight +
                  3 +
                  title.length * 4.8 +
                  description.length * 4.5 +
                  (protection.length ? protection.length * 4.5 + 3.4 : 0),
              };
            });
            const rowHeight = Math.max(...prepared.map((cell) => cell.height));
            addSpace(rowHeight + 4);
            prepared.forEach((cell, column) => {
              const x = margin + column * (cellWidth + gap);
              const image = stepImages[cell.box.step - 1];
              if (image) pdf.addImage(image, 'JPEG', x, y, cellWidth, imageHeight);
              else {
                pdf.setDrawColor(220);
                pdf.rect(x, y, cellWidth, imageHeight);
              }
              let cellY = y + imageHeight + 4.6;
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(10.5);
              pdf.setTextColor(30, 32, 35);
              pdf.text(cell.title, x, cellY);
              cellY += cell.title.length * 4.8;
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(90, 97, 104);
              pdf.text(cell.description, x, cellY);
              if (cell.protection.length) {
                cellY += cell.description.length * 4.5 + 1.4;
                pdf.setFillColor(
                  cell.box.prot ? 255 : 255,
                  cell.box.prot ? 226 : 205,
                  cell.box.prot ? 102 : 205,
                );
                pdf.roundedRect(
                  x,
                  cellY - 3.6,
                  cellWidth,
                  cell.protection.length * 4.5 + 2,
                  1,
                  1,
                  'F',
                );
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 32, 35);
                pdf.text(cell.protection, x + 1.6, cellY);
              }
            });
            y += rowHeight + 4;
          }
          y += 2;
        }
      }

      if (estimate) {
        pdf.addPage();
        y = 18;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(30, 32, 35);
        pdf.text('Planning prévisionnel', margin, y + 3);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        pdf.text(
          safe(
            `${estimate.crew} manœuvres${estimate.carpenterCount ? ` + ${estimate.carpenterCount} menuisier${estimate.carpenterCount > 1 ? 's' : ''}` : ''} · début ${estimate.startTime} · fin prévue ${estimate.endTime} · durée ${duration(estimate.totalMinutes)}`,
          ),
          margin,
          y + 9,
        );
        if (estimate.heat && estimate.heat.work < 150) {
          pdf.setFontSize(9);
          pdf.setTextColor(90, 97, 104);
          pdf.text(
            safe(
              `Chaleur ISO 7243 : WBGT ${estimate.heat.wbgt} °C, ${estimate.heat.rest} min de récupération après ${estimate.heat.work} min de portage.`,
            ),
            margin,
            y + 14,
          );
        }
        y += estimate.heat && estimate.heat.work < 150 ? 21 : 16;
        pdf.setFillColor(30, 32, 35);
        pdf.rect(margin, y - 4.5, pageWidth - 2 * margin, 7, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text('HEURE', margin + 3, y);
        pdf.text('ÉTAPE', margin + 30, y);
        pdf.text('DURÉE', pageWidth - margin - 3, y, { align: 'right' });
        y += 6;
        const rowColors: Record<string, [number, number, number]> = {
          Chargement: [246, 215, 60],
          Déchargement: [246, 215, 60],
          Trajet: [111, 168, 220],
          Retour: [111, 168, 220],
          Pause: [61, 220, 132],
          Emballage: [201, 162, 126],
          Arrivée: [174, 180, 187],
          Vérification: [174, 180, 187],
        };
        for (const [index, item] of estimate.planning.entries()) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8.5);
          const detail = item.detail
            ? pdfLines(pdf, safe(item.detail), pageWidth - 2 * margin - 60)
            : [];
          const rowHeight = 5.5 + detail.length * 3.7 + 1.5;
          addSpace(rowHeight + 1);
          if (index % 2) {
            pdf.setFillColor(246, 247, 248);
            pdf.rect(margin, y - 4, pageWidth - 2 * margin, rowHeight, 'F');
          }
          const colorKey = Object.keys(rowColors).find((key) => item.title.startsWith(key));
          const color = colorKey ? rowColors[colorKey] : rowColors.Arrivée;
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.rect(margin, y - 4, 1.6, rowHeight, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9.5);
          pdf.setTextColor(30, 32, 35);
          pdf.text(safe(item.time), margin + 3, y);
          pdf.text(safe(item.title), margin + 30, y);
          pdf.text(duration(item.minutes), pageWidth - margin - 3, y, { align: 'right' });
          if (detail.length) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(90, 97, 104);
            pdf.text(detail, margin + 30, y + 4);
          }
          y += rowHeight;
        }
        addSpace(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 32, 35);
        pdf.text(safe(`Fin prévue : ${estimate.endTime}`), margin, y + 4);
        y += 10;
      }

      if (details.equipment.length) {
        pdf.addPage();
        y = 18;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(30, 32, 35);
        pdf.text('Matériel conseillé', margin, y + 3);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(90, 97, 104);
        pdf.text(
          'N’entre pas dans le prix du devis. Références : ISO 11228-1, EN 12195-1, EN 12522, ISO 7243.',
          margin,
          y + 9,
        );
        y += 16;
        const columns = 3;
        const gap = 5;
        const cellWidth = (pageWidth - 2 * margin - gap * (columns - 1)) / columns;
        const imageHeight = cellWidth * 0.75;
        for (let index = 0; index < details.equipment.length; index += columns) {
          const row = details.equipment.slice(index, index + columns);
          const prepared = row.map((item) => {
            pdf.setFontSize(8.5);
            const reason = pdfLines(pdf, safe(item.why), cellWidth - 4);
            return { item, reason, height: imageHeight + 6 + 5 + 4.5 + reason.length * 3.6 + 5 };
          });
          const rowHeight = Math.max(...prepared.map((cell) => cell.height));
          addSpace(rowHeight + 4);
          prepared.forEach((cell, column) => {
            const x = margin + column * (cellWidth + gap);
            pdf.setDrawColor(201, 206, 211);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(x, y, cellWidth, rowHeight, 2, 2, 'S');
            const image = window.EquipArt?.art(cell.item.key);
            if (image) {
              try {
                pdf.addImage(image, 'PNG', x + 1, y + 1, cellWidth - 2, imageHeight - 2);
              } catch {
                // Keep the equipment details visible when an illustration is unavailable.
              }
            }
            let cellY = y + imageHeight + 5;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(30, 32, 35);
            pdf.text(safe(cell.item.name), x + 2, cellY);
            cellY += 4.6;
            pdf.setFontSize(9);
            pdf.setTextColor(140, 106, 0);
            pdf.text(safe(cell.item.quantity), x + 2, cellY);
            cellY += 4.4;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(75, 87, 95);
            pdf.text(cell.reason, x + 2, cellY);
            cellY += cell.reason.length * 3.6 + 1;
            pdf.setFontSize(7.5);
            pdf.setTextColor(107, 115, 123);
            pdf.text(safe(cell.item.norm), x + 2, cellY);
          });
          y += rowHeight + 5;
        }
      }
      if (plan.out.length) {
        addSpace(8 + plan.out.length * 4.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(30, 32, 35);
        pdf.text('Ne rentre pas dans ce véhicule', margin, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
        plan.out.forEach((message) => {
          pdf.text(safe(`- ${message}`), margin + 3, y);
          y += 4.5;
        });
      }
      const fileName = safe(`Plan-de-chargement-${draft.customerName || 'devis'}`)
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}-]/gu, '');
      pdf.save(`${fileName}.pdf`);
      return true;
    } catch (cause) {
      console.error(cause);
      return false;
    }
  } catch (cause) {
    console.error(cause);
    return false;
  }
}
