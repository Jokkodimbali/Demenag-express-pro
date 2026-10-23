import { NavLink, Outlet } from 'react-router-dom';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';

export function AdminSettings() {
  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>{messages.tarifsEtParametres}</h2>
          <p>{messages.parametresDescription}</p>
        </div>
      </div>
      <nav className="tabs settings-tabs" aria-label={messages.tarifsEtParametres}>
        <NavLink to={routes.administrationPricing}>{messages.tarification}</NavLink>
        <NavLink to={routes.administrationTollPoints}>Péages</NavLink>
        <NavLink to={routes.administrationBookingRules}>{messages.regles}</NavLink>
        <NavLink to={routes.administrationInvoicing}>{messages.facturation}</NavLink>
        <NavLink to={routes.administrationQuestionnaire}>Questionnaire client</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
