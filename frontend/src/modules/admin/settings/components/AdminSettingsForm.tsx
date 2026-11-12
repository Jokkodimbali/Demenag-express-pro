import { uiText } from '../../../shared/content/reference-ui-text';
import { useSettings } from '../application/controllers/useSettings';
import { TransportSettings } from '../components/TransportSettings';
import { messages } from '../../../shared/content/fr';
import type { CustomInventoryType } from '../../../shared/domain/model';
import { resetCatalogueAssemblyToReference } from '../domain/reference-tariff-defaults';
import { useState } from 'react';

export function Settings() {
  const [resetRevision, setResetRevision] = useState(0);
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
    resetReferenceDefaults,
    saveVehicleDimensions,
    vehicleDimensionsBusy,
    vehicleDimensionsError,
  } = useSettings();
  if (!catalogue) return null;
  async function saveInventoryCatalog(
    customInventoryTypes: CustomInventoryType[],
    hiddenInventoryKeys: string[],
  ) {
    await updateSettings({ customInventoryTypes, hiddenInventoryKeys });
  }
  async function resetTariffsToReference() {
    try {
      return await resetReferenceDefaults();
    } finally {
      setResetRevision((revision) => revision + 1);
    }
  }
  async function resetAssemblyToReference() {
    const updated = await replaceCatalogue(resetCatalogueAssemblyToReference);
    if (updated) setResetRevision((revision) => revision + 1);
    return updated;
  }
  return (
    <form onSubmit={submit} onChange={onChange} onBlur={onBlur} className="settings-form">
      <TransportSettings
        catalogue={catalogue}
        onSaveInventoryCatalog={saveInventoryCatalog}
        onResetTariffs={resetTariffsToReference}
        onResetAssembly={resetAssemblyToReference}
        resetRevision={resetRevision}
        onSaveVehicleDimensions={saveVehicleDimensions}
        vehicleDimensionsBusy={vehicleDimensionsBusy}
        vehicleDimensionsError={vehicleDimensionsError}
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
