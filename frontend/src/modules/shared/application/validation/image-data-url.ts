import { messages } from '../../content/fr';

export async function dataUrl(file: FormDataEntryValue | null, fallback: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) return fallback;
  if (file.size > 2_500_000) throw new Error(messages.imageTropVolumineuse);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
