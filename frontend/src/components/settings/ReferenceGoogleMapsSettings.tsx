import { useState } from 'react';
import { readGoogleMapsKey, saveGoogleMapsKey } from '../../application/google-maps-traffic';

export function ReferenceGoogleMapsSettings() {
  const [key, setKey] = useState(readGoogleMapsKey);
  return (
    <section className="reference-settings-wide reference-settings-google-maps">
      <span className="reference-settings-card-title">Google Maps · trafic en direct</span>
      <input
        type="text"
        autoComplete="off"
        value={key}
        onChange={(event) => {
          setKey(event.target.value);
          saveGoogleMapsKey(event.target.value);
        }}
        placeholder="Clé API Google Maps (Distance Matrix activée)"
        aria-label="Clé API Google Maps pour le trafic en direct"
      />
    </section>
  );
}
