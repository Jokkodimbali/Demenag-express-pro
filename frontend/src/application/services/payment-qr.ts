async function fileImage(file: File): Promise<HTMLImageElement> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(source);
  }
}

function cropWhite(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Impossible de lire cette image.');
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 4;
      if (pixels[offset]! < 235 || pixels[offset + 1]! < 235 || pixels[offset + 2]! < 235) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right <= left || bottom <= top) return canvas.toDataURL('image/png');
  const padding = 12;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(width, right + padding);
  bottom = Math.min(height, bottom + padding);
  const croppedWidth = right - left;
  const croppedHeight = bottom - top;
  const scale = Math.min(1, 900 / Math.max(croppedWidth, croppedHeight));
  const output = document.createElement('canvas');
  output.width = Math.round(croppedWidth * scale);
  output.height = Math.round(croppedHeight * scale);
  const outputContext = output.getContext('2d');
  if (!outputContext) throw new Error('Impossible de préparer cette image.');
  outputContext.drawImage(
    canvas,
    left,
    top,
    croppedWidth,
    croppedHeight,
    0,
    0,
    output.width,
    output.height,
  );
  return output.toDataURL('image/png');
}

export async function normalizePaymentQr(file: File): Promise<string> {
  if (file.size > 5_000_000) throw new Error('Le QR code doit faire moins de 5 Mo.');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer cette image.');
  context.fillStyle = '#fff';

  if (isPdf) {
    const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    GlobalWorkerOptions.workerSrc = worker.default;
    const documentTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await documentTask.promise;
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    } finally {
      await documentTask.destroy();
    }
    return cropWhite(canvas);
  }

  const image = await fileImage(file);
  const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return cropWhite(canvas);
}
