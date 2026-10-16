import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from './routes';
import { useApp } from '../application/context';
import { messages } from '../content/fr';
export function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, authLoading, error, reload } = useApp();
  if (authLoading) return <p className="container loading">{messages.chargementDuCompte}</p>;
  if (error)
    return (
      <div className="container alert error">
        <p>{error}</p>
        <button className="button secondary" onClick={reload}>
          {messages.reessayer}
        </button>
      </div>
    );
  if (!user || user.active === false) return <Navigate to={routes.login} replace />;
  if (admin && user.role !== 'admin') return <Navigate to={routes.account} replace />;
  return children;
}
