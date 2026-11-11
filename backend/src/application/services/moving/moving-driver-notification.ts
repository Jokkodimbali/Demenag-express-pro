import type { Booking } from '../../../domain/shared/model.js';
import type {
  Clock,
  DriverRepository,
  IdGenerator,
  NotificationPublisher,
} from '../../ports/index.js';

export async function notifyAssignedDriver(
  drivers: DriverRepository,
  notifications: NotificationPublisher | undefined,
  ids: IdGenerator,
  clock: Clock,
  booking: Booking,
  title: string,
  message: string,
) {
  if (!booking.driverId) return;
  const driver = await drivers.find(booking.driverId);
  if (!driver?.userId) return;
  try {
    await notifications?.publish(
      {
        id: ids.next(),
        title,
        message,
        createdAt: clock.now().toISOString(),
        bookingId: booking.id,
      },
      { userIds: [driver.userId] },
    );
  } catch (error) {
    console.error('Notification chauffeur non envoyée après une action de réservation :', error);
  }
}
