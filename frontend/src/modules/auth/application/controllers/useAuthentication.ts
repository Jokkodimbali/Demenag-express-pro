import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../../shared/application/context';
import { errorMessage } from '../../../shared/application/error-message';
import { messages } from '../../../shared/content/fr';
import {
  authenticatedUserDestination,
  authenticationFieldErrorsForApiFailure,
  validateAuthenticationField,
  validateAuthenticationForm,
  type AuthenticationFormValues,
  type AuthenticationMode,
  type AuthField,
  type AuthFieldErrors,
} from '../services/authentication-validation';

function formValues(form: HTMLFormElement): AuthenticationFormValues {
  const values = new FormData(form);
  return {
    name: String(values.get('name') ?? ''),
    phone: String(values.get('phone') ?? ''),
    identifier: String(values.get('identifier') ?? ''),
    password: String(values.get('password') ?? ''),
    passwordConfirmation: String(values.get('passwordConfirmation') ?? ''),
  };
}

export function useAuthentication() {
  const { api, setUser } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [resetSent, setResetSent] = useState(false),
    [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  function validateForm(
    form: HTMLFormElement,
    mode: AuthenticationMode = register ? 'register' : 'login',
  ) {
    const nextErrors = validateAuthenticationForm(formValues(form), mode);
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }
  function validateSingleField(
    field: AuthField,
    form: HTMLFormElement | null,
    mode: AuthenticationMode = register ? 'register' : 'login',
  ) {
    if (!form) return;
    const fieldError = validateAuthenticationField(field, formValues(form), mode);
    setFieldErrors((current) => {
      const next = { ...current };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!validateForm(e.currentTarget)) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const phone = String(f.get('phone') ?? '');
      const password = String(f.get('password') ?? '');
      if (register) {
        await api.register(String(f.get('name')), phone, password, 'client');
      } else await api.login(String(f.get('identifier')), password);
      const user = await api.me();
      if (!user) throw new Error(messages.sessionImpossibleAVerifierReconnectezVous);
      setUser(user);
      navigate(authenticatedUserDestination(user.role, params.get('retour') === 'reservation'), {
        replace: true,
      });
    } catch (e) {
      const message = errorMessage(e);
      const apiFieldErrors = authenticationFieldErrorsForApiFailure(message, register);
      if (apiFieldErrors) {
        setFieldErrors(apiFieldErrors);
        setError('');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }
  async function requestPasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!validateForm(e.currentTarget, 'reset')) return;
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
    fieldErrors,
    validateSingleField,
    clearFieldErrors: () => setFieldErrors({}),
  };
}
