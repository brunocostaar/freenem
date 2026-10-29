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
