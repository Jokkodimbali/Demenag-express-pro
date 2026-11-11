import assert from 'node:assert/strict';
import test from 'node:test';
import { whatsappNumber, whatsappUrl } from '../src/modules/shared/messaging/application/services/whatsapp.ts';

test('les modes mobile api, wa.me et application utilisent le lien universel WhatsApp', () => {
  for (const whatsappMode of ['api', 'wame', 'app'] as const) {
    const url = whatsappUrl('77 000 00 01', 'Bonjour Awa, votre devis est prêt.', {
      whatsappCountryCode: '221',
      whatsappMode,
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://wa.me');
    assert.equal(parsed.pathname, '/221770000001');
    assert.equal(parsed.searchParams.get('text'), 'Bonjour Awa, votre devis est prêt.');
  }
});

test('le mode Web reste explicite et le numéro international n’est pas préfixé deux fois', () => {
  const url = whatsappUrl('+221 77 000 00 01', 'Test', {
    whatsappCountryCode: '221',
    whatsappMode: 'web',
  });
  const parsed = new URL(url);

  assert.equal(parsed.origin, 'https://web.whatsapp.com');
  assert.equal(parsed.searchParams.get('phone'), '221770000001');
  assert.equal(whatsappNumber('00 221 77 000 00 01'), '221770000001');
});
