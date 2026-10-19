import type { Notification, NotificationPublisher } from '../../../application/ports/index.js';
import type { NotificationRepository } from '../../../application/ports/index.js';
import type { User } from '../../../domain/model.js';

type Subscriber = { user: User; send: (notification: Notification) => void };

export class RealtimeNotifications implements NotificationPublisher {
  private subscribers = new Set<Subscriber>();

  constructor(private readonly repository: NotificationRepository) {}

  subscribe(user: User, send: Subscriber['send']) {
    const subscriber = { user, send };
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  async publish(
    notification: Notification,
    recipients: { userIds?: string[]; roles?: User['role'][] },
  ) {
    const deliveries = await this.repository.publish(notification, recipients);
    for (const delivery of deliveries) {
      for (const subscriber of this.subscribers) {
        if (subscriber.user.id === delivery.userId) subscriber.send(delivery.notification);
      }
    }
  }
}
