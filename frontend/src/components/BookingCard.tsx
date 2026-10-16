import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Download,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import { useState } from 'react';
import { downloadQuote } from '../adapters/pdf';
import { useApp } from '../application/context';
import { dateLabel, money, statuses } from '../domain/format';
import type { Booking, BookingStatus, Quote } from '../domain/model';
export function BookingCard({
  booking: b,
  onChange,
  admin = false,
}: {
  booking: Booking;
  onChange: (b: Booking) => void;
  admin?: boolean;
}) {
  const { api } = useApp();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [editing, setEditing] = useState(false);
  const last = b.quotes.at(-1);
  const terminal = ['completed', 'cancelled'].includes(b.status);
  async function change(status: BookingStatus) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onChange(await api.status(b.id, status, b.version));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pdf(quote?: Quote) {
    setError('');
    setBusy(true);
    try {
      await downloadQuote(b, quote);
    } catch {
      setError('Le PDF n’a pas pu être généré. Réessayez.');
    } finally {
      setBusy(false);
    }
  }
  async function quote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      onChange(
        await api.quote(b.id, {
          kind: String(form.get('kind')) as 'provisional' | 'final',
          trips: Number(form.get('trips')),
          customPrice: form.get('customPrice') ? Number(form.get('customPrice')) : null,
          discount: Number(form.get('discount')),
          notes: String(form.get('notes')),
          version: b.version,
        }),
      );
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const wa = last
    ? 'https://wa.me/' +
      b.phone.replace(/\D/g, '') +
      '?text=' +
      encodeURIComponent(
        `Bonjour ${b.customerName}, votre devis ${last.reference} pour la réservation ${b.reference} est disponible dans votre espace Demenag Express. Montant : ${money(last.price.total)}.`,
      )
    : '';
  return (
    <article className="booking-card panel">
      <div className="booking-card-top">
        <span className="reference">{b.reference}</span>
        <span className={'status ' + b.status}>{statuses[b.status]}</span>
      </div>
      <div className="booking-card-main">
        <img src={b.vehicle.image} alt="" />
        <div>
          <h3>{admin ? b.customerName : b.vehicle.name}</h3>
          {admin && (
            <p className="muted">
              {b.phone} · {b.vehicle.name}
            </p>
          )}
          <p>
            <MapPin size={15} />
            <span>
              {b.fromAddress} → {b.toAddress}
            </span>
          </p>
          <p>
            <CalendarDays size={15} />
            {dateLabel(b.date)} · {b.timeSlot}
          </p>
        </div>
        <div className="booking-amount">
          <span>{last ? 'Dernier devis' : 'Estimation'}</span>
          <strong>{money(last?.price.total ?? (last ? null : b.estimate.total))}</strong>
        </div>
      </div>
      <div className="card-actions">
        <button
          className="button secondary small"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Réduire' : 'Voir le détail'}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button className="button secondary small" disabled={busy} onClick={() => pdf(last)}>
          <Download size={16} /> Télécharger le PDF
        </button>
        {!admin && ['pending', 'confirmed'].includes(b.status) && (
          <button
            className="button text danger small"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Annuler cette réservation ?')) void change('cancelled');
            }}
          >
            Annuler
          </button>
        )}
      </div>
      {open && (
        <div className="booking-detail">
          <dl>
            <div>
              <dt>Distance routière</dt>
              <dd>{b.distanceKm} km</dd>
            </div>
            <div>
              <dt>Manœuvres</dt>
              <dd>{b.options.labour}</dd>
            </div>
            <div>
              <dt>Montage / démontage</dt>
              <dd>{b.options.desk + b.options.wardrobe + b.options.bed} meuble(s)</dd>
            </div>
          </dl>
          {b.notes && (
            <p>
              <strong>Précisions :</strong> {b.notes}
            </p>
          )}
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${b.from.join(',')}&destination=${b.to.join(',')}`}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le trajet dans Google Maps ↗
          </a>
          {b.quotes.length > 0 && (
            <div className="quote-history">
              <h4>Historique des devis</h4>
              {b.quotes.map((q) => (
                <div key={q.id}>
                  <span>
                    <strong>{q.reference}</strong> · {q.kind === 'final' ? 'Final' : 'Provisoire'}
                    <small>
                      {dateLabel(q.createdAt.slice(0, 10))} · {q.price.trips} aller(s)-retour(s)
                    </small>
                  </span>
                  <strong>{money(q.price.total)}</strong>
                  <button
                    className="icon-button"
                    disabled={busy}
                    onClick={() => pdf(q)}
                    aria-label={'Télécharger ' + q.reference}
                  >
                    <Download size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {admin && !terminal && (
        <div className="admin-actions">
          {b.status === 'pending' && (
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => change('confirmed')}
            >
              Confirmer la réservation
            </button>
          )}
          {b.status === 'confirmed' && (
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => change('in_progress')}
            >
              Démarrer le déménagement
            </button>
          )}
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Fermer le formulaire' : 'Créer un devis'}
          </button>
          {b.status !== 'in_progress' && (
            <button
              className="button text danger small"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Annuler cette réservation ?')) void change('cancelled');
              }}
            >
              Annuler
            </button>
          )}
        </div>
      )}
      {admin && last && (
        <a className="whatsapp-link" target="_blank" rel="noreferrer" href={wa}>
          <MessageCircle size={17} /> Préparer le message WhatsApp
        </a>
      )}
      {editing && (
        <form onSubmit={quote} className="quote-form">
          <h4>Un nouveau devis pour {b.reference}</h4>
          <div className="field-pair">
            <div>
              <label htmlFor={'kind-' + b.id}>Type de devis</label>
              <select name="kind" id={'kind-' + b.id}>
                <option value="provisional">Provisoire</option>
                {b.status === 'in_progress' && (
                  <option value="final">Final · clôture le déménagement</option>
                )}
              </select>
            </div>
            <div>
              <label htmlFor={'trips-' + b.id}>Allers-retours</label>
              <input
                name="trips"
                id={'trips-' + b.id}
                type="number"
                min={1}
                max={b.pricingSettings?.maxTrips ?? 20}
                step={1}
                defaultValue={last?.price.trips || 1}
                required
              />
            </div>
          </div>
          <div className="field-pair">
            {b.estimate.tier === 3 && (
              <div>
                <label htmlFor={'custom-' + b.id}>Transport par aller-retour (FCFA)</label>
                <input
                  name="customPrice"
                  id={'custom-' + b.id}
                  type="number"
                  min={1}
                  max={10000000}
                  step={1}
                  placeholder="Tarif à convenir"
                />
              </div>
            )}
            <div>
              <label htmlFor={'discount-' + b.id}>Remise (FCFA)</label>
              <input
                name="discount"
                id={'discount-' + b.id}
                type="number"
                min={0}
                max={10000000}
                step={1}
                defaultValue={0}
                required
              />
            </div>
          </div>
          <label htmlFor={'notes-' + b.id}>Note du devis</label>
          <textarea name="notes" id={'notes-' + b.id} rows={3} maxLength={2000} />
          <p className="caption">
            Un devis final est conservé sans modification et clôture la prestation. L’envoi WhatsApp
            reste manuel.
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer le devis'}
          </button>
        </form>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}{' '}
          <button
            className="text-link"
            onClick={() =>
              api
                .booking(b.id)
                .then(onChange)
                .catch((e) => setError(e.message))
            }
          >
            Actualiser
          </button>
        </p>
      )}
    </article>
  );
}
