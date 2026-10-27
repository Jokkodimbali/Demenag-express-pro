import { NavLink, Outlet } from 'react-router-dom';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

const sections = [
  { to: routes.administration, label: 'Réservations' },
  { to: routes.administrationPlanning, label: 'Calendrier' },
  { to: routes.administrationFleet, label: 'Équipes' },
  { to: routes.administrationPlanFollowUp, label: 'Suivi planning' },
  { to: routes.administrationClients, label: 'Clients' },
  { to: routes.administrationCreateQuote, label: 'Créer un devis' },
  { to: routes.administrationAccounting, label: 'Comptabilité' },
  { to: routes.administrationVehicleReports, label: 'Contrôles' },
  { to: routes.administrationTollPoints, label: 'Péages' },
  { to: routes.administrationPricing, label: 'Paramètres' },
];
export function AdminLayout() {
  return (
    <section className="container workspace-page admin-workspace">
      <header className="admin-reference-heading">
        <div>
          <span>ADMINISTRATION</span>
          <h1>TABLEAU DE BORD</h1>
        </div>
        <nav className="tabs admin-tabs" aria-label={messages.navigationAdministration}>
          {sections.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </section>
  );
}
