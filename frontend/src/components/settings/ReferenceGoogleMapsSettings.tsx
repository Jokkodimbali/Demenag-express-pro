import { uiText } from '../../content/reference-ui-text';
import { useState } from 'react';
import { readGoogleMapsKey, saveGoogleMapsKey } from '../../application/google-maps-traffic';

export function ReferenceGoogleMapsSettings() {
  const [key, setKey] = useState(readGoogleMapsKey);
  return (
    <section className="reference-settings-wide reference-settings-google-maps">
      <span className="reference-settings-card-title">{uiText['googleMapsTraficEnDirect']}</span>
      <input
        type="text"
        autoComplete="off"
        value={key}
        onChange={(event) => {
          setKey(event.target.value);
          saveGoogleMapsKey(event.target.value);
        }}
        placeholder={uiText['cleAPIGoogleMapsDistanceMatrixActivee']}
        aria-label={uiText['cleAPIGoogleMapsPourLeTraficEnDirect']}
      />
    </section>
  );
}
