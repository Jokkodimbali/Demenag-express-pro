export type ContactVcardSaveResult = 'shared' | 'downloaded' | 'cancelled';

export async function saveContactVcards(
  vcards: readonly string[],
  filename: string,
  title: string,
): Promise<ContactVcardSaveResult> {
  if (!vcards.length) return 'cancelled';
  const blob = new Blob([`${vcards.join('\r\n')}\r\n`], { type: 'text/vcard;charset=utf-8' });
  const file = new File([blob], filename, { type: 'text/vcard' });
  if (
    navigator.canShare?.({ files: [file] }) &&
    navigator.share &&
    /Android|iPhone|iPad/i.test(navigator.userAgent)
  ) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}

export async function copyContactText(value: string) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
