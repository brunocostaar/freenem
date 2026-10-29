import { z } from 'zod';

export const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export const idParamSchema = z.object({ id: z.string().uuid() });

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.boolean(),
  uptime: z.number(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const publicConfigSchema = z.object({
  features: z.object({
    googleLogin: z.boolean(),
    emailVerification: z.boolean(),
    essayAi: z.boolean(),
  }),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const meResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.enum(['student', 'reviewer', 'admin']),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
