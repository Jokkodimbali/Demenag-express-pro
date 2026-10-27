import { useLayoutEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const tabsRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const active = tabs?.querySelector<HTMLElement>('a.active');
    if (!tabs || !active || tabs.scrollWidth <= tabs.clientWidth) return;
    const left = active.getBoundingClientRect().left - tabs.getBoundingClientRect().left;
    if (left < 0) tabs.scrollLeft += left - 6;
    else if (left + active.offsetWidth > tabs.clientWidth)
      tabs.scrollLeft += left + active.offsetWidth - tabs.clientWidth + 6;
  }, [location.pathname]);
  return (
    <section className="container workspace-page admin-workspace">
      <header className="admin-reference-heading">
        <div>
          <span>ADMINISTRATION</span>
          <h1>TABLEAU DE BORD</h1>
        </div>
        <nav
          ref={tabsRef}
          className="tabs admin-tabs"
          aria-label={messages.navigationAdministration}
        >
          {sections.map(({ to, label }) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </section>
  );
}
