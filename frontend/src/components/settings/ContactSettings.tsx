import type { Catalogue } from '../../domain/model';
export function ContactSettings({ catalogue }: { catalogue: Catalogue }) {
  return (
    <div className="panel">
      <h2>SERVICES ET CONTACT</h2>
      <div className="field-pair">
        <div>
          <label htmlFor="labour">Manœuvre / personne (FCFA)</label>
          <input
            id="labour"
            name="labour"
            type="number"
            min={0}
            max={1000000}
            step={1}
            required
            defaultValue={catalogue.settings.labourPrice}
          />
        </div>
        <div>
          <label htmlFor="assembly">Menuisier / meuble (FCFA)</label>
          <input
            id="assembly"
            name="assembly"
            type="number"
            min={0}
            max={1000000}
            step={1}
            required
            defaultValue={catalogue.settings.assemblyPrice}
          />
        </div>
      </div>
      <label htmlFor="business-phone">Téléphone de l’entreprise (format +221…)</label>
      <input
        id="business-phone"
        name="phone"
        type="tel"
        required
        pattern="\+221[0-9]{9}"
        defaultValue={catalogue.settings.businessPhone}
      />
    </div>
  );
}
