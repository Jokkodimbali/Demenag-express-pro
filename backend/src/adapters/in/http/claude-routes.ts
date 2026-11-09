import type { Express } from 'express';
import { z } from 'zod';
import type { Dependencies } from './dependencies.js';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import { apiRoutes } from './routes.js';

const claudeMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(30000),
});
const completionSchema = z.object({
  system: z.string().max(20000).optional(),
  prompt: z.string().max(50000).optional(),
  messages: z.array(claudeMessageSchema).max(20).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
});

export function registerClaudeRoutes(app: Express, deps: Dependencies, access: Access) {
  const protect = [access.authenticate, access.admin] as const;
  app.get(apiRoutes.claude.base, ...protect, async (_request, response) =>
    response.json(await deps.claude.status(getActor(response))),
  );
  app.put(apiRoutes.claude.key, ...protect, async (request, response) => {
    const input = z.object({ key: z.string().trim().min(1).max(512) }).parse(request.body);
    response.json(await deps.claude.connect(getActor(response), input.key));
  });
  app.put(apiRoutes.claude.model, ...protect, async (request, response) => {
    const input = z.object({ model: z.string().trim().min(1).max(200) }).parse(request.body);
    response.json(await deps.claude.selectModel(getActor(response), input.model));
  });
  app.post(apiRoutes.claude.test, ...protect, async (_request, response) =>
    response.json(await deps.claude.test(getActor(response))),
  );
  app.delete(apiRoutes.claude.base, ...protect, async (_request, response) => {
    await deps.claude.disconnect(getActor(response));
    response.status(204).end();
  });
  app.post(apiRoutes.claude.completion, ...protect, async (request, response) => {
    const input = completionSchema.parse(request.body);
    response.json({ text: await deps.claude.complete(getActor(response), input) });
  });
}
