import { assetDataUrl } from '../../../shared/adapters/pdf-assets';
import { addPdfImage, pdfParagraph } from './quote-pdf-render';
import type { Settings } from '../../../shared/domain/model';
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
    const compact = signatureHeight < 70;
    const leftWidth = compact ? contentWidth * 0.58 : contentWidth / 2 - 4;
    const rightStart = compact ? margin + leftWidth + 8 : margin + contentWidth / 2 + 5;
    const rightWidth = right - rightStart;
    doc.setFillColor(244, 245, 247);
    doc.roundedRect(margin, top, leftWidth, signatureHeight, 2.5, 2.5, 'F');
    doc.setFillColor(244, 245, 247);
    doc.roundedRect(rightStart, top, rightWidth, signatureHeight, 2.5, 2.5, 'F');
    if (compact) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(90, 97, 104);
      doc.text('MODE DE PAIEMENT', margin + 5, top + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(42, 45, 48);
      doc.text(paymentText, margin + 5, top + 13);
      if (paymentQr && paymentQrSize) {
        const scale = Math.min(
          (leftWidth - 10) / paymentQrSize.width,
          (signatureHeight - 18) / paymentQrSize.height,
        );
        const width = paymentQrSize.width * scale;
        const height = paymentQrSize.height * scale;
        addPdfImage(doc, paymentQr, margin + (leftWidth - width) / 2, top + 16, width, height);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('SIGNATURE DU CLIENT · BON POUR ACCORD', rightStart + 5, top + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('Écrire « Lu et approuvé », nom et date', rightStart + 5, top + 10.5);
      doc.setDrawColor(174, 180, 187);
      doc.setLineWidth(0.3);
      doc.line(rightStart + 5, top + 21, right - 5, top + 21);
      return;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('MODE DE PAIEMENT', margin + 5, top + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(42, 45, 48);
    doc.text(paymentText, margin + 5, top + 13);
    if (paymentQr && paymentQrSize) {
      doc.setFontSize(7.5);
      doc.setTextColor(90, 97, 104);
      const prompt = 'Scannez ce QR code avec l’application Wave pour payer Demenag Express.';
      const promptLines = doc.splitTextToSize(prompt, leftWidth - 10) as string[];
      doc.text(promptLines, margin + 5, top + 19);
      const maxWidth = leftWidth - 10;
      const maxHeight = signatureHeight - 36 - promptLines.length * 3.3;
      const scale = Math.min(maxWidth / paymentQrSize.width, maxHeight / paymentQrSize.height);
      const width = paymentQrSize.width * scale;
      const height = paymentQrSize.height * scale;
      addPdfImage(
        doc,
        paymentQr,
        margin + (leftWidth - width) / 2,
        top + 23 + promptLines.length * 3.3,
        width,
        height,
      );
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('SIGNATURE DU CLIENT · BON POUR ACCORD', rightStart, top + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(42, 45, 48);
    doc.text('Écrire « Lu et approuvé », nom et date', rightStart, top + 13);
    const stamp = settings.invoiceStamp || (await assetDataUrl('/assets/cachet.png'));
    const signature = settings.invoiceSignature || (await assetDataUrl('/assets/signature.png'));
    doc.setDrawColor(174, 180, 187);
    doc.setLineWidth(0.3);
    doc.line(rightStart, top + 21, right - 5, top + 21);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 97, 104);
    doc.text('CACHET ET SIGNATURE DEMENAG EXPRESS', rightStart, top + 30);
    addContainedImage(stamp, right - 27, top + 31, 19, 17);
    addContainedImage(signature, right - 43, top + 34, 25, 13);
    return;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(42, 45, 48);
  const cardX = (right + margin) / 2 + 2;
  doc.setFillColor(244, 245, 247);
  doc.roundedRect(cardX, top, right - cardX, 50, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(90, 97, 104);
  doc.text('SIGNATURE DU CLIENT · BON POUR ACCORD', cardX + 5, top + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('Écrire « Lu et approuvé », nom et date', cardX + 5, top + 10.5);
  doc.setDrawColor(174, 180, 187);
  doc.setLineWidth(0.3);
  doc.line(cardX + 5, top + 21, right - 5, top + 21);
  doc.setFont('helvetica', 'bold');
  doc.text('CACHET ET SIGNATURE DEMENAG EXPRESS', cardX + 5, top + 30);
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
  addContainedImage(stamp, right - 27, top + 31, 19, 17);
  addContainedImage(signature, right - 43, top + 34, 25, 13);
}
