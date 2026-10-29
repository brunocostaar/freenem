import { sql as dsql } from 'drizzle-orm';
import { db } from './db.js';

/** Contagens do banco: por ano, status, matéria e cobertura de parâmetros TRI. */
export async function report(): Promise<void> {
  const byYear = await db.execute(dsql`
    select e.year, count(*)::int as total,
      count(*) filter (where q.status = 'published')::int as published,
      count(*) filter (where q.status = 'draft')::int as draft,
      count(q.irt_b)::int as with_irt
    from questions q join exams e on e.id = q.exam_id
    join institutions i on i.id = e.institution_id and i.slug = 'enem'
    group by e.year order by e.year`);
  console.log('\nPor ano (ENEM):');
  console.table(byYear);

  const byStatus = await db.execute(dsql`
    select q.status, count(*)::int as total from questions q group by q.status order by 1`);
  console.log('Por status:');
  console.table(byStatus);

  const bySubject = await db.execute(dsql`
    select coalesce(s.name, '(sem matéria)') as subject, count(*)::int as total,
      count(*) filter (where q.status = 'published')::int as published,
      count(*) filter (where q.status = 'draft')::int as draft
    from questions q left join subjects s on s.id = q.subject_id
    group by 1 order by 2 desc`);
  console.log('Por matéria:');
  console.table(bySubject);

  const [irt] = await db.execute(dsql`
    select count(*)::int as total, count(irt_b)::int as with_irt from questions q
    join exams e on e.id = q.exam_id join institutions i on i.id = e.institution_id and i.slug = 'enem'`);
  console.log('Cobertura TRI (ENEM):', irt);
}
