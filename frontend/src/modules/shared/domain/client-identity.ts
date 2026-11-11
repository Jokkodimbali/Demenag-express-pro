export function normalizedClientPhone(phone: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('221')) digits = digits.slice(3);
  return digits;
}

export function clientIdentifier(phone: string) {
  return normalizedClientPhone(phone).slice(-2).padStart(2, '0');
}
