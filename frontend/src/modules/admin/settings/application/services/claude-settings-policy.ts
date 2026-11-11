import type { ClaudeSettingsStatus } from '../../../../shared/application/ports';

export function claudeApiKeyValidationError(value: string) {
  return /^sk-/u.test(value.trim())
    ? undefined
    : 'Collez une clé API valide (elle commence par sk-).';
}

export function connectedClaudeNotice(status: ClaudeSettingsStatus) {
  const model = status.model
    ? (status.models.find((item) => item.id === status.model)?.name ?? status.model)
    : '';
  return `Compte Claude connecté${model ? ` · ${model}` : ''}.`;
}

export function claudeTestNotice(response: string) {
  return `Claude répond : ${response.trim().slice(0, 20)}`;
}
