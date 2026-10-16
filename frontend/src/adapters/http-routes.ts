export const httpRoutes = {
  users: '/admin/users',
  catalogue: '/catalogue',
  authentication: {
    current: '/auth/me',
    login: '/auth/login',
    logout: '/auth/logout',
    password: '/auth/password',
    register: '/auth/register',
  },
  bookings: '/bookings',
  estimates: '/estimates',
  maps: {
    route: '/maps/route',
    search: '/maps/search',
  },
} as const;
