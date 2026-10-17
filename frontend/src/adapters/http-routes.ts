export const httpRoutes = {
  users: '/admin/users',
  drivers: '/admin/drivers',
  catalogue: '/catalogue',
  authentication: {
    current: '/auth/me',
    login: '/auth/login',
    logout: '/auth/logout',
    password: '/auth/password',
    register: '/auth/register',
  },
  bookings: '/bookings',
  driver: {
    profile: '/driver/profile',
    bookings: '/driver/bookings',
  },
  estimates: '/estimates',
  maps: {
    route: '/maps/route',
    search: '/maps/search',
  },
} as const;
