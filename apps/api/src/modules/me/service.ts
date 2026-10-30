import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import type { MeResponse } from '@freenem/shared';
import type { SessionUser } from '../../plugins/auth.js';

export function toMe(u: SessionUser): MeResponse {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    image: u.image ?? null,
    role: u.role,
  };
}

/** Remove o usuário; as FKs `on delete cascade` limpam todo o resto. */
export async function deleteAccount(userId: string): Promise<void> {
  await db.delete(schema.user).where(eq(schema.user.id, userId));
}
