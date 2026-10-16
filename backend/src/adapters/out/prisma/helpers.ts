import { AppError } from '../../../domain/errors.js';
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
    throw new AppError(
      409,
      'Conflit : ce numéro existe déjà ou ce véhicule est déjà réservé sur ce créneau.',
    );
  throw error;
}
