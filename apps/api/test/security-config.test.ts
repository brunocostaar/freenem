import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { envSchema } from '../src/env.js';

describe('trustProxy (TRUST_PROXY_HOPS=1)', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    app.get('/__ip', async (req) => ({ ip: req.ip }));
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('usa o IP anexado pelo proxy (último do X-Forwarded-For), não o forjado pelo cliente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/__ip',
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(res.json()).toEqual({ ip: '5.6.7.8' });
  });
});

describe('validação do ambiente', () => {
  const base = {
    DATABASE_URL: 'postgres://x',
    BETTER_AUTH_SECRET: 'um-segredo-real-com-bem-mais-de-32-caracteres',
  };

  it('recusa o segredo de exemplo em produção', () => {
    for (const secret of [
      'dev-secret-change-me-dev-secret-change-me',
      'dev-secret-qualquer-coisa-bem-longa-123456',
    ]) {
      const r = envSchema.safeParse({
        ...base,
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: secret,
      });
      expect(r.success).toBe(false);
    }
  });

  it('aceita o segredo de exemplo fora de produção e um segredo próprio em produção', () => {
    expect(
      envSchema.safeParse({
        ...base,
        NODE_ENV: 'development',
        BETTER_AUTH_SECRET: 'dev-secret-change-me-dev-secret-change-me',
      }).success,
    ).toBe(true);
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'production' }).success).toBe(true);
  });

  it('TRUST_PROXY_HOPS: padrão 1, aceita 0, recusa negativo', () => {
    expect(envSchema.parse(base).TRUST_PROXY_HOPS).toBe(1);
    expect(envSchema.parse({ ...base, TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS).toBe(0);
    expect(envSchema.safeParse({ ...base, TRUST_PROXY_HOPS: '-1' }).success).toBe(false);
  });
});
