import type { Notification, NotificationPublisher } from '../../../application/ports/index.js';
import type { User } from '../../../domain/model.js';

type Subscriber = { user: User; send: (notification: Notification) => void };

export class RealtimeNotifications implements NotificationPublisher {
  private subscribers = new Set<Subscriber>();

  subscribe(user: User, send: Subscriber['send']) {
    const subscriber = { user, send };
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  publish(notification: Notification, recipients: { userIds?: string[]; roles?: User['role'][] }) {
    for (const subscriber of this.subscribers) {
      if (
        recipients.userIds?.includes(subscriber.user.id) ||
        recipients.roles?.includes(subscriber.user.role)
      )
        subscriber.send(notification);
    }
  }
}
