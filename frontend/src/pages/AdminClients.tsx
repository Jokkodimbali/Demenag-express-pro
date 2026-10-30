import { uiText } from '../content/reference-ui-text';
import { messages } from '../content/fr';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdministration } from '../application/controllers/useAdministration';
import { useAdminClients } from '../application/controllers/useAdminClients';
import { useApp } from '../application/context';
import { errorMessage } from '../application/error-message';
import { normalizedClientPhone } from '../application/services/client-summary';
import { usePagination } from '../application/usePagination';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { pageSizes } from '../config/pagination';
import { money } from '../domain/format';
import type { Booking, User } from '../domain/model';
import { routes } from '../routing/routes';

type DirectoryEntry = { phone: string; name: string; address: string };
type ClientRowValue = {
  key: string;
  name: string;
  phone: string;
  address: string;
  moves: number;
  total: number;
  final: number;
  last: string;
  account: User | null;
};
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(-9);
const shortDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};
function amounts(booking: Booking) {
  const final = [...booking.quotes].reverse().find((quote) => quote.kind === 'final');
  const provisional = [...booking.quotes].reverse().find((quote) => quote.kind === 'provisional');
  return {
    amount:
      (booking.status === 'completed'
        ? (final?.price.total ?? booking.estimate.total)
        : (provisional?.price.total ?? booking.estimate.total)) ?? 0,
    finalized:
      (booking.status === 'completed' ? (final?.price.total ?? booking.estimate.total) : 0) ?? 0,
  };
}
function ClientRow({
  value,
  onSave,
  onQuote,
  onReset,
  onHide,
  busy,
}: {
  value: ClientRowValue;
  onSave: (
    initial: ClientRowValue,
    next: Pick<ClientRowValue, 'name' | 'phone' | 'address'>,
  ) => Promise<void>;
  onQuote: () => void;
  onReset: () => void;
  onHide: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState(value.name),
    [phone, setPhone] = useState(value.phone),
    [address, setAddress] = useState(value.address),
    [rowError, setRowError] = useState('');
  useEffect(() => {
    setName(value.name);
    setPhone(value.phone);
    setAddress(value.address);
  }, [value.name, value.phone, value.address]);
  async function save() {
    if (name === value.name && phone === value.phone && address === value.address) return;
    if (name.trim().length < 2 || digitsOnly(phone).length < 9) {
      setRowError('Vérifiez le nom et le numéro du client.');
      return;
    }
    setRowError('');
    try {
      await onSave(value, { name: name.trim(), phone: phone.trim(), address: address.trim() });
    } catch (e) {
      setRowError(errorMessage(e));
    }
  }
  const update = (setter: (v: string) => void) => (event: ChangeEvent<HTMLInputElement>) =>
    setter(event.target.value);
  return (
    <tr aria-busy={busy}>
      <td>
        <input
          aria-label={`Nom · ${value.name}`}
          value={name}
          size={Math.max(12, name.length)}
          maxLength={100}
          onChange={update(setName)}
          onBlur={() => void save()}
          className="reference-client-edit name"
        />
      </td>
      <td>
        <div className="reference-client-phone">
          <input
            aria-label={`Téléphone · ${value.name}`}
            value={phone}
            onChange={update(setPhone)}
            onBlur={() => void save()}
            className="reference-client-edit"
          />
          <a href={`tel:${digitsOnly(phone)}`}>{uiText['appeler']}</a>
          {value.account?.passwordResetRequestedAt ? (
            <button
              className="reference-client-reset"
              title={uiText['reinitialiserLeMotDePasse']}
              onClick={onReset}
            >
              {uiText['demandeDeReinitReinitialiser']}
            </button>
          ) : null}
        </div>
        {rowError ? (
          <small className="reference-client-error" role="alert">
            {rowError}
          </small>
        ) : null}
      </td>
      <td>
        <input
          aria-label={`Adresse · ${value.name}`}
          value={address}
          onChange={update(setAddress)}
          onBlur={() => void save()}
          placeholder={uiText['texte']}
          className="reference-client-edit address"
        />
      </td>
      <td className="reference-client-number">{value.moves}</td>
      <td className="reference-client-amount">
        <strong>{money(value.total)}</strong>
        <span>
          {uiText['dontFinal']}
          {money(value.final)}
        </span>
      </td>
      <td className="reference-client-last">{value.last}</td>
      <td>
        <div className="reference-client-actions">
          <button className="reference-client-quote" onClick={onQuote}>
            {uiText['nouveauDevis']}
          </button>
          <button
            className="reference-client-delete"
            title={uiText['supprimer']}
            aria-label={`Supprimer ${value.name}`}
            onClick={onHide}
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}
export function AdminClients() {
  const { requestConfirmation } = useApp();
  const { loadDirectory, updateClient, hideClientProfile, resetClientPassword } = useAdminClients();
  const { bookings, loading, error, setRetry } = useAdministration();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<DirectoryEntry[]>([]);
  const [hidden, setHidden] = useState<{ phone: string; hiddenAt: string }[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [directoryError, setDirectoryError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetError, setResetError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  useEffect(() => {
    let active = true;
    loadDirectory()
      .then(([p, h, u]) => {
        if (!active) return;
        setProfiles(p);
        setHidden(h);
        setUsers(u);
      })
      .catch((e) => {
        if (active) setDirectoryError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [loadDirectory]);
  const rows = useMemo(() => {
    const summaries = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const key = normalizedClientPhone(booking.phone);
      if (!key) continue;
      const group = summaries.get(key) ?? [];
      group.push(booking);
      summaries.set(key, group);
    }
    const profileMap = new Map(profiles.map((profile) => [digitsOnly(profile.phone), profile]));
    return [...summaries.entries()]
      .flatMap(([key, all]) => {
        const hiddenEntry = hidden.find((entry) => digitsOnly(entry.phone) === key);
        const latest = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (hiddenEntry && latest.createdAt <= hiddenEntry.hiddenAt) return [];
        const profile = profileMap.get(key);
        const active = all.filter((booking) => booking.status !== 'cancelled');
        const last =
          active
            .map((booking) => booking.date)
            .filter((date): date is string => Boolean(date))
            .sort()
            .at(-1) ?? '';
        const total = active.reduce((sum, booking) => sum + amounts(booking).amount, 0);
        const final = active.reduce((sum, booking) => sum + amounts(booking).finalized, 0);
        const acct =
          users.find((user) => user.role === 'client' && digitsOnly(user.phone) === key) ?? null;
        return [
          {
            key,
            name: profile?.name ?? latest.customerName,
            phone: profile?.phone ?? latest.phone,
            address: profile ? profile.address : latest.fromAddress,
            moves: active.length,
            total,
            final,
            last: last ? shortDate(last) : '—',
            account: acct,
          },
        ];
      })
      .sort((a, b) => b.moves - a.moves || a.name.localeCompare(b.name));
  }, [bookings, profiles, hidden, users]);
  const needle = query.trim().toLocaleLowerCase('fr');
  const filtered = rows.filter(
    (row) =>
      row.name.toLocaleLowerCase('fr').includes(needle) ||
      row.phone.replace(/\D/g, '').includes(query.replace(/\D/g, '') || '!') ||
      row.address.toLocaleLowerCase('fr').includes(needle),
  );
  const pagination = usePagination(filtered, pageSizes.clients, needle);
  async function saveClient(
    initial: ClientRowValue,
    next: Pick<ClientRowValue, 'name' | 'phone' | 'address'>,
  ) {
    setBusyKey(initial.key);
    try {
      await updateClient(initial.key, next);
      const newKey = digitsOnly(next.phone);
      setProfiles((old) => [
        ...old.filter(
          (profile) =>
            digitsOnly(profile.phone) !== initial.key && digitsOnly(profile.phone) !== newKey,
        ),
        { phone: next.phone, name: next.name, address: next.address },
      ]);
      setRetry((value) => value + 1);
    } finally {
      setBusyKey('');
    }
  }
  async function hideClient(client: ClientRowValue) {
    const confirmed = await requestConfirmation({
      titleId: 'hide-client-title',
      eyebrow: messages.confirmationRequise,
      title: messages.supprimerClientTitre(client.name),
      description: messages.suppressionClientDescription(client.name),
      confirmLabel: uiText['supprimer'],
    });
    if (!confirmed) return;
    try {
      const entry = await hideClientProfile(client.key);
      setHidden((old) => [...old.filter((value) => digitsOnly(value.phone) !== client.key), entry]);
    } catch (e) {
      setDirectoryError(errorMessage(e));
    }
  }
  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    setResetBusy(true);
    setResetError('');
    try {
      const password = String(new FormData(event.currentTarget).get('password'));
      await resetClientPassword(resetTarget.id, password);
      setUsers((old) =>
        old.map((user) =>
          user.id === resetTarget.id ? { ...user, passwordResetRequestedAt: null } : user,
        ),
      );
      setResetTarget(null);
    } catch (e) {
      setResetError(errorMessage(e));
    } finally {
      setResetBusy(false);
    }
  }
  function newQuote(client: ClientRowValue) {
    navigate(routes.administrationCreateQuote, {
      state: { initialClient: { name: client.name, phone: client.phone, address: client.address } },
    });
  }
  const countLabel = `${rows.length} client${rows.length === 1 ? '' : 's'}`;
  return (
    <section className="reference-clients-page" data-screen-label="Clients administration">
      <div className="reference-clients-card">
        <div className="reference-clients-heading">
          <div>
            <span>{uiText['clients']}</span>
            <small>{countLabel}</small>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={uiText['rechercherUnNomUnNumeroUneAdresse']}
            aria-label={uiText['rechercherUnNomUnNumeroUneAdresse']}
          />
        </div>
        {error || directoryError ? (
          <p className="reference-client-error" role="alert">
            {error || directoryError}
          </p>
        ) : null}
        {loading ? <p role="status">{uiText['chargementDesClients']}</p> : null}
        {!loading && filtered.length === 0 ? (
          <span className="reference-clients-empty">{uiText['aucunClient']}</span>
        ) : null}
        <div className="reference-client-table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  'NOM',
                  'TÉLÉPHONE',
                  'ADRESSE',
                  'DÉMÉNAGEMENTS',
                  'MONTANT TOTAL',
                  'DERNIER RDV',
                  '',
                ].map((label, index) => (
                  <th key={`${index}-${label}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagination.rows.map((client) => (
                <ClientRow
                  key={client.key}
                  value={client}
                  busy={busyKey === client.key}
                  onSave={saveClient}
                  onQuote={() => newQuote(client)}
                  onHide={() => void hideClient(client)}
                  onReset={() => {
                    setResetError('');
                    setResetTarget(client.account);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          onPageChange={pagination.setPage}
        />
      </div>
      {resetTarget ? (
        <Modal
          titleId="reference-client-reset-title"
          busy={resetBusy}
          onClose={() => setResetTarget(null)}
        >
          <form className="confirmation-dialog" onSubmit={resetPassword}>
            <h2 id="reference-client-reset-title">{uiText['reinitialiserLeMotDePasse']}</h2>
            <p>{uiText['verifiezLIdentiteDuClientParTelephoneAvantDeLuiCommuni']}</p>
            <label htmlFor="reference-client-new-password">{uiText['nouveauMotDePasse']}</label>
            <input
              id="reference-client-new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              pattern="(?=.*[A-Za-z])(?=.*[0-9]).{10,128}"
              minLength={10}
              maxLength={128}
              required
            />
            {resetError ? (
              <p role="alert" className="alert error">
                {resetError}
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setResetTarget(null)}
              >
                {uiText['annuler']}
              </button>
              <button className="button primary" disabled={resetBusy}>
                {resetBusy ? 'Enregistrement…' : 'Réinitialiser'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
