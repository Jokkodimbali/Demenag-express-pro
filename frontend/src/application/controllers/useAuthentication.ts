import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { routes } from '../../routing/routes';
export function useAuthentication() {
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
      const user = register
        ? await api.register(String(f.get('name')), phone, password)
        : await api.login(phone, password);
      setUser(user);
      navigate(
        params.get('retour') === 'reservation'
          ? routes.booking
          : user.role === 'admin'
            ? routes.administration
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
