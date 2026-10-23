const databaseName = 'demenag-inventory-illustrations';
const storeName = 'images';

function openIllustrationDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("La base d'illustrations est indisponible."));
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error("L'image n'a pas pu être lue."));
    reader.onerror = () => reject(reader.error ?? new Error("L'image n'a pas pu être lue."));
    reader.readAsDataURL(blob);
  });
}

async function compressIllustration(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choisissez une image JPG, PNG ou WebP.');
  if (file.size > 10_000_000) throw new Error("L'image doit faire moins de 10 Mo.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de traiter cette image.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const compressed = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Impossible de compresser cette image.'))),
      'image/webp',
      0.78,
    ),
  );
  if (compressed.size > 700_000)
    throw new Error("L'image reste trop volumineuse après compression.");
  return readAsDataUrl(compressed);
}

export async function readInventoryIllustration(key: string): Promise<string | null> {
  const database = await openIllustrationDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () =>
        reject(request.error ?? new Error("L'image n'a pas pu être chargée."));
    });
  } finally {
    database.close();
  }
}

export async function saveInventoryIllustration(key: string, file: File): Promise<string> {
  const dataUrl = await compressIllustration(file);
  const database = await openIllustrationDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(dataUrl, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("L'image n'a pas pu être enregistrée."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("L'image n'a pas pu être enregistrée."));
    });
  } finally {
    database.close();
  }
  return dataUrl;
}
