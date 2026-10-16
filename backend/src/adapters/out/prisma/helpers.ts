import { AppError } from '../../../domain/errors.js';
import { messages } from '../../../domain/messages/fr.js';
import type { User } from '../../../domain/model.js';
import { Prisma } from '../../../generated/prisma/client.js';
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const safeUser = (user: User): User => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  role: user.role,
  active: user.active,
});
export function conflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    throw new AppError(409, messages.conflitCeNumeroExisteDejaOuCeVehicule);
  throw error;
}
