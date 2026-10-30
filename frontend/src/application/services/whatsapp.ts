import type { Settings } from '../../domain/model';

type WhatsAppPreferences = Pick<Settings, 'whatsappCountryCode' | 'whatsappMode'>;

export function whatsappNumber(phone: string, countryCode = '221') {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits && digits.length <= 9)
    digits = countryCode.replace(/\D/g, '') + digits.replace(/^0+/, '');
  return digits;
}

export function whatsappUrl(phone: string, message: string, preferences?: WhatsAppPreferences) {
  const number = whatsappNumber(phone, preferences?.whatsappCountryCode || '221');
  const text = encodeURIComponent(message);
  switch (preferences?.whatsappMode ?? 'api') {
    case 'wame':
      return `https://wa.me/${number}?text=${text}`;
    case 'web':
      return `https://web.whatsapp.com/send?phone=${number}&text=${text}`;
    case 'app':
      return `whatsapp://send?phone=${number}&text=${text}`;
    default:
      return `https://api.whatsapp.com/send?phone=${number}&text=${text}`;
  }
}
