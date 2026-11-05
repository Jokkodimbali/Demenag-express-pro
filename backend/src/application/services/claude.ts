import type {
  ClaudeCompletionInput,
  ClaudeConfigurationRepository,
  ClaudeMessage,
  ClaudeModel,
} from '../ports/index.js';
import type { ClaudeUseCases } from '../ports/use-cases.js';
import { AppError } from '../../domain/errors.js';
import type { User } from '../../domain/model.js';

type AnthropicModel = { id?: unknown; display_name?: unknown };
type AnthropicModelsResponse = { data?: AnthropicModel[]; error?: { message?: string } };
type AnthropicMessageResponse = {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
};

const apiBase = 'https://api.anthropic.com/v1';
const apiVersion = '2023-06-01';

function requireAdmin(actor: User) {
  if (!actor.active || actor.role !== 'admin')
    throw new AppError(403, 'Action réservée à l’administration.');
}

function responseMessage(value: unknown, fallback: string) {
  if (typeof value !== 'object' || value === null || !('error' in value)) return fallback;
  const error = value.error;
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : fallback;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

export class ClaudeService implements ClaudeUseCases {
  constructor(private readonly repository: ClaudeConfigurationRepository) {}

  async status(actor: User) {
    requireAdmin(actor);
    const configuration = await this.repository.find();
    if (!configuration) return { connected: false, model: '', models: [] };
    return {
      connected: true,
      model: configuration.model || this.defaultModel(configuration.models),
      models: configuration.models,
    };
  }

  async connect(actor: User, key: string) {
    requireAdmin(actor);
    const cleanKey = key.trim();
    if (!/^sk-/u.test(cleanKey))
      throw new AppError(400, 'Collez une clé API valide (elle commence par sk-).');
    const models = await this.fetchModels(cleanKey);
    if (!models.length) throw new AppError(502, 'Aucun modèle disponible sur ce compte Claude.');
    const model = this.defaultModel(models);
    await this.repository.saveKey(cleanKey, { model, models });
    return { connected: true, model, models };
  }

  async selectModel(actor: User, model: string) {
    requireAdmin(actor);
    const configuration = await this.requireConfiguration();
    const apiKey = await this.requireApiKey();
    const models = configuration.models.length
      ? configuration.models
      : await this.fetchModels(apiKey);
    if (!models.some((item) => item.id === model))
      throw new AppError(400, 'Modèle Claude invalide.');
    await this.repository.updateModel(model);
    return { model, models };
  }

  async test(actor: User) {
    requireAdmin(actor);
    const response = await this.complete(actor, {
      prompt: 'Réponds seulement : OK',
      maxTokens: 10,
    });
    return { response };
  }

  async disconnect(actor: User) {
    requireAdmin(actor);
    await this.repository.remove();
  }

  async complete(actor: User, input: ClaudeCompletionInput) {
    requireAdmin(actor);
    const configuration = await this.requireConfiguration();
    const key = await this.requireApiKey();
    const models = configuration.models;
    const model = configuration.model || this.defaultModel(models);
    if (!model) throw new AppError(502, 'Aucun modèle disponible sur ce compte Claude.');
    const messages: ClaudeMessage[] = input.messages?.length
      ? input.messages
      : input.prompt
        ? [{ role: 'user', content: input.prompt }]
        : [];
    if (!messages.length) throw new AppError(400, 'Ajoutez un message à transmettre à Claude.');
    const response = await fetch(`${apiBase}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': apiVersion,
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.max(1, Math.min(4096, Math.round(input.maxTokens ?? 1500))),
        ...(input.system ? { system: input.system } : {}),
        messages,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const result = await readJson<AnthropicMessageResponse>(response);
    if (!response.ok)
      throw new AppError(502, responseMessage(result, `Erreur Claude ${response.status}.`));
    return (result.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n');
  }

  private async requireConfiguration() {
    const configuration = await this.repository.find();
    if (!configuration)
      throw new AppError(409, 'Claude n’est pas connecté. Ajoutez votre clé dans Paramètres.');
    return configuration;
  }

  private async requireApiKey() {
    const key = await this.repository.apiKey();
    if (!key)
      throw new AppError(409, 'Claude n’est pas connecté. Ajoutez votre clé dans Paramètres.');
    return key;
  }

  private async fetchModels(key: string): Promise<ClaudeModel[]> {
    const response = await fetch(`${apiBase}/models?limit=50`, {
      headers: { 'x-api-key': key, 'anthropic-version': apiVersion },
      signal: AbortSignal.timeout(20_000),
    });
    const result = await readJson<AnthropicModelsResponse>(response);
    if (!response.ok)
      throw new AppError(502, responseMessage(result, `Erreur Claude ${response.status}.`));
    return (result.data ?? []).flatMap((model) =>
      typeof model.id === 'string'
        ? [
            {
              id: model.id,
              name: typeof model.display_name === 'string' ? model.display_name : model.id,
            },
          ]
        : [],
    );
  }

  private defaultModel(models: ClaudeModel[]) {
    return models.find((model) => /opus/iu.test(model.id))?.id ?? models[0]?.id ?? '';
  }
}
