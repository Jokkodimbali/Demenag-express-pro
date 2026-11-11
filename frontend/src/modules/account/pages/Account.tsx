import { uiText } from '../../shared/content/reference-ui-text';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from '../application/controllers/useAccount';
import { AdminProfileForm } from '../components/AdminProfileForm';
import { ClientBookingCard } from '../components/ClientBookingCard';
import { messages } from '../../shared/content/fr';
import { routes } from '../../app/routing/routes';
import { visibleUiText } from '../../shared/content/visible-ui-text';
export function Account() {
  const { user, bookings, loading, error, setRetry } = useAccount();
  if (user?.role === 'admin')
    return (
      <section className="container workspace-page">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{messages.profilAdministrateur}</p>
            <h1>{messages.monProfil}</h1>
            <p>{messages.informationsDuCompteAdministrateur}</p>
          </div>
          <Link className="button secondary small" to={routes.administration}>
            <ArrowLeft size={16} /> {visibleUiText.text74}
          </Link>
        </div>
        <AdminProfileForm />
      </section>
    );
  return (
    <section className="reference-client" data-screen-label="Espace client">
      <div className="reference-client-heading">
        <div>
          <span>{uiText['espaceCLIENT']}</span>
          <h1>{uiText['mesDEMENAGEMENTS']}</h1>
        </div>
        <Link to={routes.booking} state={{ newRequest: true }}>
          {uiText['nouvelleReservation']}
        </Link>
      </div>
      {user && (
        <section className="reference-client-profile" aria-label={visibleUiText.text75}>
          <span>{visibleUiText.text76}</span>
          <strong>{user.name}</strong>
          <span>{user.phone}</span>
        </section>
      )}
      {error && (
        <p className="reference-client-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            {uiText['reessayer']}
          </button>
        </p>
      )}
      {loading && <p role="status">{uiText['chargement']}</p>}
      {!loading && !error && bookings.length === 0 && (
        <div className="reference-client-empty">{uiText['aucuneReservationPourCeNumero']}</div>
      )}
      {!loading &&
        bookings.map((booking) => <ClientBookingCard key={booking.id} booking={booking} />)}
    </section>
  );
}
