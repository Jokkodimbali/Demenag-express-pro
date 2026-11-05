import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type {
  ClaudeConfiguration,
  ClaudeConfigurationRepository,
} from '../../../application/ports/index.js';
import { AppError } from '../../../domain/errors.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';

export class PrismaClaudeConfiguration implements ClaudeConfigurationRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string,
  ) {}

  async find(): Promise<ClaudeConfiguration | null> {
    const row = await this.db.configurationClaude.findUnique({ where: { id: 'main' } });
    if (!row) return null;
    return {
      model: row.modele,
      models: Array.isArray(row.modeles) ? (row.modeles as { id: string; name: string }[]) : [],
    };
  }

  async apiKey(): Promise<string | null> {
    const row = await this.db.configurationClaude.findUnique({
      where: { id: 'main' },
      select: { cleChiffree: true, vecteur: true, etiquette: true },
    });
    return row ? this.decrypt(row.cleChiffree, row.vecteur, row.etiquette) : null;
  }

  async saveKey(key: string, value: ClaudeConfiguration) {
    const encrypted = this.encrypt(key);
    await this.db.configurationClaude.upsert({
      where: { id: 'main' },
      update: {
        cleChiffree: encrypted.key,
        vecteur: encrypted.iv,
        etiquette: encrypted.authTag,
        modele: value.model,
        modeles: value.models,
      },
      create: {
        id: 'main',
        cleChiffree: encrypted.key,
        vecteur: encrypted.iv,
        etiquette: encrypted.authTag,
        modele: value.model,
        modeles: value.models,
      },
    });
  }

  async updateModel(model: string) {
    await this.db.configurationClaude.update({ where: { id: 'main' }, data: { modele: model } });
  }

  async remove() {
    await this.db.configurationClaude.deleteMany({ where: { id: 'main' } });
  }

  private encrypt(key: string) {
    if (!this.encryptionSecret)
      throw new AppError(503, 'Chiffrement des clés IA non configuré sur le serveur.');
    const encryptionKey = createHash('sha256').update(this.encryptionSecret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
    return {
      key: Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]).toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  private decrypt(encryptedKey: string, iv: string, authTag: string) {
    if (!this.encryptionSecret)
      throw new AppError(503, 'Chiffrement des clés IA non configuré sur le serveur.');
    try {
      const encryptionKey = createHash('sha256').update(this.encryptionSecret).digest();
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(authTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedKey, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new AppError(503, 'La clé Claude enregistrée ne peut pas être déchiffrée.');
    }
  }
}
