import { StrictMode, Suspense, lazy, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { createHttpApi } from './adapters/http-api';
import { AppProvider, useApp } from './application/context';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { Home } from './pages/Home';
import './styles.css';
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const api = createHttpApi();
function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, authLoading, error, reload } = useApp();
  if (authLoading) return <p className="container loading">Chargement du compte…</p>;
  if (error)
    return (
      <div className="container alert error">
        <p>{error}</p>
        <button className="button secondary" onClick={reload}>
          Réessayer
        </button>
      </div>
    );
  if (!user) return <Navigate to="/connexion" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/mon-espace" replace />;
  return children;
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider api={api}>
        <Suspense
          fallback={
            <p className="container loading" role="status">
              Chargement…
            </p>
          }
        >
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="connexion" element={<Auth />} />
              <Route
                path="mon-espace"
                element={
                  <Guard>
                    <Account />
                  </Guard>
                }
              />
              <Route
                path="admin"
                element={
                  <Guard admin>
                    <Admin />
                  </Guard>
                }
              />
              <Route
                path="*"
                element={
                  <div className="container empty-state">
                    <h1>PAGE INTROUVABLE</h1>
                    <Link className="button primary" to="/">
                      Retour à l’accueil
                    </Link>
                  </div>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
