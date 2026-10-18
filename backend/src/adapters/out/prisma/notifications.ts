import type { Notification, NotificationRepository } from '../../../application/ports/index.js';
import type { Role } from '../../../domain/model.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';

function map(row: { id: string; titre: string; message: string; creeLe: Date; lueLe: Date | null; reservationId: string | null }): Notification {
  return {
    id: row.id,
    title: row.titre,
    message: row.message,
    createdAt: row.creeLe.toISOString(),
    readAt: row.lueLe?.toISOString() ?? null,
    ...(row.reservationId ? { bookingId: row.reservationId } : {}),
  };
}

export class PrismaNotifications implements NotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(userId: string) {
    return (await this.db.notification.findMany({ where: { utilisateurId: userId }, orderBy: { creeLe: 'desc' }, take: 50 })).map(map);
  }

  unreadCount(userId: string) {
    return this.db.notification.count({ where: { utilisateurId: userId, lueLe: null } });
  }

  async markRead(userId: string, notificationId: string) {
    await this.db.notification.updateMany({ where: { id: notificationId, utilisateurId: userId, lueLe: null }, data: { lueLe: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.db.notification.updateMany({ where: { utilisateurId: userId, lueLe: null }, data: { lueLe: new Date() } });
  }

  async publish(notification: Notification, recipients: { userIds?: string[]; roles?: Role[] }) {
    const users = await this.db.utilisateur.findMany({
      where: {
        actif: true,
        OR: [
          ...(recipients.userIds?.length ? [{ id: { in: recipients.userIds } }] : []),
          ...(recipients.roles?.length ? [{ role: { in: recipients.roles.map((role) => role === 'admin' ? 'administrateur' : role === 'driver' ? 'chauffeur' : 'client') as ('client' | 'administrateur' | 'chauffeur')[] } }] : []),
        ],
      },
      select: { id: true },
    });
    if (!users.length) return;
    await this.db.notification.createMany({
      data: users.map(({ id }) => ({
        id: crypto.randomUUID(),
        utilisateurId: id,
        titre: notification.title,
        message: notification.message,
        reservationId: notification.bookingId ?? null,
        creeLe: new Date(notification.createdAt),
      })),
    });
  }
}
