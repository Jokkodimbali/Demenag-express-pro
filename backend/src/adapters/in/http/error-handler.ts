import type { Express } from 'express';
import { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
export function registerErrorHandler(app: Express) {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      res.status(413).json({ message: messages.requeteTropVolumineuse });
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({
        message: messages.verifiezLesChampsDuFormulaire,
        fields: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ message: messages.requeteJsonInvalide });
      return;
    }
    console.error('Erreur API :', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ message: messages.uneErreurEstSurvenueReessayezDansUnInstant });
  });
}
