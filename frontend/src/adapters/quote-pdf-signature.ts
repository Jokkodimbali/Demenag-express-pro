import { assetDataUrl } from './pdf-assets';
import { addPdfImage, pdfParagraph } from './quote-pdf-render';
import type { Settings } from '../domain/model';
import type { jsPDF } from 'jspdf';

type QuoteSignatureInput = {
  doc: jsPDF;
  settings: Settings;
  top: number;
  paymentText: string;
  paymentQr: string;
  paymentQrSize: { width: number; height: number } | null;
  signatureHeight: number;
  contentWidth: number;
  margin: number;
  right: number;
};

export async function drawQuoteSignature({
  doc,
  settings,
  top,
  paymentText,
  paymentQr,
  paymentQrSize,
  signatureHeight,
  contentWidth,
  margin,
  right,
}: QuoteSignatureInput) {
  if (paymentText) {
    const leftWidth = contentWidth / 2 - 4;
    const rightStart = margin + leftWidth + 8;
    doc.setDrawColor(201, 206, 211);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, top, leftWidth, signatureHeight, 2, 2, 'S');
    pdfParagraph(doc, 'MODE DE PAIEMENT', margin + 5, top + 8, leftWidth - 10, 8, true);
    pdfParagraph(doc, paymentText, margin + 5, top + 15, leftWidth - 10, 10, true);
    if (paymentQr && paymentQrSize) {
      pdfParagraph(
        doc,
        'Scannez ce QR code avec l’application Wave pour payer Demenag Express.',
        margin + 5,
        top + 22,
        leftWidth - 10,
        7.5,
        false,
        [90, 97, 104],
      );
      const maxWidth = leftWidth - 10;
      const maxHeight = signatureHeight - 40;
      const scale = Math.min(maxWidth / paymentQrSize.width, maxHeight / paymentQrSize.height);
      const width = paymentQrSize.width * scale;
      const height = paymentQrSize.height * scale;
      addPdfImage(doc, paymentQr, margin + (leftWidth - width) / 2, top + 37, width, height);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(42, 45, 48);
    doc.text('Signature client', rightStart, top + 8);
    doc.setDrawColor(201, 206, 211);
    doc.line(rightStart, top + signatureHeight / 2 - 4, right, top + signatureHeight / 2 - 4);
    doc.text('Cachet et signature Demenag Express', rightStart, top + signatureHeight / 2 + 5);
    const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/cachet.png'));
    const signature = settings.invoiceSignature || (await assetDataUrl('/assets/signature.png'));
    addContainedImage(
      stamp,
      right - 38,
      top + signatureHeight / 2 + 8,
      Math.min(32, signatureHeight / 2 - 8),
      Math.min(32, signatureHeight / 2 - 8),
    );
    addContainedImage(
      signature,
      right - 59,
      top + signatureHeight / 2 + 10,
      25,
      Math.min(17, signatureHeight / 2 - 10),
    );
    return;
  }
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
    addPdfImage(
      doc,
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
