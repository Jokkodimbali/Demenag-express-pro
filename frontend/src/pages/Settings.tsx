import { uiText } from '../content/reference-ui-text';
import { useSettings } from '../application/controllers/useSettings';
import { TransportSettings } from '../components/settings/TransportSettings';
import { messages } from '../content/fr';
import type { CustomInventoryType } from '../domain/model';
import { resetCatalogueTariffsToReference } from '../domain/reference-tariff-defaults';

export function Settings() {
  const {
    catalogue,
    busy,
    error,
    saved,
    submit,
    onChange,
    onBlur,
    updateSettings,
    replaceCatalogue,
  } = useSettings();
  if (!catalogue) return null;
  async function saveInventoryCatalog(
    customInventoryTypes: CustomInventoryType[],
    hiddenInventoryKeys: string[],
  ) {
    await updateSettings({ customInventoryTypes, hiddenInventoryKeys });
  }
  async function resetTariffsToReference() {
    return replaceCatalogue(resetCatalogueTariffsToReference);
  }
  return (
    <form onSubmit={submit} onChange={onChange} onBlur={onBlur} className="settings-form">
      <TransportSettings
        catalogue={catalogue}
        onSaveInventoryCatalog={saveInventoryCatalog}
        onResetTariffs={resetTariffsToReference}
      />
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="sr-only">
          {messages.parametresEnregistres}
        </p>
      )}
      {busy && (
        <p role="status" className="sr-only">
          {uiText['modificationsEnregistreesAutomatiquement']}
        </p>
      )}
    </form>
  );
}
