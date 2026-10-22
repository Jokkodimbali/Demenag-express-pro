import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { TollPointEditorMap } from '../components/TollPointEditorMap';
import type { TollPoint, TollPointInput } from '../domain/model';
import { money } from '../domain/format';
import { tollPrice } from '../domain/toll-prices';

const emptyPoint: TollPointInput = {
  name: '',
  region: '',
  axis: '',
  heavyPrice: 0,
  vehiclePrices: {},
  latitude: null,
  longitude: null,
};

export function AdminTollPoints() {
  const { api, catalogue, tollPoints, setTollPoints } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TollPointInput>(emptyPoint);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TollPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const mapPanel = useRef<HTMLElement>(null);
  const searchRequest = useRef(0);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<
    { label: string; point: [number, number] }[]
  >([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationError, setLocationError] = useState('');

  function edit(point: TollPoint) {
    setFormOpen(true);
    searchRequest.current += 1;
    setLocationQuery(`${point.name}, Sénégal`);
    setLocationResults([]);
    setLocationError('');
    setLocationSearching(false);
    setEditingId(point.id);
    setForm({
      name: point.name,
      region: point.region,
      axis: point.axis,
      heavyPrice: point.heavyPrice,
      vehiclePrices: point.vehiclePrices ?? {},
      latitude: point.latitude,
      longitude: point.longitude,
    });
    setError('');
    setSaved('');
  }

  function locate(point: TollPoint) {
    edit(point);
    setFocusRequest((current) => current + 1);
    mapPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function reset() {
    setFormOpen(false);
    searchRequest.current += 1;
    setLocationResults([]);
    setEditingId(null);
    setForm(emptyPoint);
    setError('');
  }

  async function searchLocation() {
    if (locationQuery.trim().length < 3) return;
    const request = ++searchRequest.current;
    setLocationSearching(true);
    setLocationError('');
    setLocationResults([]);
    try {
      const results = await api.search(locationQuery.trim());
      if (request !== searchRequest.current) return;
      setLocationResults(results);
      if (!results.length)
        setLocationError('Aucun lieu trouvé. Placez le point directement sur la carte.');
    } catch (reason) {
      if (request === searchRequest.current) setLocationError(errorMessage(reason));
    } finally {
      if (request === searchRequest.current) setLocationSearching(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaved('');
    if (form.latitude === null || form.longitude === null) {
      setError('Placez le péage sur la carte ou renseignez ses deux coordonnées.');
      return;
    }
    setBusy(true);
    try {
      const input = {
        ...form,
        name: form.name.trim(),
        vehiclePrices: {
          ...form.vehiclePrices,
          ...Object.fromEntries(
            (catalogue?.vehicles ?? []).map((vehicle) => [
              vehicle.id,
              form.vehiclePrices[vehicle.id] ?? form.heavyPrice,
            ]),
          ),
        },
      };
      const point = editingId
        ? await api.updateTollPoint(editingId, input)
        : await api.createTollPoint(input);
      setTollPoints((current) =>
        [...current.filter((item) => item.id !== point.id), point].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      reset();
      setSaved(
        editingId
          ? 'Point de péage modifié.'
          : 'Point de péage ajouté. Il apparaît sur les cartes.',
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteTollPoint(pendingDelete.id);
      setTollPoints((current) => current.filter((point) => point.id !== pendingDelete.id));
      if (editingId === pendingDelete.id) reset();
      setPendingDelete(null);
      setSaved('Point de péage supprimé.');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="toll-admin-layout">
      <section
        ref={mapPanel}
        className="toll-admin-map-panel"
        aria-label="Carte des points de péage"
      >
        <TollPointEditorMap
          points={tollPoints}
          selectedId={editingId}
          name={form.name}
          latitude={form.latitude}
          longitude={form.longitude}
          region={form.region}
          focusRequest={focusRequest}
          onPointClick={edit}
          onSelect={(latitude, longitude) => {
            setFormOpen(true);
            setForm((current) => ({ ...current, latitude, longitude }));
          }}
        />
        <p className="toll-admin-map-hint">
          {editingId && form.latitude === null
            ? `Aucune position enregistrée pour ${form.name}. Cliquez sur l’emplacement exact, puis enregistrez.`
            : 'Cliquez sur la carte pour placer un point. Sélectionnez un repère, puis déplacez-le si nécessaire.'}
        </p>
        <div className="toll-admin-location-search">
          <div className="toll-admin-location-search-line">
            <input
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void searchLocation();
                }
              }}
              aria-label="Rechercher un lieu pour le péage"
              placeholder="Rechercher un lieu pour le péage"
            />
            <button
              className="button secondary small"
              type="button"
              disabled={locationSearching || locationQuery.trim().length < 3}
              onClick={() => void searchLocation()}
            >
              <Search size={16} /> {locationSearching ? 'Recherche…' : 'Rechercher'}
            </button>
          </div>
          {locationError && (
            <p className="muted" role="status">
              {locationError}
            </p>
          )}
          {locationResults.length > 0 && (
            <div className="toll-admin-location-results" aria-label="Lieux trouvés">
              {locationResults.map((result, index) => (
                <button
                  type="button"
                  key={`${result.label}-${index}`}
                  onClick={() => {
                    setFormOpen(true);
                    setForm((current) => ({
                      ...current,
                      latitude: result.point[0],
                      longitude: result.point[1],
                    }));
                    setLocationResults([]);
                    setFocusRequest((current) => current + 1);
                  }}
                >
                  {result.label}
                </button>
              ))}
            </div>
          )}
          <p>
            La recherche propose une zone. Vérifiez le point exact sur la carte avant d’enregistrer.
          </p>
        </div>
      </section>
      <div className="toll-admin-side">
        <section className="panel toll-admin-form-panel">
          <div className="section-heading">
            <div>
              <h3>{editingId ? 'Modifier un point de péage' : 'Ajouter un point de péage'}</h3>
              <p>
                Tarif par passage pour les poids lourds. Cliquez sur la carte pour placer le repère.
              </p>
            </div>
            <div className="toll-admin-form-actions">
              {editingId && formOpen && (
                <button type="button" className="button secondary small" onClick={reset}>
                  <X size={16} /> Annuler
                </button>
              )}
              <button
                type="button"
                className="button secondary small"
                aria-expanded={formOpen}
                aria-controls="toll-admin-form"
                onClick={() => setFormOpen((current) => !current)}
              >
                {formOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {formOpen ? 'Réduire' : 'Ouvrir le formulaire'}
              </button>
            </div>
          </div>
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="alert success" role="status">
              {saved}
            </p>
          )}
          <form
            id="toll-admin-form"
            className="toll-admin-form"
            hidden={!formOpen}
            onSubmit={(event) => void save(event)}
          >
            <label>
              Nom du point
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex. Péage de Rufisque"
              />
            </label>
            <label>
              Région
              <input
                maxLength={80}
                value={form.region}
                onChange={(event) =>
                  setForm((current) => ({ ...current, region: event.target.value }))
                }
                placeholder="Ex. Thiès"
                list="toll-admin-regions"
              />
            </label>
            <label>
              Axe routier
              <input
                maxLength={120}
                value={form.axis}
                onChange={(event) =>
                  setForm((current) => ({ ...current, axis: event.target.value }))
                }
                placeholder="Ex. Autoroute Ila Touba"
                list="toll-admin-axes"
              />
            </label>
            <datalist id="toll-admin-regions">
              {[
                ...new Set([
                  ...tollPoints.map((point) => point.region),
                  'Dakar',
                  'Thiès',
                  'Diourbel',
                  'Fatick',
                  'Kaolack',
                ]),
              ]
                .filter(Boolean)
                .map((region) => (
                  <option key={region} value={region} />
                ))}
            </datalist>
            <datalist id="toll-admin-axes">
              {[
                ...new Set([
                  ...tollPoints.map((point) => point.axis),
                  'Autoroute de l’Avenir (Dakar–Diamniadio)',
                  'Autoroute Diamniadio–AIBD–Mbour',
                  'Autoroute Ila Touba',
                  'Autoroute Mbour–Kaolack',
                ]),
              ]
                .filter(Boolean)
                .map((axis) => (
                  <option key={axis} value={axis} />
                ))}
            </datalist>
            <label>
              Tarif poids lourd / passage (FCFA)
              <input
                required
                type="number"
                min={1}
                max={10000000}
                step={1}
                value={form.heavyPrice || ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, heavyPrice: Number(event.target.value) }))
                }
              />
            </label>
            <div className="toll-admin-vehicle-prices" role="group" aria-label="Tarif par véhicule">
              {(catalogue?.vehicles ?? []).map((vehicle) => (
                <label key={vehicle.id}>
                  {vehicle.name}
                  <span className="toll-admin-price-input">
                    <input
                      type="number"
                      required
                      min={1}
                      max={10000000}
                      step={1}
                      value={(form.vehiclePrices[vehicle.id] ?? form.heavyPrice) || ''}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          vehiclePrices: {
                            ...current.vehiclePrices,
                            [vehicle.id]: Number(event.target.value),
                          },
                        }))
                      }
                    />
                    <span>FCFA</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="toll-admin-coordinate-fields">
              <label>
                Latitude
                <input
                  type="number"
                  min={12}
                  max={17}
                  step="any"
                  value={form.latitude ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      latitude: event.target.value === '' ? null : Number(event.target.value),
                    }))
                  }
                  placeholder="14.6928"
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  min={-18.5}
                  max={-11}
                  step="any"
                  value={form.longitude ?? ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      longitude: event.target.value === '' ? null : Number(event.target.value),
                    }))
                  }
                  placeholder="-17.4467"
                />
              </label>
            </div>
            <button className="button primary" type="submit" disabled={busy}>
              <Save size={16} />{' '}
              {busy
                ? 'Enregistrement…'
                : editingId
                  ? 'Enregistrer les modifications'
                  : 'Ajouter le péage'}
            </button>
          </form>
        </section>
        <section className="panel toll-admin-list-panel">
          <div className="section-heading">
            <div>
              <h3>Points de péage ({tollPoints.length})</h3>
              <p>Les tarifs définis ici sont proposés lors de la réservation.</p>
            </div>
            <Plus size={18} aria-hidden="true" />
          </div>
          <div className="toll-admin-cards">
            {tollPoints.map((point) => (
              <article
                className={`toll-admin-card${editingId === point.id ? ' selected' : ''}`}
                key={point.id}
              >
                <div className="toll-admin-card-heading">
                  <strong>{point.name}</strong>
                  <div className="toll-admin-card-actions">
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => locate(point)}
                      aria-label={`Localiser ${point.name}`}
                      title={point.latitude === null ? 'Placer sur la carte' : 'Voir sur la carte'}
                    >
                      <MapPin size={16} />
                    </button>
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => edit(point)}
                      aria-label={`Modifier ${point.name}`}
                      title="Modifier les informations"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => {
                        setError('');
                        setPendingDelete(point);
                      }}
                      aria-label={`Supprimer ${point.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="toll-admin-card-prices">
                  {(catalogue?.vehicles ?? []).map((vehicle) => (
                    <div key={vehicle.id}>
                      <span>{vehicle.name}</span>
                      <strong>{money(tollPrice(point, vehicle.id))}</strong>
                    </div>
                  ))}
                </div>
                <p className="toll-admin-card-meta">
                  {point.axis || 'Autoroute à renseigner'} · {point.region || 'Région à renseigner'}{' '}
                  ·{' '}
                  {point.latitude === null || point.longitude === null
                    ? 'À localiser'
                    : 'Localisé sur la carte'}
                </p>
              </article>
            ))}
            {tollPoints.length === 0 && <p className="muted">Aucun point de péage enregistré.</p>}
          </div>
        </section>
      </div>
      {pendingDelete && (
        <ConfirmationDialog
          titleId="delete-toll-title"
          eyebrow="Péages"
          title="Supprimer ce point de péage ?"
          description={`« ${pendingDelete.name} » disparaîtra des cartes et des nouveaux devis. Les devis déjà enregistrés restent inchangés.`}
          confirmLabel="Supprimer le péage"
          busy={busy}
          error={error}
          onConfirm={() => void remove()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
