import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher, TokenProvider } from '../../../application/ports/index.js';
const derive = promisify(scrypt);
export class ScryptPasswords implements PasswordHasher {
  async hash(password: string) {
    const salt = randomBytes(16).toString('hex');
    return salt + ':' + ((await derive(password, salt, 64)) as Buffer).toString('hex');
  }
  async verify(password: string, hash: string) {
    const [salt, value] = hash.split(':');
    const actual = (await derive(password, salt || 'invalid-account-timing-salt', 64)) as Buffer;
    const expected = Buffer.from(value || '', 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
export const tokens: TokenProvider = {
  create: () => randomBytes(32).toString('base64url'),
  digest: (token) => createHash('sha256').update(token).digest('hex'),
};
export const ids = { next: () => randomUUID() };
export const clock = { now: () => new Date() };
