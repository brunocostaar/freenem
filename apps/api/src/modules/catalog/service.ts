import { asc, desc, eq } from 'drizzle-orm';
import type { CatalogResponse } from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { getStorage } from '../../lib/storage.js';

export async function getCatalog(): Promise<CatalogResponse> {
  const [institutions, subjects, topics, yearRows] = await Promise.all([
    db
      .select({
        id: schema.institutions.id,
        slug: schema.institutions.slug,
        name: schema.institutions.name,
      })
      .from(schema.institutions)
      .orderBy(asc(schema.institutions.name)),
    db.select().from(schema.subjects).orderBy(asc(schema.subjects.position)),
    db.select().from(schema.topics).orderBy(asc(schema.topics.position), asc(schema.topics.name)),
    db
      .selectDistinct({ institutionId: schema.exams.institutionId, year: schema.exams.year })
      .from(schema.exams)
      .innerJoin(schema.questions, eq(schema.questions.examId, schema.exams.id))
      .where(eq(schema.questions.status, 'published'))
      .orderBy(desc(schema.exams.year)),
  ]);

  type TopicRow = (typeof topics)[number];
  const childrenOf = new Map<string, TopicRow[]>();
  for (const t of topics) {
    if (t.parentId) childrenOf.set(t.parentId, [...(childrenOf.get(t.parentId) ?? []), t]);
  }
  const toTopic = (t: TopicRow) => ({
    id: t.id,
    subjectId: t.subjectId,
    parentId: t.parentId,
    slug: t.slug,
    name: t.name,
  });

  const institutionYears: Record<string, number[]> = {};
  for (const r of yearRows) (institutionYears[r.institutionId] ??= []).push(r.year);
  const years = [...new Set(yearRows.map((r) => r.year))].sort((a, b) => b - a);

  return {
    institutions,
    subjects: subjects.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      area: s.area,
      topics: topics
        .filter((t) => t.subjectId === s.id && !t.parentId)
        .map((t) => ({ ...toTopic(t), children: (childrenOf.get(t.id) ?? []).map(toTopic) })),
    })),
    years,
    institutionYears,
    storageBaseUrl: getStorage().publicBaseUrl,
  };
}
