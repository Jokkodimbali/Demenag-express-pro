import { Save } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../application/context';
import { PasswordForm } from '../components/PasswordForm';
import { BookingRulesSettings } from '../components/settings/BookingRulesSettings';
import { ContactSettings } from '../components/settings/ContactSettings';
import { TransportSettings } from '../components/settings/TransportSettings';
export function Settings() {
  const { api, catalogue, setCatalogue } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!catalogue || busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.updateCatalogue({
        ...catalogue,
        vehicles: catalogue.vehicles.map((v) => ({
          ...v,
          name: String(form.get(v.id + '-name')),
          active: form.get(v.id + '-active') === 'on',
          prices: [0, 1, 2].map((i) => Number(form.get(v.id + '-' + i))) as [
            number,
            number,
            number,
          ],
        })),
        settings: {
          ...catalogue.settings,
          distanceBounds: [0, 1, 2].map((i) => Number(form.get('distance-' + i))) as [
            number,
            number,
            number,
          ],
          bookingsEnabled: form.get('bookingsEnabled') === 'on',
          clientCancellation: form.get('clientCancellation') === 'on',
          enabledSlots: form.getAll('enabledSlots').map(String),
          ...Object.fromEntries(
            [
              'maxAdvanceDays',
              'minNoticeHours',
              'maxOptions',
              'maxTrips',
              'cancellationNoticeHours',
            ].map((key) => [key, Number(form.get(key))]),
          ),
          labourPrice: Number(form.get('labour')),
          assemblyPrice: Number(form.get('assembly')),
          businessPhone: String(form.get('phone')),
        },
      });
      setCatalogue(updated);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!catalogue) return null;
  return (
    <>
      <form onSubmit={submit} className="settings-form">
        <TransportSettings catalogue={catalogue} />
        <ContactSettings catalogue={catalogue} />
        <BookingRulesSettings catalogue={catalogue} />
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="alert success">
            Les tarifs et paramètres ont été enregistrés.
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy ? 'Enregistrement…' : 'Enregistrer les paramètres'}
        </button>
      </form>
      <PasswordForm />
    </>
  );
}
