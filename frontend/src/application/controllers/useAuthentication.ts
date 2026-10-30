import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context';
import { errorMessage } from '../error-message';
import { routes } from '../../routing/routes';
import { messages } from '../../content/fr';
export function useAuthentication() {
  const { api, setUser } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [resetSent, setResetSent] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const phone = String(f.get('phone') ?? ''),
        password = String(f.get('password') ?? '');
      if (register) {
        const role = String(f.get('accountRole') ?? 'client');
        if (role === 'driver') {
          await api.login(phone, password);
        } else {
          if (password !== String(f.get('passwordConfirmation')))
            throw new Error('Les deux mots de passe ne correspondent pas.');
          if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password))
            throw new Error(
              'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.',
            );
          await api.register(String(f.get('name')), phone, password, 'client');
        }
      } else await api.login(String(f.get('identifier')), password);
      const user = await api.me();
      if (!user) throw new Error(messages.sessionImpossibleAVerifierReconnectezVous);
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
  async function requestPasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      await api.requestPasswordReset(String(form.get('phone')));
      setResetSent(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return {
    register,
    setRegister,
    busy,
    error,
    setError,
    submit,
    requestPasswordReset,
    resetSent,
    setResetSent,
  };
}
