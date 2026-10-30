import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { answerResponseSchema, answerSubmitSchema } from '@freenem/shared';
import {
  buildAnswerResponse,
  getQuestionKey,
  questionInActiveAttempt,
  recordAnswer,
} from './service.js';
import { isReviewer } from '../questions/optional-auth.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/answers',
    {
      preHandler: app.authenticate,
      schema: { body: answerSubmitSchema, response: { 200: answerResponseSchema } },
    },
    async (req) => {
      const { questionId, letter, timeSpentMs, simuladoAttemptId } = req.body;
      const user = req.sessionUser!;
      const key = await getQuestionKey(questionId);
      if (!key || (key.status !== 'published' && !isReviewer(user))) {
        throw app.httpErrors.notFound('Questão não encontrada.');
      }
      // Anti-cola: respostas de simulado em andamento vão por saveAnswers; aqui não revelamos.
      if (await questionInActiveAttempt(user.id, questionId)) {
        throw app.httpErrors.conflict('Finalize o simulado para ver o gabarito desta questão.');
      }
      const correct = letter === key.correctLetter;
      await recordAnswer(user.id, questionId, letter, correct, { timeSpentMs, simuladoAttemptId });
      // as estatísticas já incluem a resposta recém-registrada
      return buildAnswerResponse(key, questionId, letter);
    },
  );
};

export default routes;
