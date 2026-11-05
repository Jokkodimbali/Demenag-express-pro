import { uiText } from '../../content/reference-ui-text';
import { useEffect, useRef, useState } from 'react';
import type { Catalogue } from '../../domain/model';

export function PaymentSettings({ catalogue }: { catalogue: Catalogue }) {
  const [waveEnabled, setWaveEnabled] = useState(catalogue.settings.paymentWave !== false);
  const [cashEnabled, setCashEnabled] = useState(catalogue.settings.paymentCash !== false);
  const [qrRemoved, setQrRemoved] = useState(false);
  const paymentOptionsChanged = useRef(false);
  const removeQrInput = useRef<HTMLInputElement>(null);
  const qrFileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedWave = catalogue.settings.paymentWave !== false;
    const savedCash = catalogue.settings.paymentCash !== false;
    if (paymentOptionsChanged.current) {
      if (savedWave === waveEnabled && savedCash === cashEnabled)
        paymentOptionsChanged.current = false;
    } else {
      setWaveEnabled(savedWave);
      setCashEnabled(savedCash);
    }
    if (!catalogue.settings.paymentQr) setQrRemoved(false);
  }, [
    catalogue.settings.paymentCash,
    catalogue.settings.paymentQr,
    catalogue.settings.paymentWave,
    cashEnabled,
    waveEnabled,
  ]);

  const paymentLabel =
    waveEnabled && cashEnabled
      ? 'Wave ou espèces (au choix)'
      : waveEnabled
        ? 'Wave uniquement'
        : cashEnabled
          ? 'Espèces uniquement'
          : 'Aucun mode coché';

  return (
    <section
      className="reference-settings-wide payment-settings-panel"
      aria-labelledby="payment-settings-title"
    >
      <span className="reference-settings-card-title" id="payment-settings-title">
        {uiText['paiementClient']}
      </span>
      <div className="payment-settings-options">
        <label>
          <input
            type="checkbox"
            name="paymentWave"
            checked={waveEnabled}
            onChange={(event) => {
              paymentOptionsChanged.current = true;
              setWaveEnabled(event.currentTarget.checked);
            }}
          />
          {uiText['wave']}
        </label>
        <label>
          <input
            type="checkbox"
            name="paymentCash"
            checked={cashEnabled}
            onChange={(event) => {
              paymentOptionsChanged.current = true;
              setCashEnabled(event.currentTarget.checked);
            }}
          />
          {uiText['especes']}
        </label>
      </div>
      <span className="payment-settings-preview" aria-live="polite">
        {uiText['afficheSurLesDevisEtDansLesMessages']}
        <strong>{paymentLabel}</strong>
      </span>
      {waveEnabled && (
        <div className="payment-qr-panel">
          {catalogue.settings.paymentQr && !qrRemoved && (
            <img
              className="payment-qr-preview"
              src={catalogue.settings.paymentQr}
              alt={uiText['qrCodeWave']}
            />
          )}
          <div className="payment-qr-content">
            <strong>{uiText['qrCODEWAVEMARCHAND']}</strong>
            {catalogue.settings.paymentQr && !qrRemoved && (
              <span className="payment-qr-filename">{uiText['qrCodeMarchandEnregistre']}</span>
            )}
            <label className="payment-qr-upload" htmlFor="payment-qr">
              {catalogue.settings.paymentQr && !qrRemoved
                ? 'Remplacer (PDF ou image)'
                : 'Importer le QR (PDF ou image)'}
            </label>
            <input
              ref={qrFileInput}
              id="payment-qr"
              className="payment-qr-file"
              name="paymentQr"
              type="file"
              accept="application/pdf,image/*"
              onChange={(event) => {
                if (event.currentTarget.files?.length) {
                  setQrRemoved(false);
                  if (removeQrInput.current) removeQrInput.current.checked = false;
                }
              }}
            />
            <input
              ref={removeQrInput}
              id="remove-payment-qr"
              className="payment-qr-remove-input"
              type="checkbox"
              name="removePaymentQr"
              checked={qrRemoved}
              onChange={(event) => {
                const shouldRemove = event.currentTarget.checked;
                setQrRemoved(shouldRemove);
                if (shouldRemove && qrFileInput.current) qrFileInput.current.value = '';
              }}
            />
            {catalogue.settings.paymentQr && !qrRemoved && (
              <label className="payment-qr-remove" htmlFor="remove-payment-qr">
                {uiText['retirer']}
              </label>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
