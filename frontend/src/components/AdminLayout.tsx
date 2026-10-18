import {
  CalendarDays,
  ClipboardList,
  ReceiptText,
  Settings2,
  Truck,
  UsersRound,
  ClipboardCheck,
  Megaphone,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

const sections = [
  { to: routes.administration, label: messages.tableauDeBord, Icon: ClipboardList, end: true },
  { to: routes.administrationBookings, label: messages.reservations, Icon: ClipboardList },
  { to: routes.administrationPlanning, label: messages.planning, Icon: CalendarDays },
  { to: routes.administrationFinance, label: messages.devisEtFactures, Icon: ReceiptText },
  { to: routes.administrationFleet, label: messages.flotteEtChauffeurs, Icon: Truck },
  { to: routes.administrationSettings, label: messages.tarifsEtParametres, Icon: Settings2 },
  { to: routes.administrationUsers, label: messages.comptesEtAcces, Icon: UsersRound },
  { to: routes.administrationVehicleReports, label: 'Contrôles véhicules', Icon: ClipboardCheck },
  { to: routes.administrationAnnouncements, label: 'Annonces chauffeurs', Icon: Megaphone },
];

export function AdminLayout() {
  return (
    <section className="container workspace-page admin-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{messages.espaceAdministrateur}</p>
          <h1>{messages.administration}</h1>
          <p>{messages.gerezLesReservationsEtAccompagnezVosClients}</p>
        </div>
      </div>
      <nav className="tabs admin-tabs" aria-label={messages.navigationAdministration}>
        {sections.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </section>
  );
}
