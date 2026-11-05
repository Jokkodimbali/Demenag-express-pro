import { useReferenceGoogleMapsSettings } from '../../application/controllers/useReferenceGoogleMapsSettings';
import { referenceSettingsText } from '../../content/reference-settings-text';

export function ReferenceGoogleMapsSettings() {
  const { key, setKey, error, loaded, save } = useReferenceGoogleMapsSettings();
  return (
    <section className="reference-settings-wide reference-settings-google-maps" aria-busy={!loaded}>
      <span className="reference-settings-card-title">{referenceSettingsText.googleMapsTitle}</span>
      <input
        type="text"
        autoComplete="off"
        value={key}
        disabled={!loaded}
        onChange={(event) => setKey(event.target.value)}
        onBlur={() => void save(key)}
        placeholder={referenceSettingsText.googleMapsPlaceholder}
        aria-label={referenceSettingsText.googleMapsAccessibleLabel}
      />
      {error && <small role="alert">{error}</small>}
    </section>
  );
}
