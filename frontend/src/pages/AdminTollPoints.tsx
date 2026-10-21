import { MapPin, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { TollPointEditorMap } from '../components/TollPointEditorMap';
import type { TollPoint, TollPointInput } from '../domain/model';
import { money } from '../domain/format';

const emptyPoint: TollPointInput = {
  name: '',
  operator: '',
  heavyPrice: 0,
  latitude: null,
  longitude: null,
};

export function AdminTollPoints() {
  const { api, tollPoints, setTollPoints } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TollPointInput>(emptyPoint);
  const [pendingDelete, setPendingDelete] = useState<TollPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function edit(point: TollPoint) {
    setEditingId(point.id);
    setForm({
      name: point.name,
      operator: point.operator,
      heavyPrice: point.heavyPrice,
      latitude: point.latitude,
      longitude: point.longitude,
    });
    setError('');
    setSaved('');
  }

  function reset() {
    setEditingId(null);
    setForm(emptyPoint);
    setError('');
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
        operator: form.operator.trim(),
      };
      const point = editingId
        ? await api.updateTollPoint(editingId, input)
        : await api.createTollPoint(input);
      setTollPoints((current) =>
        [...current.filter((item) => item.id !== point.id), point].sort(
          (a, b) => a.operator.localeCompare(b.operator) || a.name.localeCompare(b.name),
        ),
      );
      reset();
      setSaved(editingId ? 'Point de péage modifié.' : 'Point de péage ajouté. Il apparaît sur les cartes.');
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
      <section className="panel toll-admin-form-panel">
        <div className="section-heading">
          <div>
            <h3>{editingId ? 'Modifier un point de péage' : 'Ajouter un point de péage'}</h3>
            <p>Tarif par passage pour les poids lourds. Cliquez sur la carte pour placer le repère.</p>
          </div>
          {editingId && <button type="button" className="button secondary small" onClick={reset}><X size={16} /> Annuler</button>}
        </div>
        <form className="toll-admin-form" onSubmit={(event) => void save(event)}>
          <label>Nom du point<input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex. Péage de Rufisque" /></label>
          <label>Exploitant<input required minLength={2} maxLength={60} value={form.operator} onChange={(event) => setForm((current) => ({ ...current, operator: event.target.value }))} placeholder="Ex. SECAA" /></label>
          <label>Tarif poids lourd / passage (FCFA)<input required type="number" min={1} max={10000000} step={1} value={form.heavyPrice || ''} onChange={(event) => setForm((current) => ({ ...current, heavyPrice: Number(event.target.value) }))} /></label>
          <div className="toll-admin-coordinate-fields">
            <label>Latitude<input type="number" min={12} max={17} step="any" value={form.latitude ?? ''} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="14.6928" /></label>
            <label>Longitude<input type="number" min={-18.5} max={-11} step="any" value={form.longitude ?? ''} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="-17.4467" /></label>
          </div>
          <TollPointEditorMap points={tollPoints} latitude={form.latitude} longitude={form.longitude} onSelect={(latitude, longitude) => setForm((current) => ({ ...current, latitude, longitude }))} />
          {error && <p className="alert error" role="alert">{error}</p>}
          {saved && <p className="alert success" role="status">{saved}</p>}
          <button className="button primary" type="submit" disabled={busy}><Save size={16} /> {busy ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Ajouter le péage'}</button>
        </form>
      </section>
      <section className="panel toll-admin-list-panel">
        <div className="section-heading"><div><h3>Points de péage ({tollPoints.length})</h3><p>Les tarifs définis ici sont proposés lors de la réservation.</p></div><Plus size={18} aria-hidden="true" /></div>
        <div className="toll-admin-table-wrap">
          <table className="toll-admin-table"><thead><tr><th>Point</th><th>Exploitant</th><th>Poids lourd</th><th>Localisation</th><th>Actions</th></tr></thead><tbody>
            {tollPoints.map((point) => <tr key={point.id}><td><strong>{point.name}</strong></td><td>{point.operator}</td><td>{money(point.heavyPrice)}</td><td>{point.latitude === null || point.longitude === null ? <span className="muted">À renseigner</span> : <span className="toll-location"><MapPin size={14} /> {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}</span>}</td><td><div className="toll-admin-actions"><button type="button" className="button secondary small" onClick={() => edit(point)}><Pencil size={14} /> Modifier</button><button type="button" className="button secondary small" onClick={() => { setError(''); setPendingDelete(point); }}><Trash2 size={14} /> Supprimer</button></div></td></tr>)}
          </tbody></table>
          {tollPoints.length === 0 && <p className="muted">Aucun point de péage enregistré.</p>}
        </div>
      </section>
      {pendingDelete && <ConfirmationDialog titleId="delete-toll-title" eyebrow="Péages" title="Supprimer ce point de péage ?" description={`« ${pendingDelete.name} » disparaîtra des cartes et des nouveaux devis. Les devis déjà enregistrés restent inchangés.`} confirmLabel="Supprimer le péage" busy={busy} error={error} onConfirm={() => void remove()} onClose={() => setPendingDelete(null)} />}
    </div>
  );
}
