import { FilePlus2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdministration } from '../application/controllers/useAdministration';
import { DefinitiveQuotes } from '../components/AdministrationDashboard';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function AdminFinance() {
  const { bookings, loading, error } = useAdministration();
  const navigate = useNavigate();
  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>{messages.devisEtFactures}</h2>
          <p>{messages.financeDescription}</p>
        </div>
        <button
          className="button primary"
          onClick={() => navigate(routes.administrationCreateQuote)}
        >
          <FilePlus2 size={17} />
          {messages.nouveauDevisClient}
        </button>
      </div>
      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="panel loading">{messages.chargementDesReservations}</p>
      ) : (
        <DefinitiveQuotes
          bookings={bookings}
          onSelect={(booking) =>
            navigate(`${routes.administrationBookings}?q=${booking.reference}&detail=${booking.id}`)
          }
          onEdit={(booking) =>
            navigate(
              `${routes.administrationBookings}?q=${booking.reference}&detail=${booking.id}&edit=quote`,
            )
          }
        />
      )}
    </div>
  );
}
