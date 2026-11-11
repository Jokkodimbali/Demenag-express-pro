import { useReferenceGoogleMapsSettings } from '../../application/controllers/useReferenceGoogleMapsSettings';
import { referenceSettingsText } from '../../content/reference-settings-text';
import { useEffect, useRef } from 'react';

export function ReferenceGoogleMapsSettings({
  onKeyChange,
}: {
  onKeyChange?: (configured: boolean) => void;
}) {
  const { key, setKey, error, loaded, save } = useReferenceGoogleMapsSettings();
  const reportedInitialKey = useRef(false);
  useEffect(() => {
    if (loaded && !reportedInitialKey.current) {
      reportedInitialKey.current = true;
      onKeyChange?.(Boolean(key.trim()));
    }
  }, [key, loaded, onKeyChange]);
  return (
    <section className="reference-settings-wide reference-settings-google-maps" aria-busy={!loaded}>
      <span className="reference-settings-card-title">{referenceSettingsText.googleMapsTitle}</span>
      <input
        type="text"
        autoComplete="off"
        value={key}
        disabled={!loaded}
        onChange={(event) => setKey(event.target.value)}
        onBlur={() =>
          void save(key).then((saved) => {
            if (saved) onKeyChange?.(Boolean(key.trim()));
          })
        }
        placeholder={referenceSettingsText.googleMapsPlaceholder}
        aria-label={referenceSettingsText.googleMapsAccessibleLabel}
      />
      {error && <small role="alert">{error}</small>}
    </section>
  );
}
