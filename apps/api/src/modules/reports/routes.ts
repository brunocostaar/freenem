import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createReportResponseSchema,
  createReportSchema,
  idParamSchema,
  reportListQuerySchema,
  reportListResponseSchema,
  reportPatchSchema,
} from '@freenem/shared';
import { env } from '../../env.js';
import { closeReport, createReport, listReports } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/questions/:id/reports',
    {
      preHandler: app.authenticate,
      config: env.RATE_LIMIT_ENABLED ? { rateLimit: { max: 10, timeWindow: '1 minute' } } : {},
      schema: {
        params: idParamSchema,
        body: createReportSchema,
        response: { 201: createReportResponseSchema },
      },
    },
    async (req, reply) => {
      const r = await createReport(req.sessionUser!.id, req.params.id, req.body);
      if (!r.ok) {
        if (r.code === 'NOT_FOUND') throw app.httpErrors.notFound('Questão não encontrada.');
        throw app.httpErrors.conflict('Você já reportou um problema nesta questão.');
      }
      return reply.status(201).send({ id: r.id });
    },
  );

  const guard = app.requireRole('reviewer', 'admin');

  app.get(
    '/review/reports',
    {
      preHandler: guard,
      schema: { querystring: reportListQuerySchema, response: { 200: reportListResponseSchema } },
    },
    async (req) => listReports(req.query),
  );

  app.patch(
    '/review/reports/:id',
    {
      preHandler: guard,
      schema: {
        params: idParamSchema,
        body: reportPatchSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const ok = await closeReport(req.params.id, req.body.status, req.sessionUser!.id);
      if (!ok) throw app.httpErrors.notFound('Reporte não encontrado.');
      return { ok: true as const };
    },
  );
};

export default routes;
