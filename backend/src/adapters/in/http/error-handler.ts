import type { Express } from 'express';
import { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../../domain/errors.js';
export function registerErrorHandler(app: Express) {
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        message: 'Vérifiez les champs du formulaire.',
        fields: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({ message: error.message, code: error.code });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ message: 'Requête JSON invalide.' });
      return;
    }
    console.error('Erreur API :', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ message: 'Une erreur est survenue. Réessayez dans un instant.' });
  });
}
