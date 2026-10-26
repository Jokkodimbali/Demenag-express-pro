import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { routes } from '../../routing/routes';
import { messages } from '../../content/fr';
export type LoginSpace = 'client' | 'driver' | 'admin';
export function useAuthentication(space: LoginSpace) {
  const { api, setUser } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const phone = String(f.get('phone')),
        password = String(f.get('password'));
      if (register) await api.register(String(f.get('name')), phone, password);
      else await api.login(phone, password);
      const user = await api.me();
      if (!user) throw new Error(messages.sessionImpossibleAVerifierReconnectezVous);
      if (user.role !== space) {
        await api.logout();
        throw new Error('Ce compte ne correspond pas à l’espace sélectionné.');
      }
      setUser(user);
      navigate(
        params.get('retour') === 'reservation' && user.role === 'client'
          ? routes.booking
          : user.role === 'admin'
            ? routes.administration
            : user.role === 'driver'
              ? routes.driverWorkspace
              : routes.account,
        { replace: true },
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { register, setRegister, busy, error, setError, submit };
}
