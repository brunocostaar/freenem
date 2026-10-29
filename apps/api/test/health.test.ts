import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './helpers.js';

describe('GET /health', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('retorna ok com banco acessível', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: true });
  });

  it('GET /api/v1/config expõe feature flags', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json().features.googleLogin).toBe(false);
  });
});
