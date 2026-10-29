import { mkdir, writeFile, access } from 'node:fs/promises';
import type { S3Client } from '@aws-sdk/client-s3';
import path from 'node:path';

/**
 * Armazenamento de arquivos (imagens de questões). Sem dependência de `env`,
 * para poder ser usado também pelo pacote de ingestão.
 *
 * No banco guardamos referências `storage://<chave>`; `resolveStorageUrls` as converte
 * em URLs públicas na saída da API.
 */
export const STORAGE_SCHEME = 'storage://';

export interface StorageConfig {
  driver: 'local' | 'r2';
  /** diretório raiz do driver local */
  localDir: string;
  /** URL pública base do driver local, ex.: http://localhost:3340/files */
  localPublicUrl: string;
  r2?: {
    accountId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
    publicUrl?: string;
  };
}

export interface Storage {
  /** URL pública base (sem barra final) onde as chaves ficam disponíveis. */
  readonly publicBaseUrl: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** URL pública de uma chave. */
  url(key: string): string;
  /** Referência interna guardada no banco. */
  ref(key: string): string;
}

function safeKey(key: string): string {
  const clean = path.posix.normalize(key).replace(/^\/+/, '');
  if (clean.startsWith('..') || clean.includes('/../')) throw new Error(`Chave inválida: ${key}`);
  return clean;
}

function createLocal(cfg: StorageConfig): Storage {
  const root = path.resolve(cfg.localDir);
  const base = cfg.localPublicUrl.replace(/\/$/, '');
  return {
    publicBaseUrl: base,
    async put(key, body) {
      const file = path.join(root, safeKey(key));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async exists(key) {
      try {
        await access(path.join(root, safeKey(key)));
        return true;
      } catch {
        return false;
      }
    },
    url: (key) => `${base}/${safeKey(key)}`,
    ref: (key) => `${STORAGE_SCHEME}${safeKey(key)}`,
  };
}

function createR2(cfg: StorageConfig): Storage {
  const r2 = cfg.r2 ?? {};
  const { accountId, accessKeyId, secretAccessKey, bucket, publicUrl } = r2;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error(
      'STORAGE_DRIVER=r2 exige R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL.',
    );
  }
  const base = publicUrl.replace(/\/$/, '');
  // O SDK é carregado sob demanda: o driver local não precisa dele.
  let clientPromise: Promise<S3Client> | null = null;
  const client = () =>
    (clientPromise ??= import('@aws-sdk/client-s3').then(
      (m) =>
        new m.S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        }),
    ));
  return {
    publicBaseUrl: base,
    async put(key, body, contentType) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await (
        await client()
      ).send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: safeKey(key),
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    },
    async exists(key) {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      try {
        await (await client()).send(new HeadObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
        return true;
      } catch {
        return false;
      }
    },
    url: (key) => `${base}/${safeKey(key)}`,
    ref: (key) => `${STORAGE_SCHEME}${safeKey(key)}`,
  };
}

export function createStorage(cfg: StorageConfig): Storage {
  return cfg.driver === 'r2' ? createR2(cfg) : createLocal(cfg);
}

/** Troca `storage://chave` por URLs públicas dentro de um texto (Markdown) ou URL. */
export function resolveStorageUrls(text: string, publicBaseUrl: string): string {
  return text.replaceAll(STORAGE_SCHEME, `${publicBaseUrl.replace(/\/$/, '')}/`);
}

export function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
  };
  return map[ext] ?? 'application/octet-stream';
}
