import '../src/config/env.js';
import { readEnv } from '../src/config/env.js';
import { createPrisma } from '../src/adapters/out/prisma/client.js';
import { PrismaUsers } from '../src/adapters/out/prisma/repositories.js';
import { ScryptPasswords, ids } from '../src/adapters/out/security/crypto.js';
import { normalizePhone } from '../src/application/services/auth.js';
import { registerSchema } from '../src/adapters/in/http/schemas.js';
import { z } from 'zod';
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
if (adminEmail && !z.email().safeParse(adminEmail).success)
  throw new Error('ADMIN_EMAIL doit être une adresse email valide.');
const input = registerSchema.safeParse({
  name: process.env.ADMIN_NAME,
  phone: process.env.ADMIN_PHONE,
  password: process.env.ADMIN_PASSWORD,
});
if (!input.success)
  throw new Error(
    'Renseignez ADMIN_NAME, ADMIN_PHONE et ADMIN_PASSWORD (10 caractères minimum) dans backend/.env.',
  );
if (!input.data.name || !input.data.password)
  throw new Error('Renseignez ADMIN_NAME et ADMIN_PASSWORD dans backend/.env.');
const db = createPrisma(readEnv().DATABASE_URL);
try {
  const users = new PrismaUsers(db);
  const phone = normalizePhone(input.data.phone);
  if (await users.findByPhone(phone))
    throw new Error('Ce compte existe déjà. Aucun rôle ni mot de passe modifié.');
  await users.create({
    id: ids.next(),
    name: input.data.name,
    phone,
    email: adminEmail,
    role: 'admin',
    passwordHash: await new ScryptPasswords().hash(input.data.password),
  });
  console.log('Compte administrateur créé. Retirez ADMIN_PASSWORD du fichier .env.');
} finally {
  await db.$disconnect();
}
