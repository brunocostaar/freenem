import { buildApp } from './app.js';
import { sql } from './db/index.js';
import { env } from './env.js';

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info(`${signal} recebido, encerrando...`);
  await app.close();
  await sql.end({ timeout: 5 });
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
