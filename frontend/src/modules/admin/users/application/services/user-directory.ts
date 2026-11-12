import type { Driver, User } from '../../../../shared/domain/model';

export function mergeUserDirectory(users: User[], drivers: Driver[]): User[] {
  const accounts = new Map(users.map((user) => [user.id, user]));
  for (const driver of drivers) {
    if (!driver.userId) continue;
    const account = accounts.get(driver.userId);
    accounts.set(driver.userId, {
      id: driver.userId,
      name: driver.name,
      phone: driver.phone,
      role: 'driver',
      active: driver.active && account?.active !== false,
      photo: driver.photo,
    });
  }
  return [...accounts.values()];
}
