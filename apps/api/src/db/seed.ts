import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { auth } from '../auth.js';
import { env, isProd } from '../env.js';
import { slugify } from '../lib/slug.js';
import { db, schema, sql } from './index.js';
import { essayThemesSeed, institutionsSeed, subjectsSeed } from './seed-data/taxonomy.js';

async function seedInstitutions() {
  for (const inst of institutionsSeed) {
    await db
      .insert(schema.institutions)
      .values(inst)
      .onConflictDoUpdate({
        target: schema.institutions.slug,
        set: { name: inst.name, fullName: inst.fullName, websiteUrl: inst.websiteUrl },
      });
  }
  console.log(`  instituições: ${institutionsSeed.length}`);
}

async function seedSubjectsAndTopics() {
  let topicCount = 0;
  let position = 0;
  for (const s of subjectsSeed) {
    const [subject] = await db
      .insert(schema.subjects)
      .values({ slug: slugify(s.name), name: s.name, area: s.area, position: position++ })
      .onConflictDoUpdate({
        target: schema.subjects.slug,
        set: { name: s.name, area: s.area },
      })
      .returning();
    if (!subject) throw new Error(`Falha ao inserir matéria ${s.name}`);

    let pPos = 0;
    for (const [parentName, children] of Object.entries(s.topics)) {
      const [parent] = await db
        .insert(schema.topics)
        .values({
          subjectId: subject.id,
          parentId: null,
          slug: slugify(parentName),
          name: parentName,
          position: pPos++,
        })
        .onConflictDoUpdate({
          target: [schema.topics.subjectId, schema.topics.slug],
          set: { name: parentName },
        })
        .returning();
      if (!parent) throw new Error(`Falha ao inserir assunto ${parentName}`);
      topicCount++;
      let cPos = 0;
      for (const childName of children) {
        await db
          .insert(schema.topics)
          .values({
            subjectId: subject.id,
            parentId: parent.id,
            slug: `${slugify(parentName)}--${slugify(childName)}`,
            name: childName,
            position: cPos++,
          })
          .onConflictDoUpdate({
            target: [schema.topics.subjectId, schema.topics.slug],
            set: { name: childName, parentId: parent.id },
          });
        topicCount++;
      }
    }
  }
  console.log(`  matérias: ${subjectsSeed.length}, assuntos: ${topicCount}`);
}

async function seedEssayThemes() {
  for (const t of essayThemesSeed) {
    await db
      .insert(schema.essayThemes)
      .values(t)
      .onConflictDoUpdate({
        target: schema.essayThemes.title,
        set: { year: t.year, description: t.description },
      });
  }
  console.log(`  temas de redação: ${essayThemesSeed.length}`);
}

async function seedAdmin() {
  const password = env.ADMIN_PASSWORD ?? (isProd ? undefined : 'freenem-admin');
  if (!password) {
    console.warn('  admin: ADMIN_PASSWORD não definido em produção, ignorando.');
    return;
  }
  const [existing] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, env.ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    await db
      .update(schema.user)
      .set({ role: 'admin', emailVerified: true })
      .where(eq(schema.user.id, existing.id));
    console.log(`  admin: ${env.ADMIN_EMAIL} (já existia)`);
    return;
  }

  // Cria direto no banco (sem disparar e-mail de verificação).
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const userId = randomUUID().replaceAll('-', '');
  await db.transaction(async (tx) => {
    await tx.insert(schema.user).values({
      id: userId,
      name: 'Administrador',
      email: env.ADMIN_EMAIL,
      emailVerified: true,
      role: 'admin',
    });
    await tx.insert(schema.account).values({
      id: randomUUID().replaceAll('-', ''),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hash,
    });
  });
  console.log(`  admin: ${env.ADMIN_EMAIL} criado`);
}

console.log('Executando seed...');
await seedInstitutions();
await seedSubjectsAndTopics();
await seedEssayThemes();
await seedAdmin();
console.log('Seed concluído.');
await sql.end();
