import fp from 'fastify-plugin';
import { auth } from '../auth.js';
import { env } from '../env.js';

/** Monta o handler do Better Auth em /api/auth/* */
export default fp(
  async (app) => {
    app.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      // Limite estrito só para POST (login, cadastro, reset). GET /get-session é chamado a cada
      // navegação do app e não pode estourar o limite de um uso normal.
      config: env.RATE_LIMIT_ENABLED
        ? {
            rateLimit: {
              max: (req: { method: string }) => (req.method === 'GET' ? 600 : 60),
              timeWindow: '1 minute',
              keyGenerator: (req: { ip: string; method: string }) => `${req.ip}:${req.method}`,
            },
          }
        : {},
      handler: async (request, reply) => {
        const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (value === undefined) continue;
          headers.append(key, Array.isArray(value) ? value.join(', ') : String(value));
        }
        const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          body: hasBody && request.body != null ? JSON.stringify(request.body) : undefined,
        });
        const res = await auth.handler(req);

        reply.status(res.status);
        res.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
        });
        const cookies = res.headers.getSetCookie();
        if (cookies.length) reply.header('set-cookie', cookies);
        return reply.send(res.body ? await res.text() : null);
      },
    });
  },
  { name: 'auth-routes' },
);
