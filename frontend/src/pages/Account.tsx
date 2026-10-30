import { uiText } from '../content/reference-ui-text';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAccount } from '../application/controllers/useAccount';
import { AdminProfileForm } from '../components/AdminProfileForm';
import { ClientBookingCard } from '../components/ClientBookingCard';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
export function Account() {
  const { user, bookings, setBookings, loading, error, setRetry } = useAccount();
  const [notice, setNotice] = useState('');
  if (user?.role === 'admin')
    return (
      <section className="container workspace-page">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{messages.profilAdministrateur}</p>
            <h1>{messages.monProfil}</h1>
            <p>{messages.informationsDuCompteAdministrateur}</p>
          </div>
        </div>
        <AdminProfileForm />
      </section>
    );
  return (
    <section className="reference-client" data-screen-label="Espace client">
      {notice && (
        <div className="reference-client-toast" role="status">
          {notice}
        </div>
      )}
      <div className="reference-client-heading">
        <div>
          <span>{uiText['espaceCLIENT']}</span>
          <h1>{uiText['mesDEMENAGEMENTS']}</h1>
        </div>
        <Link to={routes.booking} state={{ newRequest: true }}>
          {uiText['nouvelleReservation']}
        </Link>
      </div>
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
        bookings.map((booking) => (
          <ClientBookingCard
            key={booking.id}
            booking={booking}
            onChange={(next) =>
              setBookings((rows) => rows.map((row) => (row.id === next.id ? next : row)))
            }
            onReminder={setNotice}
          />
        ))}
    </section>
  );
}
