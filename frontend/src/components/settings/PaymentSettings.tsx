import { useEffect, useRef, useState } from 'react';
import type { Catalogue } from '../../domain/model';

export function PaymentSettings({ catalogue }: { catalogue: Catalogue }) {
  const [waveEnabled, setWaveEnabled] = useState(catalogue.settings.paymentWave !== false);
  const [cashEnabled, setCashEnabled] = useState(catalogue.settings.paymentCash !== false);
  const [qrRemoved, setQrRemoved] = useState(false);
  const removeQrInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWaveEnabled(catalogue.settings.paymentWave !== false);
    setCashEnabled(catalogue.settings.paymentCash !== false);
    if (!catalogue.settings.paymentQr) setQrRemoved(false);
  }, [
    catalogue.settings.paymentCash,
    catalogue.settings.paymentQr,
    catalogue.settings.paymentWave,
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
        Paiement client
      </span>
      <div className="payment-settings-options">
        <label>
          <input
            type="checkbox"
            name="paymentWave"
            checked={waveEnabled}
            onChange={(event) => setWaveEnabled(event.currentTarget.checked)}
          />
          Wave
        </label>
        <label>
          <input
            type="checkbox"
            name="paymentCash"
            checked={cashEnabled}
            onChange={(event) => setCashEnabled(event.currentTarget.checked)}
          />
          Espèces
        </label>
      </div>
      <span className="payment-settings-preview" aria-live="polite">
        Affiché sur les devis et dans les messages : <strong>{paymentLabel}</strong>
      </span>
      {waveEnabled && (
        <div className="payment-qr-panel">
          {catalogue.settings.paymentQr && !qrRemoved && (
            <img
              className="payment-qr-preview"
              src={catalogue.settings.paymentQr}
              alt="QR code Wave"
            />
          )}
          <div className="payment-qr-content">
            <strong>QR CODE WAVE MARCHAND</strong>
            {catalogue.settings.paymentQr && !qrRemoved && (
              <span className="payment-qr-filename">QR code marchand enregistré</span>
            )}
            <label className="payment-qr-upload" htmlFor="payment-qr">
              {catalogue.settings.paymentQr && !qrRemoved
                ? 'Remplacer (PDF ou image)'
                : 'Importer le QR (PDF ou image)'}
            </label>
            <input
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
              onChange={(event) => setQrRemoved(event.currentTarget.checked)}
            />
            {catalogue.settings.paymentQr && !qrRemoved && (
              <label className="payment-qr-remove" htmlFor="remove-payment-qr">
                Retirer
              </label>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
