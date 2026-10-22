import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBookingForm, type AdminQuoteConfig } from '../application/useBookingForm';
import { normalizedClientPhone } from '../application/services/client-summary';
import { CallInventory } from '../components/booking/CallInventory';
import { TollRateSelector } from '../components/TollRateSelector';
import { inventoryNote } from '../domain/inventory';
import { money, today } from '../domain/format';
import { routes } from '../routing/routes';

const RouteMap = lazy(() => import('../components/RouteMap'));

export function AdminCreateQuote() {
  const [quoteConfig, setQuoteConfig] = useState<AdminQuoteConfig>({
    trips: 1,
    discount: 0,
    customPrice: null,
  });
  const state = useBookingForm({ mode: 'admin-quote', quoteConfig });
  const {
    catalogue,
    loading,
    error,
    reload,
    draft,
    setDraft,
    selected,
    price,
    tiers,
    estimating,
    estimateError,
    submitError,
    submitting,
    submit,
    tollLines,
    setTollLines,
    option,
    extras,
    clientRecognition,
    recognizingClient,
  } = state;
  const inventoryText = inventoryNote(draft.inventory);
  const totalTolls = tollLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountTooHigh = Boolean(
    price &&
    (price.tier !== 3 || quoteConfig.customPrice) &&
    quoteConfig.discount > price.lines.reduce((sum, line) => sum + line.total, 0),
  );
  const quoteDate = draft.date ? draft.date.split('-').reverse().join('/') : '—';
  const bounds = catalogue?.settings.distanceBounds ?? [15, 25, 35];
  const previewTier = !draft.route
    ? 0
    : draft.route.distanceKm < bounds[0]
      ? 0
      : draft.route.distanceKm <= bounds[1]
        ? 1
        : draft.route.distanceKm <= bounds[2]
          ? 2
          : 3;
  const previewTransportUnit =
    previewTier === 3 ? (quoteConfig.customPrice ?? 0) : (selected?.prices[previewTier] ?? 0);
  const previewLines =
    price?.lines ??
    (selected
      ? [
          {
            label: `Transport ${selected.name} · ${tiers[previewTier] ?? 'moins de 15 km'} (aller-retour)`,
            quantity: quoteConfig.trips,
            unitPrice: previewTransportUnit,
            total: previewTransportUnit * quoteConfig.trips,
          },
          ...extras
            .filter(([key]) => draft.options[key] > 0)
            .map(([key, label]) => ({
              label,
              quantity: draft.options[key],
              unitPrice:
                key === 'labour'
                  ? (catalogue?.settings.labourPrice ?? 0)
                  : (catalogue?.settings.assemblyPrice ?? 0),
              total:
                draft.options[key] *
                (key === 'labour'
                  ? (catalogue?.settings.labourPrice ?? 0)
                  : (catalogue?.settings.assemblyPrice ?? 0)),
            })),
          ...tollLines.map((line) => ({
            label: line.label,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.quantity * line.unitPrice,
          })),
        ]
      : []);
  const previewSubtotal = previewLines.reduce((sum, line) => sum + line.total, 0);
  const previewTotal = price
    ? price.total
    : previewTier === 3 && !quoteConfig.customPrice
      ? null
      : previewSubtotal >= quoteConfig.discount
        ? previewSubtotal - quoteConfig.discount
        : null;
  const onTollToggle = (line: (typeof tollLines)[number], checked: boolean) =>
    setTollLines((current) =>
      checked
        ? [...current.filter((existing) => existing.id !== line.id), line]
        : current.filter((existing) => existing.id !== line.id),
    );

  if (loading)
    return (
      <div className="panel loading" role="status">
        Chargement du catalogue…
      </div>
    );
  if (error || !catalogue || !selected)
    return (
      <div className="alert error" role="alert">
        {error || 'Catalogue indisponible.'}
        <button className="button secondary" onClick={reload}>
          Réessayer
        </button>
      </div>
    );

  return (
    <div className="admin-quote-page">
      <div className="admin-quote-heading">
        <div>
          <p className="eyebrow">NOUVEAU DEVIS · CLIENT EN AGENCE</p>
          <h2>CRÉER UN DEVIS</h2>
          <p>Complétez la fiche d’appel. Le devis à droite se met à jour pendant la saisie.</p>
        </div>
        <Link to={routes.administration} className="button secondary small">
          <ArrowLeft size={16} /> Vue d’ensemble
        </Link>
      </div>
      <form id="admin-quote-form" onSubmit={submit} className="admin-quote-layout">
        <div className="admin-quote-fields">
          <section className="admin-quote-card">
            <h3>NOUVEAU DEVIS · CLIENT EN AGENCE</h3>
            <div className="admin-quote-identity">
              <label>
                Nom du client
                <input
                  required
                  maxLength={100}
                  value={draft.customerName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, customerName: event.target.value }))
                  }
                  placeholder="Nom du client"
                />
              </label>
              <label>
                Téléphone
                <input
                  required
                  type="tel"
                  maxLength={25}
                  value={draft.customerPhone}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, customerPhone: event.target.value }))
                  }
                  placeholder="Téléphone"
                />
              </label>
              <label>
                Date prévue
                <input
                  type="date"
                  min={today()}
                  value={draft.date}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </label>
              <label>
                Heure prévue
                <input
                  type="time"
                  required={Boolean(draft.date)}
                  value={draft.timeSlot}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, timeSlot: event.target.value }))
                  }
                />
              </label>
            </div>
            {recognizingClient && (
              <p className="muted" role="status">
                Vérification du client…
              </p>
            )}
            {clientRecognition &&
              clientRecognition.phone === normalizedClientPhone(draft.customerPhone) && (
                <p className="client-recognition">
                  Client déjà connu : {clientRecognition.name} · {clientRecognition.bookingCount}{' '}
                  réservation(s)
                </p>
              )}
            <div className="admin-quote-vehicles" role="group" aria-label="Véhicule">
              {catalogue.vehicles.map((vehicle) => (
                <button
                  type="button"
                  key={vehicle.id}
                  disabled={vehicle.active === false}
                  aria-pressed={draft.vehicleId === vehicle.id}
                  className={draft.vehicleId === vehicle.id ? 'active' : ''}
                  onClick={() => setDraft((current) => ({ ...current, vehicleId: vehicle.id }))}
                >
                  {vehicle.name.replace(/^(Mercedes|Renault) /, '')}
                </button>
              ))}
            </div>
          </section>

          <section className="admin-quote-card">
            <h3>TRAJET · CARTE</h3>
            <Suspense fallback={<div className="map loading">Chargement de la carte…</div>}>
              <RouteMap tollLines={tollLines} onTollToggle={onTollToggle} />
            </Suspense>
            {draft.fromAddress && draft.toAddress && (
              <a
                className="button secondary small admin-quote-map-link"
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(draft.fromAddress)}&destination=${encodeURIComponent(draft.toAddress)}`}
              >
                Vérifier dans Google Maps
              </a>
            )}
            <p className="admin-quote-distance">
              Distance :{' '}
              <strong>{draft.route ? `${draft.route.distanceKm} km` : 'À calculer'}</strong> ·
              Tranche : <strong>{price ? tiers[price.tier] : '—'}</strong>
            </p>
            {price?.tier === 3 && (
              <label>
                Tarif par aller-retour au-delà de 35 km
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  required
                  value={quoteConfig.customPrice ?? ''}
                  onChange={(event) =>
                    setQuoteConfig((current) => ({
                      ...current,
                      customPrice: event.target.value
                        ? Math.max(1, Number(event.target.value))
                        : null,
                    }))
                  }
                />
              </label>
            )}
          </section>

          <section className="admin-quote-card">
            <div className="admin-quote-card-head">
              <h3>PÉAGES</h3>
              <strong>{money(totalTolls)}</strong>
            </div>
            <p className="muted">
              Cochez les péages traversés. Un aller-retour compte deux passages. Vous pouvez aussi
              toucher un péage sur la carte.
            </p>
            <TollRateSelector lines={tollLines} onToggle={onTollToggle} />
          </section>

          <section className="admin-quote-card admin-quote-services">
            <h3>TRANSPORT ET OPTIONS</h3>
            <div className="admin-quote-service-row">
              <div>
                <strong>Allers-retours prévus</strong>
                <span>Transport · {selected.name}</span>
              </div>
              <div className="admin-quote-stepper">
                <button
                  type="button"
                  aria-label="Retirer un aller-retour"
                  disabled={quoteConfig.trips <= 1}
                  onClick={() =>
                    setQuoteConfig((current) => ({
                      ...current,
                      trips: Math.max(1, current.trips - 1),
                    }))
                  }
                >
                  <Minus size={17} />
                </button>
                <output>{quoteConfig.trips}</output>
                <button
                  type="button"
                  aria-label="Ajouter un aller-retour"
                  disabled={quoteConfig.trips >= catalogue.settings.maxTrips}
                  onClick={() =>
                    setQuoteConfig((current) => ({
                      ...current,
                      trips: Math.min(catalogue.settings.maxTrips, current.trips + 1),
                    }))
                  }
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
            {extras.map(([key, label]) => (
              <div className="admin-quote-service-row" key={key}>
                <div>
                  <strong>{label}</strong>
                  <span>
                    {money(
                      key === 'labour'
                        ? catalogue.settings.labourPrice
                        : catalogue.settings.assemblyPrice,
                    )}{' '}
                    / unité
                  </span>
                </div>
                <div className="admin-quote-stepper">
                  <button
                    type="button"
                    aria-label={`Retirer ${label}`}
                    disabled={draft.options[key] === 0}
                    onClick={() => option(key, -1)}
                  >
                    <Minus size={17} />
                  </button>
                  <output>{draft.options[key]}</output>
                  <button
                    type="button"
                    aria-label={`Ajouter ${label}`}
                    disabled={draft.options[key] >= catalogue.settings.maxOptions}
                    onClick={() => option(key, 1)}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
            ))}
            <div className="admin-quote-discount">
              <label>
                Remise (FCFA)
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={quoteConfig.discount}
                  onChange={(event) =>
                    setQuoteConfig((current) => ({
                      ...current,
                      discount: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </label>
              <span>Remise appliquée sur le total.</span>
            </div>
            <label>
              Remarque libre
              <textarea
                rows={3}
                maxLength={2000}
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Ajoutée sous l’inventaire de la fiche d’appel"
              />
            </label>
          </section>
          <CallInventory
            draft={draft}
            setDraft={setDraft}
            maxOptions={catalogue.settings.maxOptions}
          />
        </div>

        <aside className="admin-quote-aside">
          <div className="admin-quote-paper" aria-label="Aperçu du devis en direct">
            <header>
              <div className="admin-quote-brand">
                <img src="/assets/logo.png" alt="" />
                <div>
                  <strong>DEMENAG EXPRESS PRO MTH</strong>
                  <span>Dakar · {catalogue.settings.businessPhone}</span>
                </div>
              </div>
              <div className="admin-quote-paper-title">
                <strong>DEVIS PROVISOIRE</strong>
                <span>En préparation</span>
              </div>
            </header>
            <div className="admin-quote-stripe">
              <i />
              <i />
              <i />
            </div>
            <div className="admin-quote-paper-meta">
              <div>
                <small>CLIENT</small>
                <strong>{draft.customerName || '—'}</strong>
                <span>{draft.customerPhone || '—'}</span>
              </div>
              <div>
                <small>DATE PRÉVUE</small>
                <strong>
                  {quoteDate}
                  {draft.timeSlot ? ` · ${draft.timeSlot}` : ''}
                </strong>
                <span>{selected.name}</span>
              </div>
              <div className="admin-quote-route">
                <small>TRAJET</small>
                <strong>
                  {draft.fromAddress || 'Départ'} → {draft.toAddress || 'Arrivée'}
                </strong>
                <span>
                  {draft.route
                    ? `${draft.route.distanceKm} km · ${price ? tiers[price.tier] : ''}`
                    : 'Distance à calculer'}
                </span>
              </div>
            </div>
            <div className="admin-quote-paper-lines">
              <div className="admin-quote-paper-table-head">
                <span>DÉSIGNATION</span>
                <span>MONTANT</span>
              </div>
              {previewLines.map((line, index) => (
                <div className="admin-quote-paper-line" key={`${line.label}-${index}`}>
                  <div>
                    <span>{line.label}</span>
                    <small>
                      {line.quantity} × {money(line.unitPrice)}
                    </small>
                  </div>
                  <strong>{money(line.total)}</strong>
                </div>
              ))}
              {!previewLines.length && (
                <div className="admin-quote-paper-line">
                  <span>Transport · trajet à définir</span>
                  <strong>—</strong>
                </div>
              )}
              {quoteConfig.discount > 0 && (
                <div className="admin-quote-paper-line">
                  <span>Remise</span>
                  <strong>− {money(quoteConfig.discount)}</strong>
                </div>
              )}
              <div className="admin-quote-paper-total">
                <strong>TOTAL</strong>
                <strong>{previewTotal === null ? 'À calculer' : money(previewTotal)}</strong>
              </div>
            </div>
            {(inventoryText || draft.notes) && (
              <div className="admin-quote-paper-note">
                {[inventoryText, draft.notes].filter(Boolean).join('\n\n')}
              </div>
            )}
            <p>
              Devis provisoire basé sur le nombre d’allers-retours prévus. Le devis final sera
              établi après le déménagement selon les trajets réellement effectués.
            </p>
          </div>
          {estimateError && (
            <p className="alert error" role="alert">
              {estimateError}
            </p>
          )}
          {discountTooHigh && (
            <p className="alert error" role="alert">
              La remise dépasse le sous-total du devis.
            </p>
          )}
          {submitError && (
            <p className="alert error" role="alert">
              {submitError}
            </p>
          )}
          <button
            className="button primary admin-quote-submit"
            disabled={submitting || estimating || !price || price.total === null || !draft.route}
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer le devis provisoire'}
          </button>
          <p className="muted">
            Le rendez-vous est ajouté aux réservations. Le client peut télécharger le devis
            provisoire depuis son espace.
          </p>
        </aside>
      </form>
    </div>
  );
}
