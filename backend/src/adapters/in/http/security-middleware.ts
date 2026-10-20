import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { security } from '../../../config/security.js';
import { messages } from '../../../domain/messages/fr.js';
import type { Dependencies } from './dependencies.js';
export function registerSecurityMiddleware(
  app: Express,
  deps: Pick<Dependencies, 'origin' | 'production'>,
) {
  app.disable('x-powered-by');
  if (deps.production) app.set('trust proxy', 1);
  app.use(helmet());
  const configuredOrigins = Array.isArray(deps.origin)
    ? deps.origin
    : deps.origin.split(',').map((origin) => origin.trim());
  const origins = [...new Set(configuredOrigins)];
  if (
    !deps.production &&
    origins.some((origin) => new URL(origin).hostname === 'localhost')
  ) {
    for (const origin of origins) {
      if (new URL(origin).hostname === 'localhost')
        origins.push(origin.replace('localhost', '127.0.0.1'));
    }
  }
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: security.jsonLimit }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    '/api',
    rateLimit({
      ...security.limits.api,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: messages.tropDeRequetesReessayezDansUneMinute },
    }),
  );
  app.use('/api', (req, res, next) => {
    if (
      !security.csrf.safeMethods.some((method) => method === req.method) &&
      (req.get(security.csrf.header) !== security.csrf.value ||
        (req.get('Origin') && !origins.includes(req.get('Origin')!)))
    ) {
      res.status(403).json({ message: messages.origineDeLaRequeteRefusee });
      return;
    }
    next();
  });
}
