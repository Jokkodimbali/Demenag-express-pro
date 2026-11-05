import { Warehouse } from 'lucide-react';
import { money } from '../domain/format';
import { whatsappNumber } from '../application/services/whatsapp';
import { uiText } from '../content/reference-ui-text';
import type { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import type { Catalogue, Vehicle } from '../domain/model';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { visibleUiText } from '../content/visible-ui-text';

type Model = ReturnType<typeof useAdminCreateQuoteModel>;

export function AdminCreateQuoteAside({
  model,
  publicRequest,
  catalogue,
  selected,
  simulation,
}: {
  model: Model;
  publicRequest: boolean;
  catalogue: Catalogue;
  selected: Vehicle;
  simulation?: ReactNode;
}) {
  const {
    displayBusinessPhone,
    quoteKind,
    draft,
    quoteDate,
    effectiveDistance,
    previewLines,
    quoteConfig,
    setQuoteConfig,
    setDraft,
    movingEstimate,
    previewDiscountLabel,
    previewDiscount,
    previewTotal,
    tollLines,
    totalTolls,
    visibleInventoryText,
    estimateText,
    questionnaireText,
    editingBooking,
    setStageError,
    submitting,
    estimating,
    editingLocked,
    sendCurrentQuoteOnWhatsApp,
    reminderCanSend,
    reminderHref,
    bookingCommands,
    setReminderNotice,
    reminderWhen,
    reminderDays,
    reminderDisabledReason,
    reminderNotice,
    canSendQuoteWhatsApp,
    stageError,
    pdfError,
    estimateError,
    submitError,
    editLoading,
    editError,
    editingReservation,
    downloadCurrentQuote,
    rentalKit,
    rentalOvertimeAmount,
  } = model;
  const [newKitItem, setNewKitItem] = useState('');
  return (
    <aside className="admin-quote-aside">
      <div className="admin-quote-paper" aria-label={uiText['apercuDuDevisEnDirect']}>
        <header>
          <div className="admin-quote-brand">
            <img src="/assets/logo.png" alt="" />
            <div>
              <strong>{uiText['demenagEXPRESSPROMTH']}</strong>
              <span>
                {uiText['dakar']}
                {displayBusinessPhone}
              </span>
            </div>
          </div>
          <div className="admin-quote-paper-title">
            <strong>{quoteKind === 'final' ? 'DEVIS FINAL' : 'DEVIS PROVISOIRE'}</strong>
            <span>{uiText['brouillon']}</span>
          </div>
        </header>
        <div className="admin-quote-stripe">
          <i />
          <i />
          <i />
        </div>
        <div className="admin-quote-paper-meta">
          <div>
            <small>{uiText['client']}</small>
            <strong>{draft.customerName || '—'}</strong>
            <span>{draft.customerPhone}</span>
          </div>
          <div>
            <small>{uiText['datePREVUE']}</small>
            <strong>
              {quoteDate}
              {draft.timeSlot ? ` · ${draft.timeSlot}` : ''}
            </strong>
            <span>{selected.name}</span>
          </div>
          <div className="admin-quote-route">
            <small>{uiText['trajet']}</small>
            <strong>
              {draft.fromAddress || '—'} → {draft.toAddress || '—'}
            </strong>
            <span>
              {draft.route ? `${effectiveDistance} km (itinéraire calculé)` : 'Distance à relever'}
            </span>
          </div>
        </div>
        <div className="admin-quote-paper-lines">
          <div className="admin-quote-paper-table-head">
            <span>{uiText['designation']}</span>
            <span>{uiText['montant']}</span>
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
              <span>{uiText['transportTrajetADefinir']}</span>
              <strong>—</strong>
            </div>
          )}
          {quoteConfig.discount > 0 && (
            <div className="admin-quote-paper-line">
              <span>{previewDiscountLabel}</span>
              <strong>− {money(previewDiscount)}</strong>
            </div>
          )}
          <div className="admin-quote-paper-total">
            <strong>{quoteKind === 'final' ? 'TOTAL' : 'TOTAL ESTIMÉ'}</strong>
            <strong>{previewTotal === null ? 'À calculer' : money(previewTotal)}</strong>
          </div>
        </div>
        {tollLines.length > 0 && (
          <div className="admin-quote-paper-tolls">
            <div className="admin-quote-paper-tolls-head">
              <span className="admin-quote-paper-tolls-icon">
                <Warehouse size={16} strokeWidth={2.2} />
              </span>
              <span>
                <strong>{uiText['peagesALACHARGEDUCLIENT']}</strong>
                <small>
                  {tollLines.length} {uiText['peage']}
                  {tollLines.length > 1 ? 's' : ''} {uiText['aReglerSurPlaceParLeClient']}
                </small>
              </span>
              <b>{uiText['nonINCLUSDANSLETOTAL']}</b>
            </div>
            <div className="admin-quote-paper-tolls-grid">
              <span>{uiText['peage2']}</span>
              <span>{uiText['passages']}</span>
              <span>{uiText['prixUNIT']}</span>
              <span>{uiText['montant']}</span>
              {tollLines.map((line) => (
                <div className="admin-quote-paper-tolls-row" key={line.id}>
                  <span>
                    <strong>{line.label}</strong>
                    <small>{selected.name}</small>
                  </span>
                  <span>{line.quantity}</span>
                  <span>{money(line.unitPrice)}</span>
                  <strong>{money(line.quantity * line.unitPrice)}</strong>
                </div>
              ))}
            </div>
            <div className="admin-quote-paper-tolls-total">
              <span>{uiText['totalPeagesAReglerParLeClient']}</span>
              <strong>{money(totalTolls)}</strong>
            </div>
          </div>
        )}
        {(draft.fromNote ||
          draft.toNote ||
          visibleInventoryText ||
          estimateText ||
          questionnaireText ||
          draft.notes) && (
          <div className="admin-quote-paper-note">
            {[
              draft.fromNote.trim() ? `Repère départ : ${draft.fromNote.trim()}` : '',
              draft.toNote.trim() ? `Repère arrivée : ${draft.toNote.trim()}` : '',
              visibleInventoryText,
              estimateText,
              questionnaireText,
              draft.notes,
            ]
              .filter(Boolean)
              .join('\n')}
          </div>
        )}
        <p>
          {quoteKind === 'final'
            ? `Devis final établi sur la base du nombre réel d'allers-retours effectués (${quoteConfig.trips}), au tarif de la tranche de distance appliquée.`
            : `Devis temporaire, calculé sur ${quoteConfig.trips} aller(s)-retour(s) estimé(s). Le transport est facturé par aller-retour effectué : le devis final, basé sur le nombre réel d'allers-retours, sera envoyé par Demenag Express à la fin du déménagement.`}
        </p>
      </div>
      {!publicRequest && quoteConfig.billingMode === 'complete' && (
        <section className="admin-quote-billing admin-quote-card" aria-label="Facturation">
          <h3>FACTURATION</h3>
          <div
            className="admin-quote-billing-options"
            role="group"
            aria-label="Mode de facturation"
          >
            <button
              type="button"
              className="active"
              aria-pressed="true"
              onClick={() => setQuoteConfig((current) => ({ ...current, billingMode: 'complete' }))}
            >
              Déménagement complet
            </button>
            <button
              type="button"
              aria-pressed="false"
              onClick={() =>
                setQuoteConfig((current) => ({ ...current, billingMode: 'driver-rental' }))
              }
            >
              Location avec chauffeur
            </button>
          </div>
        </section>
      )}
      {!publicRequest && quoteConfig.billingMode === 'driver-rental' && (
        <section className="admin-quote-rental admin-quote-card" aria-label="Facturation">
          <h3>FACTURATION</h3>
          <div
            className="admin-quote-rental-details"
            aria-label="Location avec chauffeur et matériel fourni"
          >
            <div className="admin-quote-rental-heading">
              <strong>Location avec chauffeur · matériel fourni</strong>
              {quoteConfig.rentalKit !== null && (
                <button
                  type="button"
                  onClick={() => setQuoteConfig((current) => ({ ...current, rentalKit: null }))}
                >
                  Liste conseillée
                </button>
              )}
            </div>
            <p>
              Le client fournit ses manœuvres. Demenag Express fournit le matériel ci-dessous, le
              plan de chargement et le planning.
            </p>
            <div className="admin-quote-rental-items">
              {rentalKit.map((item, index) => (
                <div className="admin-quote-rental-item" key={`${item.id}-${index}`}>
                  {item.image && <img src={item.image} alt="" />}
                  <span>{item.label}</span>
                  <button
                    type="button"
                    aria-label={`Diminuer ${item.label}`}
                    disabled={item.quantity <= 0}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        rentalKit: rentalKit.map((entry, itemIndex) =>
                          itemIndex === index
                            ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
                            : entry,
                        ),
                      }))
                    }
                  >
                    −
                  </button>
                  <strong>{item.quantity}</strong>
                  <button
                    type="button"
                    aria-label={`Augmenter ${item.label}`}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        rentalKit: rentalKit.map((entry, itemIndex) =>
                          itemIndex === index ? { ...entry, quantity: entry.quantity + 1 } : entry,
                        ),
                      }))
                    }
                  >
                    +
                  </button>
                  <button
                    type="button"
                    aria-label={`Retirer ${item.label}`}
                    onClick={() =>
                      setQuoteConfig((current) => ({
                        ...current,
                        rentalKit: rentalKit.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="admin-quote-rental-add">
              <input
                value={newKitItem}
                onChange={(event) => setNewKitItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addKitItem();
                }}
                placeholder="Ajouter du matériel (ex. diable, carton)"
                aria-label="Ajouter du matériel fourni"
              />
              <button type="button" onClick={addKitItem}>
                Ajouter
              </button>
            </div>
            <div className="admin-quote-rental-summary">
              <div>
                <span>MANŒUVRES À FOURNIR PAR LE CLIENT</span>
                <strong>
                  {movingEstimate?.crew ?? 0} manœuvre{(movingEstimate?.crew ?? 0) === 1 ? '' : 's'}
                </strong>
              </div>
              <div>
                <span>PLANNING PRÉVISIONNEL</span>
                <strong>
                  {movingEstimate
                    ? `${movingEstimate.startTime} → ${movingEstimate.endTime} (${Math.floor(movingEstimate.totalMinutes / 60)} h${movingEstimate.totalMinutes % 60 ? ` ${String(movingEstimate.totalMinutes % 60).padStart(2, '0')}` : ''})`
                    : 'Remplissez l’inventaire'}
                </strong>
              </div>
            </div>
            <div className="admin-quote-rental-overtime">
              <strong>
                Au-delà de la fin prévue :{' '}
                {money(catalogue.settings.rentalOvertimeHourlyRate ?? 10000)} / heure. Ce rappel
                figure sur le devis du client.
              </strong>
              <span>Dépassement constaté (devis final)</span>
              <button
                type="button"
                disabled={(quoteConfig.overtimeMinutes ?? 0) < 5}
                onClick={() =>
                  setQuoteConfig((current) => ({
                    ...current,
                    overtimeMinutes: Math.max(0, (current.overtimeMinutes ?? 0) - 5),
                  }))
                }
              >
                −
              </button>
              <b>{quoteConfig.overtimeMinutes ?? 0} min</b>
              <button
                type="button"
                onClick={() =>
                  setQuoteConfig((current) => ({
                    ...current,
                    overtimeMinutes: (current.overtimeMinutes ?? 0) + 5,
                  }))
                }
              >
                +
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuoteConfig((current) => ({
                    ...current,
                    overtimeMinutes: (current.overtimeMinutes ?? 0) + 30,
                  }))
                }
              >
                +30 min
              </button>
              <strong>{money(rentalOvertimeAmount)}</strong>
            </div>
          </div>
        </section>
      )}
      {!publicRequest && (
        <section
          className="admin-quote-team-calculation admin-quote-card"
          aria-label="Équipe et calcul"
        >
          <h3>ÉQUIPE ET CALCUL</h3>
          <p>
            {quoteConfig.calcMode === 'manual'
              ? 'Vous fixez les manœuvres, allers-retours et durée de trajet. L’inventaire ne les modifie plus. Le véhicule reste libre.'
              : 'L’inventaire calcule les allers-retours et conseille le nombre de manœuvres. Le véhicule reste libre.'}
          </p>
          <div className="admin-quote-team-values">
            <div className="admin-quote-calculation-value">
              <span>Manœuvres</span>
              <div>
                <button
                  type="button"
                  aria-label="Réduire le nombre de manœuvres"
                  disabled={(draft.options.labour || movingEstimate?.crew || 1) <= 1}
                  onClick={() => updateCrew(-1)}
                >
                  −
                </button>
                <strong>{movingEstimate?.crew || draft.options.labour || 1}</strong>
                <button
                  type="button"
                  aria-label="Augmenter le nombre de manœuvres"
                  disabled={
                    (draft.options.labour || movingEstimate?.crew || 1) >=
                    catalogue.settings.maxOptions
                  }
                  onClick={() => updateCrew(1)}
                >
                  +
                </button>
              </div>
            </div>
            {quoteConfig.calcMode === 'manual' && (
              <>
                <div className="admin-quote-calculation-value">
                  <span>Allers-retours</span>
                  <div>
                    <button
                      type="button"
                      aria-label="Réduire les allers-retours"
                      disabled={quoteConfig.trips <= 1}
                      onClick={() =>
                        setQuoteConfig((current) => ({
                          ...current,
                          trips: Math.max(1, current.trips - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <strong>{quoteConfig.trips}</strong>
                    <button
                      type="button"
                      aria-label="Augmenter les allers-retours"
                      disabled={quoteConfig.trips >= Math.min(30, catalogue.settings.maxTrips)}
                      onClick={() =>
                        setQuoteConfig((current) => ({
                          ...current,
                          trips: Math.min(30, catalogue.settings.maxTrips, current.trips + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                {Boolean(model.route) && (
                  <div className="admin-quote-calculation-value">
                    <span>Trajet (aller)</span>
                    <div>
                      <button
                        type="button"
                        aria-label="Réduire la durée du trajet"
                        disabled={quoteConfig.legMinutes <= 5}
                        onClick={() =>
                          setQuoteConfig((current) => ({
                            ...current,
                            legMinutes: Math.max(5, (current.legMinutes || 10) - 5),
                          }))
                        }
                      >
                        −
                      </button>
                      <strong>{quoteConfig.legMinutes || 10} min</strong>
                      <button
                        type="button"
                        aria-label="Augmenter la durée du trajet"
                        disabled={quoteConfig.legMinutes >= 600}
                        onClick={() =>
                          setQuoteConfig((current) => ({
                            ...current,
                            legMinutes: Math.min(600, (current.legMinutes || 10) + 5),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {quoteConfig.calcMode === 'manual' && movingEstimate && (
            <span className="admin-quote-team-advice">
              Conseillé par l’inventaire : {movingEstimate.recommendedCrew} manœuvres ·{' '}
              {movingEstimate.trips} aller(s)-retour(s)
            </span>
          )}
        </section>
      )}
      {!publicRequest && (
        <section className="admin-quote-stage" aria-label={uiText['etapeActuelleDuDevis']}>
          <span className="admin-quote-stage-label">
            ENVOI DU DEVIS · {quoteKind === 'final' ? 'FINAL' : 'PROVISOIRE'}
          </span>
          {quoteKind === 'final' && (
            <span className="admin-quote-stage-instruction">
              {uiText['indiquezLeNombreReelDAllersRetoursPuisEnregistrez']}
            </span>
          )}
          <div className="admin-quote-stage-actions">
            <button
              type="button"
              className="admin-quote-action-whatsapp"
              disabled={submitting || estimating || editingLocked}
              onClick={sendCurrentQuoteOnWhatsApp}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
              {uiText['envoyerLeDevis']}
              {quoteKind === 'final' ? 'final' : 'provisoire'} {uiText['surWhatsApp']}
            </button>
            {reminderCanSend && editingBooking ? (
              <a
                className="admin-quote-reminder"
                href={reminderHref}
                target="_blank"
                rel="noopener noreferrer"
                title={`Message : rendez-vous ${reminderWhen}`}
                onClick={() => {
                  setReminderNotice('');
                  void bookingCommands
                    .recordReminder(editingBooking.id)
                    .then(() =>
                      setReminderNotice(
                        `Rappel WhatsApp envoyé à ${draft.customerName || 'client'} (${reminderWhen}).`,
                      ),
                    )
                    .catch((reason: unknown) =>
                      setStageError(
                        reason instanceof Error
                          ? reason.message
                          : 'Le rappel n’a pas pu être enregistré.',
                      ),
                    );
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {uiText['rappel']}{' '}
                {reminderDays === 0
                  ? 'aujourd’hui'
                  : reminderDays === 1
                    ? 'demain'
                    : `J-${reminderDays}`}
              </a>
            ) : (
              <span
                className="admin-quote-reminder admin-quote-reminder--disabled"
                title={reminderDisabledReason}
                aria-disabled="true"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {visibleUiText.text9}
              </span>
            )}
          </div>
          {!reminderCanSend && (
            <span className="admin-quote-reminder-help">
              {uiText['rappelIndisponible']}
              {reminderDisabledReason}.
            </span>
          )}
          {reminderNotice && (
            <span className="admin-quote-reminder-notice" role="status">
              {reminderNotice}
            </span>
          )}
          <span className="admin-quote-recipient">
            {uiText['destinataire']}{' '}
            <strong>
              {canSendQuoteWhatsApp
                ? `+${whatsappNumber(draft.customerPhone, catalogue?.settings.whatsappCountryCode ?? '221')}`
                : 'aucun numéro'}
            </strong>
          </span>
          {stageError && (
            <span className="admin-quote-stage-error" role="alert">
              {stageError}
            </span>
          )}
          {pdfError && (
            <span className="admin-quote-stage-error" role="alert">
              {pdfError}
            </span>
          )}
        </section>
      )}
      {estimateError && (
        <p className="alert error" role="alert">
          {estimateError}
        </p>
      )}
      {submitError && (
        <p className="alert error" role="alert">
          {submitError}
        </p>
      )}
      <button
        className={`button primary admin-quote-submit${publicRequest ? ' reference-request-submit' : ''}`}
        disabled={
          submitting ||
          estimating ||
          editLoading ||
          Boolean(editError) ||
          editingLocked ||
          (publicRequest && !editingReservation && catalogue.settings.bookingsEnabled === false)
        }
      >
        {publicRequest
          ? submitting
            ? 'Envoi…'
            : editingReservation
              ? 'Envoyer les modifications'
              : 'Envoyer ma demande'
          : submitting
            ? 'Enregistrement…'
            : editingReservation
              ? 'Enregistrer les modifications'
              : 'Enregistrer'}
      </button>
      {simulation}
      {!publicRequest && (
        <button
          type="button"
          className="admin-quote-action-pdf"
          onClick={() => void downloadCurrentQuote()}
        >
          {`Télécharger le PDF ${quoteKind === 'final' ? 'final' : 'provisoire'}`}
        </button>
      )}
    </aside>
  );

  function addKitItem() {
    const label = newKitItem.trim();
    if (!label) return;
    setQuoteConfig((current) => ({
      ...current,
      billingMode: 'driver-rental',
      rentalKit: [...rentalKit, { id: `custom-${crypto.randomUUID()}`, label, quantity: 1 }],
    }));
    setNewKitItem('');
  }

  function updateCrew(delta: number) {
    setQuoteConfig((current) => ({ ...current, calcMode: 'manual' }));
    setDraft((current) => {
      const crew = Math.max(
        1,
        Math.min(
          catalogue.settings.maxOptions,
          (current.options.labour || movingEstimate?.crew || 1) + delta,
        ),
      );
      return {
        ...current,
        options: { ...current.options, labour: crew },
        inventory: { ...current.inventory, crew },
      };
    });
  }
}
