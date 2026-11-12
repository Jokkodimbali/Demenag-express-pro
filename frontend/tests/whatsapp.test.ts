import assert from 'node:assert/strict';
import test from 'node:test';
import {
  whatsappNumber,
  whatsappUrl,
} from '../src/modules/shared/messaging/application/services/whatsapp.ts';

test('les modes api, wa.me et application utilisent le lien universel WhatsApp sur mobile et ordinateur', () => {
  for (const whatsappMode of ['api', 'wame', 'app'] as const) {
    for (const platform of ['mobile', 'desktop'] as const) {
      const url = whatsappUrl(
        '77 000 00 01',
        'Bonjour Awa, votre devis est prêt.',
        { whatsappCountryCode: '221', whatsappMode },
        platform,
      );
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://wa.me');
      assert.equal(parsed.pathname, '/221770000001');
      assert.equal(parsed.searchParams.get('text'), 'Bonjour Awa, votre devis est prêt.');
    }
  }
});

test('le mode Web ouvre WhatsApp Web sur ordinateur et le lien universel sur mobile', () => {
  const url = whatsappUrl(
    '+221 77 000 00 01',
    'Test',
    {
      whatsappCountryCode: '221',
      whatsappMode: 'web',
    },
    'desktop',
  );
  const desktop = new URL(url);
  const mobile = new URL(
    whatsappUrl(
      '+221 77 000 00 01',
      'Test',
      { whatsappCountryCode: '221', whatsappMode: 'web' },
      'mobile',
    ),
  );

  assert.equal(desktop.origin, 'https://web.whatsapp.com');
  assert.equal(desktop.searchParams.get('phone'), '221770000001');
  assert.equal(mobile.origin, 'https://wa.me');
  assert.equal(mobile.pathname, '/221770000001');
  assert.equal(whatsappNumber('00 221 77 000 00 01'), '221770000001');
});
