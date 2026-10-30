import { uiText } from '../content/reference-ui-text';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useLayout } from '../application/controllers/useLayout';
import { routes } from '../routing/routes';
import { whatsappUrl } from '../application/services/whatsapp';

export function Layout() {
  const { user, catalogue, error, logout } = useLayout();
  const { pathname, hash } = useLocation();
  const [headerSuccess, setHeaderSuccess] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname === routes.home && hash === '#reserver') {
      requestAnimationFrame(() =>
        document.getElementById('reserver')?.scrollIntoView({ behavior: 'smooth' }),
      );
    }
  }, [pathname, hash]);
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

  const accountRoute =
    user?.role === 'admin'
      ? routes.administration
      : user?.role === 'driver'
        ? routes.driverWorkspace
        : routes.account;

  return (
    <>
      <a className="skip-link" href="#main">
        {uiText['allerAuContenu']}
      </a>
      <header className="reference-header">
        <div className="reference-header-inner">
          <Link
            to={routes.home}
            className="reference-brand"
            aria-label={uiText['demenagExpressProMTH']}
          >
            <img src="/assets/logo.png" alt={uiText['demenagExpressProMTH']} />
            <span>
              <strong>{uiText['demenagEXPRESS']}</strong>
              <small>{uiText['proMTH']}</small>
            </span>
          </Link>
          <nav aria-label={uiText['navigationPrincipale']}>
            <Link className="reference-nav-book" to={`${routes.home}#reserver`}>
              {uiText['reserver2']}
            </Link>
            {user ? (
              <>
                <Link className="reference-nav-account" to={accountRoute}>
                  {user.role === 'admin' ? 'Administration' : 'Mon espace'}
                </Link>
                <button
                  type="button"
                  className="reference-nav-logout"
                  onClick={() => void logout()}
                >
                  {uiText['deconnexion']}
                </button>
              </>
            ) : (
              <Link className="reference-nav-login" to={routes.login}>
                {uiText['monCompte']}
              </Link>
            )}
          </nav>
        </div>
        <div className="reference-flag" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>
      {headerSuccess && (
        <div className="reference-notice" role="status">
          {headerSuccess}
        </div>
      )}
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
      {pathname === routes.home && catalogue && (
        <footer className="reference-footer">
          <div className="reference-footer-inner">
            <div>
              <span>{uiText['uneQUESTION']}</span>
              <a href={'tel:' + catalogue.settings.businessPhone}>
                {catalogue.settings.businessPhone === '+221775105104'
                  ? '+221 77 510 51 04'
                  : catalogue.settings.businessPhone}
              </a>
            </div>
            <div className="reference-footer-actions">
              <a href={'tel:' + catalogue.settings.businessPhone}>{uiText['appel']}</a>
              <a href={'sms:' + catalogue.settings.businessPhone}>{uiText['sms']}</a>
              <a
                href={whatsappUrl(
                  catalogue.settings.whatsappPhone || catalogue.settings.businessPhone,
                  '',
                  catalogue.settings,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {uiText['whatsapp']}
              </a>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
