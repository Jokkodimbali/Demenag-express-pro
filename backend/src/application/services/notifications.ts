import { AppError } from '../../domain/errors.js';
import type { User } from '../../domain/model.js';
import type { NotificationPublisher, NotificationRepository } from '../ports/index.js';
import type { NotificationUseCases } from '../ports/use-cases.js';

export class NotificationService implements NotificationUseCases {
  constructor(private readonly repository: NotificationRepository, private readonly publisher: NotificationPublisher) {}

  async list(actor: User) {
    const [items, unreadCount] = await Promise.all([this.repository.list(actor.id), this.repository.unreadCount(actor.id)]);
    return { items, unreadCount };
  }

  markRead(actor: User, id: string) {
    return this.repository.markRead(actor.id, id);
  }

  markAllRead(actor: User) {
    return this.repository.markAllRead(actor.id);
  }

  async announce(actor: User, title: string, message: string) {
    if (actor.role !== 'admin' || !actor.active) throw new AppError(403, 'Action réservée à l’administration.');
    await this.publisher.publish({ id: crypto.randomUUID(), title, message, createdAt: new Date().toISOString() }, { roles: ['driver'] });
  }
}
