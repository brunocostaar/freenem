import { sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';

export async function checkDb(db: Db): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
