import { addRoundedPdfImage, pdfParagraph } from './quote-pdf-render';
import type { Settings } from '../../../shared/domain/model';
import type { jsPDF } from 'jspdf';

type QuoteTermsInput = {
  doc: jsPDF;
  settings: Settings;
  reference: string;
  terms: string;
  logo: string;
  margin: number;
  right: number;
  contentWidth: number;
};

export function drawQuoteTerms({
  doc,
  settings,
  reference,
  terms,
  logo,
  margin,
  right,
  contentWidth,
}: QuoteTermsInput): number {
  doc.addPage();
  const headY = 16;
  if (logo) addRoundedPdfImage(doc, logo, margin, headY - 4, 13, 13);
  const titleX = margin + (logo ? 17 : 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 32, 35);
  doc.text('Conditions générales', titleX, headY + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 97, 104);
  doc.text('Applicables au présent devis', titleX, headY + 8.4);
  doc.text(`N° ${reference}`, right, headY + 8.4, { align: 'right' });
  doc.setFillColor(30, 32, 35);
  doc.rect(margin, headY + 12, contentWidth, 0.7, 'F');
  doc.setFillColor(246, 215, 60);
  doc.rect(margin, headY + 12, 26, 0.7, 'F');
  let y = headY + 20;
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
      const value = rest.join(': ').replace(/ WhatsApp compris\)\.$/u, ' WhatsApp\ncompris).');
      y = pdfParagraph(doc, label, margin, y, contentWidth, 10, true);
      y = pdfParagraph(doc, value, margin, y, contentWidth, 10, false, [60, 66, 72]);
    } else y = pdfParagraph(doc, line, margin, y, contentWidth, 10, false, [60, 66, 72]);
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
