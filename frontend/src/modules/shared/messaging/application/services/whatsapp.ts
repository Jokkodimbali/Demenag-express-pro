import type { Settings } from '../../../domain/model';

type WhatsAppPreferences = Pick<Settings, 'whatsappCountryCode' | 'whatsappMode'>;
type WhatsAppPlatform = 'mobile' | 'desktop';

function currentPlatform(): WhatsAppPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const userAgent = navigator.userAgent;
  const touchMac = /Macintosh/u.test(userAgent) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/iu.test(userAgent) || touchMac ? 'mobile' : 'desktop';
}

export function whatsappNumber(phone: string, countryCode = '221') {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits && digits.length <= 9)
    digits = countryCode.replace(/\D/g, '') + digits.replace(/^0+/, '');
  return digits;
}

export function whatsappUrl(
  phone: string,
  message: string,
  preferences?: WhatsAppPreferences,
  platform = currentPlatform(),
) {
  const number = whatsappNumber(phone, preferences?.whatsappCountryCode || '221');
  const text = encodeURIComponent(message);
  if (preferences?.whatsappMode === 'web' && platform === 'desktop')
    return `https://web.whatsapp.com/send?phone=${number}&text=${text}`;

  // wa.me is WhatsApp's universal link: phones can hand it to the installed app,
  // while desktop browsers still reach WhatsApp Web. It also avoids custom-scheme
  // and api.whatsapp.com redirects that mobile browsers may keep in a new tab.
  return `https://wa.me/${number}?text=${text}`;
}
