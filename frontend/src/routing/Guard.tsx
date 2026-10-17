import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from './routes';
import { useApp } from '../application/context';
import { messages } from '../content/fr';
import type { Role } from '../domain/model';
export function Guard({
  children,
  admin = false,
  roles,
}: {
  children: ReactNode;
  admin?: boolean;
  roles?: Role[];
}) {
  const { api, user, setUser, authLoading, error, reload } = useApp();
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    let active = true;
    void api
      .me()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [api, setUser]);
  if (authLoading || checkingSession)
    return <p className="container loading">{messages.chargementDuCompte}</p>;
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
  if (roles && !roles.includes(user.role)) return <Navigate to={routes.account} replace />;
  return children;
}
