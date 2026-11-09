import { pdfParagraph } from './quote-pdf-render';
import type { Settings } from '../domain/model';
import type { jsPDF } from 'jspdf';

type QuoteTermsInput = {
  doc: jsPDF;
  settings: Settings;
  reference: string;
  terms: string;
  margin: number;
  right: number;
  contentWidth: number;
};

export function drawQuoteTerms({
  doc,
  settings,
  reference,
  terms,
  margin,
  right,
  contentWidth,
}: QuoteTermsInput): number {
  doc.addPage();
  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 32, 35);
  doc.text('Conditions générales', margin, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 97, 104);
  doc.text('Applicables au présent devis', margin, y + 9);
  doc.text(`N° ${reference}`, right, y + 9, { align: 'right' });
  y += 16;
  doc.setDrawColor(35, 38, 41);
  doc.setLineWidth(0.3);
  doc.line(margin, y, right, y);
  y += 9;
  for (const line of terms.split(/\r?\n/u)) {
    if (!line.trim()) {
      y += 2;
      continue;
    }
    if (y + 8 > 278) {
      doc.addPage();
      y = 20;
    }
    const [label, ...rest] = line.split(/:\s*/u);
    if (rest.length) {
      y = pdfParagraph(doc, label, margin, y, contentWidth, 9, true);
      y = pdfParagraph(doc, rest.join(': '), margin, y, contentWidth, 9, false, [60, 66, 72]);
    } else y = pdfParagraph(doc, line, margin, y, contentWidth, 9, false, [60, 66, 72]);
    y += 3;
  }
  if (settings.invoiceFooter)
    y = pdfParagraph(
      doc,
      settings.invoiceFooter,
      margin,
      y + 2,
      contentWidth,
      8,
      false,
      [92, 99, 106],
    );
  return y;
}
