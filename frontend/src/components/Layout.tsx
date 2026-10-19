import {
  ArrowUpRight,
  ChevronDown,
  ClipboardList,
  ClipboardCheck,
  CheckCircle2,
  LogOut,
  MessageCircle,
  Phone,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useLayout } from '../application/controllers/useLayout';
import { messages } from '../content/fr';
import { routes } from '../routing/routes';
import { NotificationCenter } from './NotificationCenter';
export function Layout() {
  const { user, catalogue, error, logout } = useLayout();
  const [headerSuccess, setHeaderSuccess] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const closeAccountMenu = useCallback(() => {
    if (accountMenuRef.current) accountMenuRef.current.open = false;
  }, []);
  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target))
        closeAccountMenu();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') closeAccountMenu();
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeAccountMenu]);
  useEffect(() => {
    function receiveSuccess(event: Event) {
      if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
      setHeaderSuccess(event.detail);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setHeaderSuccess(''), 7000);
    }
    window.addEventListener('demenag:header-success', receiveSuccess);
    return () => {
      window.removeEventListener('demenag:header-success', receiveSuccess);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

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
            {user?.role !== 'driver' ? (
              <NavLink to={routes.booking} className="nav-book">
                {messages.reserver}
                <ArrowUpRight size={15} />
              </NavLink>
            ) : null}
            {user ? (
              <>
                {headerSuccess && <span className="header-success" role="status"><CheckCircle2 size={16}/>{headerSuccess}</span>}
                <NotificationCenter user={user} />
                <details className="account-menu" ref={accountMenuRef}>
                  <summary aria-label={`${messages.menuDuCompte} ${user.name}`}>
                    {user.photo ? (
                      <img className="account-avatar" src={user.photo} alt="" />
                    ) : (
                      <UserRound size={17} />
                    )}
                    <span>{user.name}</span>
                    <ChevronDown size={15} />
                  </summary>
                  <div className="account-dropdown">
                    {user.role === 'driver' ? (
                      <>
                        <NavLink to={routes.driverWorkspace} onClick={closeAccountMenu}>
                          <ClipboardList size={16} />
                          {messages.mesMissions}
                        </NavLink>
                        <NavLink to={routes.driverVehicleCheck} onClick={closeAccountMenu}>
                          <ClipboardCheck size={16} />
                          Contrôle du véhicule
                        </NavLink>
                        <NavLink to={routes.driverProfile} onClick={closeAccountMenu}>
                          <UserRound size={16} />
                          {messages.monProfil}
                        </NavLink>
                      </>
                    ) : user.role === 'admin' ? (
                      <>
                        <NavLink to={routes.administration} onClick={closeAccountMenu}>
                          <ClipboardList size={16} />
                          {messages.labelAdministration}
                        </NavLink>
                        <NavLink to={routes.account} onClick={closeAccountMenu}>
                          <UserRound size={16} />
                          {messages.monProfil}
                        </NavLink>
                      </>
                    ) : (
                      <NavLink to={routes.account} onClick={closeAccountMenu}>
                        <UserRound size={16} />
                        {messages.monEspace}
                      </NavLink>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        closeAccountMenu();
                        void logout();
                      }}
                    >
                      <LogOut size={16} />
                      {messages.seDeconnecter}
                    </button>
                  </div>
                </details>
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
                href={'https://wa.me/' + (catalogue.settings.whatsappPhone || catalogue.settings.businessPhone || '').replace(/\D/g, '')}
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
