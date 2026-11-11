import type { User } from '../../../shared/domain/model';

const role = (value: FormDataEntryValue | null): User['role'] =>
  value === 'admin' ? 'admin' : 'client';

export function userFromForm(data: FormData): Omit<User, 'id'> {
  return {
    name: String(data.get('name')),
    phone: String(data.get('phone')),
    role: role(data.get('role')),
    active: data.get('active') === 'on',
  };
}
