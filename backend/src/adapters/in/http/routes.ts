export const apiRoutes = {
  health: '/api/health',
  ready: '/api/ready',
  catalogue: '/api/catalogue',
  tollPoints: '/api/toll-points',
  auth: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    password: '/api/auth/password',
    current: '/api/auth/me',
    logout: '/api/auth/logout',
  },
  bookings: '/api/bookings',
  estimates: '/api/estimates',
  maps: {
    base: '/api/maps',
    route: '/api/maps/route',
    search: '/api/maps/search',
    reverse: '/api/maps/reverse',
  },
  administration: {
    users: '/api/admin/users',
    drivers: '/api/admin/drivers',
    profile: '/api/admin/profile',
  },
  driver: {
    profile: '/api/driver/profile',
    bookings: '/api/driver/bookings',
    inspections: '/api/driver/vehicle-inspections',
    breakdowns: '/api/driver/breakdowns',
    bookingTrips: '/api/driver/bookings/:id/trips',
  },
  vehicleReports: '/api/admin/vehicle-reports',
  notifications: {
    base: '/api/notifications',
    readAll: '/api/notifications/read-all',
    announce: '/api/admin/notifications/announce',
  },
} as const;
