import { ArrowUpRight, LogOut, MessageCircle, Phone, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../application/context';
export function Layout() {
  const { user, setUser, api, catalogue } = useApp();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  const [error, setError] = useState('');
  async function logout() {
    try {
      await api.logout();
      setUser(null);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Demenag Express, accueil">
            <img src="/assets/logo.png" alt="" />
            <span>
              <strong>DEMENAG EXPRESS</strong>
              <small>PRO · MTH</small>
            </span>
          </Link>
          <nav aria-label="Navigation principale">
            <NavLink to="/#reserver" className="nav-book">
              Réserver <ArrowUpRight size={15} />
            </NavLink>
            {user ? (
              <>
                <NavLink
                  className="button secondary small"
                  to={user.role === 'admin' ? '/admin' : '/mon-espace'}
                >
                  <UserRound size={16} />
                  <span>{user.role === 'admin' ? 'Administration' : 'Mon espace'}</span>
                </NavLink>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="button primary small" to="/connexion">
                <UserRound size={16} />
                Mon compte
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
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <p>UNE QUESTION ?</p>
            <a
              className="footer-phone"
              href={'tel:' + (catalogue?.settings.businessPhone || '+221775105104')}
            >
              {catalogue?.settings.businessPhone || '+221 77 510 51 04'}
            </a>
          </div>
          <div className="footer-actions">
            <a href={'tel:' + (catalogue?.settings.businessPhone || '+221775105104')}>
              <Phone size={17} /> Appel
            </a>
            <a href={'sms:' + (catalogue?.settings.businessPhone || '+221775105104')}>
              <MessageCircle size={17} /> SMS
            </a>
            <a
              href={
                'https://wa.me/' +
                (catalogue?.settings.businessPhone || '+221775105104').replace(/\D/g, '')
              }
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={17} /> WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
