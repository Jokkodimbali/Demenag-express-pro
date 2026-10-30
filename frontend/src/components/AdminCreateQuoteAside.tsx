import { Warehouse } from 'lucide-react';
import { money } from '../domain/format';
import { whatsappNumber } from '../application/services/whatsapp';
import { uiText } from '../content/reference-ui-text';
import type { useAdminCreateQuoteModel } from '../application/controllers/useAdminCreateQuoteModel';
import type { Catalogue, Vehicle } from '../domain/model';

type Model = ReturnType<typeof useAdminCreateQuoteModel>;

export function AdminCreateQuoteAside({
  model,
  publicRequest,
  catalogue,
  selected,
}: {
  model: Model;
  publicRequest: boolean;
  catalogue: Catalogue;
  selected: Vehicle;
}) {
  const {
    displayBusinessPhone,
    quoteKind,
    draft,
    quoteDate,
    effectiveDistance,
    previewLines,
    quoteConfig,
    previewDiscountLabel,
    previewDiscount,
    previewTotal,
    tollLines,
    totalTolls,
    visibleInventoryText,
    estimateText,
    questionnaireText,
    editingBooking,
    canCreateFinal,
    setQuoteKind,
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
  } = model;
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
      {!publicRequest && (
        <section className="admin-quote-stage" aria-label={uiText['etapeActuelleDuDevis']}>
          <span className="admin-quote-stage-label">{uiText['etapeACTUELLE']}</span>
          <div className="admin-quote-stage-switch" role="group" aria-label={uiText['typeDeDevis']}>
            <button
              type="button"
              aria-pressed={quoteKind === 'provisional'}
              className={quoteKind === 'provisional' ? 'active provisional' : ''}
              onClick={() => setQuoteKind('provisional')}
            >
              {uiText['provisoire']}
            </button>
            <button
              type="button"
              aria-pressed={quoteKind === 'final'}
              className={quoteKind === 'final' ? 'active final' : ''}
              disabled={Boolean(editingBooking?.quotes.some((quote) => quote.kind === 'final'))}
              title={
                canCreateFinal
                  ? undefined
                  : 'Une date est nécessaire pour enregistrer un devis final.'
              }
              onClick={() => {
                setQuoteKind('final');
                setStageError('');
              }}
            >
              {uiText['final']}
            </button>
          </div>
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
            {reminderCanSend && editingBooking && (
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
                {uiText['rappel']}{' '}
                {reminderDays === 0
                  ? 'aujourd’hui'
                  : reminderDays === 1
                    ? 'demain'
                    : `J-${reminderDays}`}
              </a>
            )}
          </div>
          {!reminderCanSend && (
            <span className="admin-quote-reminder-disabled">
              {uiText['rappelIndisponible']}
              {reminderDisabledReason}
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
}
