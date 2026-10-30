import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** `INGEST_CACHE_DIR` permite compartilhar o cache (PDFs, relatórios) entre worktrees. */
export const CACHE_DIR = process.env.INGEST_CACHE_DIR
  ? path.resolve(process.env.INGEST_CACHE_DIR)
  : path.resolve(here, '../.cache');
