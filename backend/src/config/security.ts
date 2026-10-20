export const security = {
  jsonLimit: '6mb',
  session: { cookieName: 'dem_session', durationMs: 7 * 86400000, path: '/api' },
  csrf: {
    header: 'X-Requested-With',
    value: 'DemenagExpress',
    safeMethods: ['GET', 'HEAD', 'OPTIONS'],
  },
  limits: {
    api: { windowMs: 60000, limit: 300 },
    authentication: { windowMs: 15 * 60000, limit: 30 },
    maps: { windowMs: 60000, limit: 120 },
  },
} as const;
