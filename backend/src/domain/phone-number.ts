const senegalMobile = /^(70|71|75|76|77|78)\d{7}$/;

export function normalizePhoneNumber(phone: string): string | null {
  let compact = phone.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;

  if (!compact.startsWith('+')) {
    if (senegalMobile.test(compact)) return `+221${compact}`;
    if (compact.length === 12 && compact.startsWith('221')) compact = `+${compact}`;
  }

  const digits = compact.startsWith('+') ? compact.slice(1) : compact;
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}
