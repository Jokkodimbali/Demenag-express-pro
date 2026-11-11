import { messages } from '../../../shared/content/fr';
import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import type { User } from '../../../shared/domain/model';
import { routes } from '../../../shared/navigation/config/routes';

export type AuthField = 'name' | 'phone' | 'identifier' | 'password' | 'passwordConfirmation';
export type AuthFieldErrors = Partial<Record<AuthField, string>>;
export type AuthenticationMode = 'login' | 'register' | 'reset';

export type AuthenticationFormValues = Record<AuthField, string>;

function validateField(
  field: AuthField,
  values: AuthenticationFormValues,
  mode: AuthenticationMode,
): string | undefined {
  const value = values[field];

  if (field === 'name' && mode === 'register') {
    const name = value.trim();
    if (!name) return messages.authNameRequired;
    if (name.length < 2 || name.length > 100) return messages.authNameInvalid;
  }
  if (field === 'phone' && (mode === 'register' || mode === 'reset')) {
    if (!normalizePhoneNumber(value)) return messages.authPhoneInvalid;
  }
  if (field === 'identifier' && mode === 'login') {
    const identifier = value.trim();
    if (!identifier || identifier.length < 3 || identifier.length > 254)
      return messages.authIdentifierInvalid;
  }
  if (field === 'password' && mode !== 'reset') {
    if (!value) return messages.authPasswordRequired;
    if (value.length > 128) return messages.authPasswordTooLong;
    if (mode === 'register' && (value.length < 8 || !/[a-zA-Z]/.test(value) || !/\d/.test(value)))
      return messages.authPasswordWeak;
  }
  if (field === 'passwordConfirmation' && mode === 'register') {
    if (!value) return messages.authPasswordConfirmationRequired;
    if (value !== values.password) return messages.authPasswordMismatch;
  }
  return undefined;
}

export function validateAuthenticationForm(
  values: AuthenticationFormValues,
  mode: AuthenticationMode,
): AuthFieldErrors {
  const fields: AuthField[] =
    mode === 'reset'
      ? ['phone']
      : mode === 'register'
        ? ['name', 'phone', 'password', 'passwordConfirmation']
        : ['identifier', 'password'];
  const errors: AuthFieldErrors = {};
  for (const field of fields) {
    const error = validateField(field, values, mode);
    if (error) errors[field] = error;
  }
  return errors;
}

export function validateAuthenticationField(
  field: AuthField,
  values: AuthenticationFormValues,
  mode: AuthenticationMode,
): string | undefined {
  return validateField(field, values, mode);
}

export function authenticationFieldErrorsForApiFailure(
  error: string,
  registering: boolean,
): AuthFieldErrors | undefined {
  if (!registering && error === messages.authCredentialsInvalid)
    return {
      identifier: messages.authCredentialsInvalid,
      password: messages.authCredentialsInvalid,
    };
  if (registering && error === messages.authPhoneAlreadyUsed)
    return { phone: messages.authPhoneAlreadyUsed };
  return undefined;
}

export function authenticatedUserDestination(role: User['role'], returningToBooking: boolean) {
  if (returningToBooking && role === 'client') return routes.booking;
  if (role === 'admin') return routes.administration;
  if (role === 'driver') return routes.driverWorkspace;
  return routes.account;
}
