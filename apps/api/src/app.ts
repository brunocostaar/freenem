import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env, isTest } from './env.js';
import errors from './plugins/errors.js';
import authDecorators from './plugins/auth.js';
import authRoutes from './plugins/auth-routes.js';
import { registerModules } from './modules/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: isTest ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(errors);
  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, {
    origin: [env.WEB_ORIGIN],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, {
    global: env.RATE_LIMIT_ENABLED,
    max: 300,
    timeWindow: '1 minute',
  });

  if (env.STORAGE_DRIVER === 'local') {
    // Imagens das questões (driver local). Em produção usa-se R2 + CDN.
    const storageRoot = path.resolve(env.STORAGE_DIR);
    mkdirSync(storageRoot, { recursive: true });
    await app.register(fastifyStatic, {
      root: storageRoot,
      prefix: '/files/',
      cacheControl: true,
      maxAge: '30d',
      immutable: true,
      decorateReply: false,
    });
  }

  await app.register(authDecorators);
  await app.register(authRoutes);
  await registerModules(app);

  return app;
}
