export const apiRoutes = {
  health: '/api/health',
  ready: '/api/ready',
  catalogue: '/api/catalogue',
  vehicles: '/api/catalogue/vehicles',
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
  },
  administration: {
    users: '/api/admin/users',
    drivers: '/api/admin/drivers',
  },
  driver: {
    profile: '/api/driver/profile',
    bookings: '/api/driver/bookings',
  },
} as const;
