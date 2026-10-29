import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { isProd } from '../env.js';
import { AppError } from '../lib/app-error.js';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

export default fp(
  async (app) => {
    app.setErrorHandler((error, req, reply) => {
      const err = error as Error;
      if (err instanceof AppError) {
        return reply.status(err.status).send({
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined ? { details: err.details } : {}),
          },
        });
      }
      if (hasZodFastifySchemaValidationErrors(err)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
          },
        });
      }
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      if (status >= 500) {
        req.log.error(err);
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: isProd ? 'Erro interno do servidor.' : String(err.message),
          },
        });
      }
      return reply.status(status).send({
        error: { code: STATUS_CODES[status] ?? 'ERROR', message: err.message },
      });
    });

    app.setNotFoundHandler((_req, reply) =>
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }),
    );
  },
  { name: 'errors' },
);
