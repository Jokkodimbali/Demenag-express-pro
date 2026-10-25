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
  const sessionExpiredListeners = new Set<() => void>();
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
    if (
      response.status === 401 &&
      path !== httpRoutes.authentication.login &&
      path !== httpRoutes.authentication.register &&
      path !== httpRoutes.authentication.password
    ) {
      sessionExpiredListeners.forEach((listener) => listener());
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
    onSessionExpired: (listener) => {
      sessionExpiredListeners.add(listener);
      return () => {
        sessionExpiredListeners.delete(listener);
      };
    },
    changePassword: (oldPassword, newPassword) =>
      request(httpRoutes.authentication.password, 'POST', { oldPassword, newPassword }),
    users: () => request(httpRoutes.users),
    hiddenClients: () => request(`${httpRoutes.clients}/hidden`),
    updateClient: (phone, input) => request(`${httpRoutes.clients}/${phone}`, 'PATCH', input),
    hideClient: (phone) => request(`${httpRoutes.clients}/${phone}`, 'DELETE'),
    adminProfile: () => request(httpRoutes.adminProfile),
    accountingEntries: (month) =>
      request(`${httpRoutes.accounting}${month ? `?month=${month}` : ''}`),
    createAccountingEntry: (input) => request(httpRoutes.accounting, 'POST', input),
    voidAccountingEntry: (id) => request(`${httpRoutes.accounting}/${id}`, 'DELETE'),
    updateAdminProfile: (input) => request(httpRoutes.adminProfile, 'PUT', input),
    updateUser: (user) => request(`${httpRoutes.users}/${user.id}`, 'PUT', user),
    createUser: (user) => request(httpRoutes.users, 'POST', user),
    drivers: () => request(httpRoutes.drivers),
    createDriver: (input) => request(httpRoutes.drivers, 'POST', input),
    updateDriver: (driver) => request(`${httpRoutes.drivers}/${driver.id}`, 'PUT', driver),
    driverProfile: () => request(httpRoutes.driver.profile),
    updateDriverProfile: (input) => request(httpRoutes.driver.profile, 'PUT', input),
    driverBookings: () => request(httpRoutes.driver.bookings),
    driverReports: () => request(httpRoutes.driver.inspections),
    submitVehicleInspection: (input) => request(httpRoutes.driver.inspections, 'POST', input),
    reportBreakdown: (input) => request(httpRoutes.driver.breakdowns, 'POST', input),
    adminVehicleReports: () => request(httpRoutes.vehicleReports),
    notifications: () => request(httpRoutes.notifications),
    markNotificationRead: (id) => request(`${httpRoutes.notifications}/${id}/read`, 'PATCH'),
    markAllNotificationsRead: () => request(`${httpRoutes.notifications}/read-all`, 'PATCH'),
    announceDrivers: (title, message) => request(httpRoutes.announce, 'POST', { title, message }),
    catalogue: () => request(httpRoutes.catalogue),
    tollPoints: () => request(httpRoutes.tollPoints),
    createTollPoint: (input) => request(httpRoutes.tollPoints, 'POST', input),
    updateTollPoint: (id, input) => request(`${httpRoutes.tollPoints}/${id}`, 'PUT', input),
    deleteTollPoint: (id) => request(`${httpRoutes.tollPoints}/${id}`, 'DELETE'),
    updateCatalogue: (value) => request(httpRoutes.catalogue, 'PUT', value),
    me: () => request(httpRoutes.authentication.current),
    login: (phone, password) =>
      request(httpRoutes.authentication.login, 'POST', { phone, password }),
    register: (name, phone, password) =>
      request(httpRoutes.authentication.register, 'POST', { name, phone, password }),
    logout: () => request(httpRoutes.authentication.logout, 'POST'),
    bookings: () => request(httpRoutes.bookings),
    booking: (id) => request(`${httpRoutes.bookings}/${id}`),
    deleteBooking: (id) => request(`${httpRoutes.bookings}/${id}`, 'DELETE'),
    createBooking: (input) => request(httpRoutes.bookings, 'POST', input),
    status: (id, status, version) =>
      request(`${httpRoutes.bookings}/${id}/status`, 'PATCH', { status, version }),
    startBookingTrip: (id, photos) =>
      request(`${httpRoutes.bookingTrips(id)}/start`, 'POST', { photos }),
    finishBookingTrip: (id, photos) =>
      request(`${httpRoutes.bookingTrips(id)}/finish`, 'POST', { photos }),
    finishDriverWork: (id) => request(httpRoutes.bookingDriverFinished(id), 'POST'),
    schedule: (id, date, timeSlot, version) =>
      request(`${httpRoutes.bookings}/${id}/schedule`, 'PATCH', { date, timeSlot, version }),
    updateBookingNotes: (id, notes, version) =>
      request(`${httpRoutes.bookings}/${id}/notes`, 'PATCH', { notes, version }),
    reviewWorkPlan: (id, stepId, status, reason, version) =>
      request(httpRoutes.bookingWorkPlanReview(id, stepId), 'PATCH', { status, reason, version }),
    updateBookingRoute: (id, from, to, version) =>
      request(httpRoutes.bookingRoute(id), 'PATCH', { from, to, version }),
    assignDriver: (id, driverId, version) =>
      request(`${httpRoutes.bookings}/${id}/driver`, 'PATCH', { driverId, version }),
    quote: (id, input) => request(`${httpRoutes.bookings}/${id}/quotes`, 'POST', input),
    route: (from, to) => request(httpRoutes.maps.route, 'POST', { from, to }),
    search: (query) => request(`${httpRoutes.maps.search}?q=${encodeURIComponent(query)}`),
    reverse: (point) => request(`${httpRoutes.maps.reverse}?lat=${point[0]}&lon=${point[1]}`),
    estimate: (vehicleId, routeId, options, signal, workAccess) =>
      request(httpRoutes.estimates, 'POST', { vehicleId, routeId, options, workAccess }, signal),
  };
}
