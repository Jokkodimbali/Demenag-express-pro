import type { ApplicationApi } from '../application/ports';
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
      throw new ApiError('Connexion au serveur impossible. Réessayez dans un instant.', 0);
    }
    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => ({ message: 'Réponse du serveur invalide.' }));
    if (!response.ok)
      throw new ApiError(
        data.fields?.length
          ? `${data.message} ${data.fields[0].message}`
          : data.message || 'Une erreur est survenue.',
        response.status,
      );
    return data as T;
  }
  return {
    changePassword: (oldPassword, newPassword) =>
      request('/auth/password', 'POST', { oldPassword, newPassword }),
    users: () => request('/admin/users'),
    updateUser: (user) => request(`/admin/users/${user.id}`, 'PUT', user),
    createUser: (user) => request('/admin/users', 'POST', user),
    catalogue: () => request('/catalogue'),
    updateCatalogue: (value) => request('/catalogue', 'PUT', value),
    me: () => request('/auth/me'),
    login: (phone, password) => request('/auth/login', 'POST', { phone, password }),
    register: (name, phone, password) =>
      request('/auth/register', 'POST', { name, phone, password }),
    logout: () => request('/auth/logout', 'POST'),
    bookings: () => request('/bookings'),
    booking: (id) => request(`/bookings/${id}`),
    createBooking: (input) => request('/bookings', 'POST', input),
    status: (id, status, version) =>
      request(`/bookings/${id}/status`, 'PATCH', { status, version }),
    quote: (id, input) => request(`/bookings/${id}/quotes`, 'POST', input),
    route: (from, to) => request('/maps/route', 'POST', { from, to }),
    search: (query) => request(`/maps/search?q=${encodeURIComponent(query)}`),
    estimate: (vehicleId, routeId, options, signal) =>
      request('/estimates', 'POST', { vehicleId, routeId, options }, signal),
  };
}
