import { ArrowUpRight, LogOut, MessageCircle, Phone, UserRound } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useLayout } from '../application/controllers/useLayout';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
import { NotificationCenter } from './NotificationCenter';
export function Layout() {
  const { user, catalogue, error, logout } = useLayout();

  return (
    <>
      <a className="skip-link" href="#main">
        {messages.allerAuContenu}
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to={routes.home} className="brand" aria-label={messages.demenagExpressAccueil}>
            <img src="/assets/logo.png" alt={messages.text} />
            <span>
              <strong>{messages.demenagExpress}</strong>
              <small>{messages.proMth}</small>
            </span>
          </Link>
          <nav aria-label={messages.navigationPrincipale}>
            <NavLink to={routes.booking} className="nav-book">
              {messages.reserver}
              <ArrowUpRight size={15} />
            </NavLink>
            {user ? (
              <>
                <NotificationCenter user={user} />
                <NavLink
                  className="button secondary small"
                  to={
                    user.role === 'admin'
                      ? routes.administration
                      : user.role === 'driver'
                        ? routes.driverWorkspace
                        : routes.account
                  }
                >
                  <UserRound size={16} />
                  <span>
                    {user.role === 'admin'
                      ? messages.labelAdministration
                      : user.role === 'driver'
                        ? messages.mesMissions
                        : messages.monEspace}
                  </span>
                </NavLink>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label={messages.seDeconnecter}
                  title={messages.seDeconnecter}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="button primary small" to={routes.login}>
                <UserRound size={16} />
                {messages.monCompte}
              </Link>
            )}
          </nav>
        </div>
        <div className="flag-line" />
      </header>
      {error && (
        <div className="container">
          <p className="alert error" role="alert">
            {error}
          </p>
        </div>
      )}
      <main id="main">
        <Outlet />
      </main>
      {catalogue && (
        <footer className="footer">
          <div className="container footer-inner">
            <div>
              <p>{messages.uneQuestion}</p>
              <a className="footer-phone" href={'tel:' + catalogue.settings.businessPhone}>
                {catalogue.settings.businessPhone}
              </a>
            </div>
            <div className="footer-actions">
              <a href={'tel:' + catalogue.settings.businessPhone}>
                <Phone size={17} />
                {messages.appel}
              </a>
              <a href={messages.sms + catalogue.settings.businessPhone}>
                <MessageCircle size={17} />
                {messages.sms2}
              </a>
              <a
                href={'https://wa.me/' + catalogue.settings.businessPhone.replace(/\D/g, '')}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={17} />
                {messages.whatsapp}
              </a>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
