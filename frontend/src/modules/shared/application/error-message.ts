import { messages } from '../content/fr';
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : messages.uneErreurEstSurvenue;
}
