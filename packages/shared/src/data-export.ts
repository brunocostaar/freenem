import { z } from 'zod';

const iso = z.string();
const nullableIso = z.string().nullable();

/**
 * Exportação dos dados do próprio usuário (LGPD, portabilidade). Datas em ISO 8601.
 * Nunca inclui hash de senha, tokens, sessões nem segredos de contas vinculadas.
 */
export const dataExportSchema = z.object({
  exportedAt: iso,
  profile: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    role: z.string(),
    createdAt: iso,
    updatedAt: iso,
    /** provedores de login vinculados (ex.: "credential", "google"), sem segredos */
    loginProviders: z.array(z.string()),
  }),
  answers: z.array(
    z.object({
      id: z.string(),
      questionId: z.string(),
      chosenLetter: z.string().nullable(),
      isCorrect: z.boolean(),
      timeSpentMs: z.number().nullable(),
      simuladoAttemptId: z.string().nullable(),
      answeredAt: iso,
    }),
  ),
  savedQuestions: z.array(z.object({ questionId: z.string(), createdAt: iso })),
  simulados: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      mode: z.string(),
      questionCount: z.number(),
      timeLimitMinutes: z.number().nullable(),
      createdAt: iso,
    }),
  ),
  simuladoAttempts: z.array(
    z.object({
      id: z.string(),
      simuladoId: z.string(),
      status: z.string(),
      startedAt: iso,
      finishedAt: nullableIso,
      rawScore: z.number().nullable(),
      triScore: z.number().nullable(),
    }),
  ),
  essays: z.array(
    z.object({
      id: z.string(),
      themeId: z.string(),
      themeTitle: z.string(),
      text: z.string(),
      status: z.string(),
      createdAt: iso,
      correction: z
        .object({
          totalScore: z.number().nullable(),
          c1: z.number().nullable(),
          c2: z.number().nullable(),
          c3: z.number().nullable(),
          c4: z.number().nullable(),
          c5: z.number().nullable(),
          feedback: z.unknown(),
          model: z.string().nullable(),
          createdAt: iso,
        })
        .nullable(),
    }),
  ),
  studyPlans: z.array(
    z.object({
      id: z.string(),
      examDate: z.string(),
      hoursPerWeek: z.number(),
      availableDays: z.array(z.number()),
      active: z.boolean(),
      createdAt: iso,
      items: z.array(
        z.object({
          id: z.string(),
          topicId: z.string(),
          week: z.number(),
          kind: z.string(),
          done: z.boolean(),
          doneAt: nullableIso,
          notes: z.string().nullable(),
        }),
      ),
    }),
  ),
  resolutions: z.array(
    z.object({
      id: z.string(),
      questionId: z.string(),
      body: z.string(),
      status: z.string(),
      rejectReason: z.string().nullable(),
      score: z.number(),
      createdAt: iso,
      updatedAt: iso,
    }),
  ),
  resolutionVotes: z.array(
    z.object({ resolutionId: z.string(), value: z.number(), createdAt: iso }),
  ),
  reports: z.array(
    z.object({
      id: z.string(),
      questionId: z.string(),
      kind: z.string(),
      message: z.string(),
      status: z.string(),
      createdAt: iso,
    }),
  ),
});
export type DataExport = z.infer<typeof dataExportSchema>;
