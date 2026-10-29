import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  attemptResultSchema,
  attemptSaveResponseSchema,
  attemptSaveSchema,
  attemptSchema,
  attemptSessionSchema,
  idParamSchema,
  simuladoCreateSchema,
  simuladoListSchema,
  simuladoOptionsSchema,
  simuladoSchema,
} from '@freenem/shared';
import { z } from 'zod';
import {
  createSimulado,
  finishAttempt,
  getAttemptResult,
  getAttemptSession,
  getOptions,
  getSimulado,
  listSimulados,
  saveAnswers,
  startAttempt,
} from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  const pre = { preHandler: app.authenticate };

  app.get(
    '/simulados/options',
    { ...pre, schema: { response: { 200: simuladoOptionsSchema } } },
    () => getOptions(),
  );

  app.get(
    '/simulados',
    { ...pre, schema: { response: { 200: simuladoListSchema } } },
    async (req) => ({
      items: await listSimulados(req.sessionUser!.id),
    }),
  );

  app.post(
    '/simulados',
    { ...pre, schema: { body: simuladoCreateSchema, response: { 201: simuladoSchema } } },
    async (req, reply) => {
      const created = await createSimulado(req.sessionUser!.id, req.body);
      return reply.status(201).send(created);
    },
  );

  app.get(
    '/simulados/:id',
    { ...pre, schema: { params: idParamSchema, response: { 200: simuladoSchema } } },
    (req) => getSimulado(req.sessionUser!.id, req.params.id),
  );

  app.post(
    '/simulados/:id/attempts',
    {
      ...pre,
      schema: {
        params: idParamSchema,
        response: {
          200: z.object({ attempt: attemptSchema }),
          201: z.object({ attempt: attemptSchema }),
        },
      },
    },
    async (req, reply) => {
      const { attempt, created } = await startAttempt(req.sessionUser!.id, req.params.id);
      return reply.status(created ? 201 : 200).send({ attempt });
    },
  );

  app.get(
    '/attempts/:id',
    { ...pre, schema: { params: idParamSchema, response: { 200: attemptSessionSchema } } },
    (req) => getAttemptSession(req.sessionUser!.id, req.params.id),
  );

  app.put(
    '/attempts/:id/answers',
    {
      ...pre,
      schema: {
        params: idParamSchema,
        body: attemptSaveSchema,
        response: { 200: attemptSaveResponseSchema },
      },
    },
    (req) => saveAnswers(req.sessionUser!.id, req.params.id, req.body),
  );

  app.post(
    '/attempts/:id/finish',
    { ...pre, schema: { params: idParamSchema, response: { 200: attemptResultSchema } } },
    (req) => finishAttempt(req.sessionUser!.id, req.params.id),
  );

  app.get(
    '/attempts/:id/result',
    { ...pre, schema: { params: idParamSchema, response: { 200: attemptResultSchema } } },
    (req) => getAttemptResult(req.sessionUser!.id, req.params.id),
  );
};

export default routes;
