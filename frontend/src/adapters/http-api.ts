import type { ApplicationApi } from '../application/ports';
import { messages } from '../content/fr';
import { httpRoutes } from './http-routes';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function createHttpApi(base = import.meta.env.VITE_API_URL || '/api'): ApplicationApi {
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(base + path, {
        method,
        credentials: 'include',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'DemenagExpress' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(messages.connexionAuServeurImpossibleReessayezDansUnInstant, 0);
    }
    if (response.status === 204) return undefined as T;
    const data: unknown = await response
      .json()
      .catch(() => ({ message: messages.reponseDuServeurInvalide }));
    if (!response.ok) {
      let message = messages.uneErreurEstSurvenue as string;
      if (
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof data.message === 'string'
      ) {
        message = data.message;
        if ('fields' in data && Array.isArray(data.fields)) {
          const field: unknown = data.fields[0];
          if (
            typeof field === 'object' &&
            field !== null &&
            'message' in field &&
            typeof field.message === 'string'
          )
            message += ' ' + field.message;
        }
      }
      throw new ApiError(message, response.status);
    }
    return data as T;
  }
  return {
    changePassword: (oldPassword, newPassword) =>
      request(httpRoutes.authentication.password, 'POST', { oldPassword, newPassword }),
    users: () => request(httpRoutes.users),
    updateUser: (user) => request(`${httpRoutes.users}/${user.id}`, 'PUT', user),
    createUser: (user) => request(httpRoutes.users, 'POST', user),
    catalogue: () => request(httpRoutes.catalogue),
    updateCatalogue: (value) => request(httpRoutes.catalogue, 'PUT', value),
    me: () => request(httpRoutes.authentication.current),
    login: (phone, password) =>
      request(httpRoutes.authentication.login, 'POST', { phone, password }),
    register: (name, phone, password) =>
      request(httpRoutes.authentication.register, 'POST', { name, phone, password }),
    logout: () => request(httpRoutes.authentication.logout, 'POST'),
    bookings: () => request(httpRoutes.bookings),
    booking: (id) => request(`${httpRoutes.bookings}/${id}`),
    createBooking: (input) => request(httpRoutes.bookings, 'POST', input),
    status: (id, status, version) =>
      request(`${httpRoutes.bookings}/${id}/status`, 'PATCH', { status, version }),
    quote: (id, input) => request(`${httpRoutes.bookings}/${id}/quotes`, 'POST', input),
    route: (from, to) => request(httpRoutes.maps.route, 'POST', { from, to }),
    search: (query) => request(`${httpRoutes.maps.search}?q=${encodeURIComponent(query)}`),
    estimate: (vehicleId, routeId, options, signal) =>
      request(httpRoutes.estimates, 'POST', { vehicleId, routeId, options }, signal),
  };
}
