import { env } from '../env.js';
import { createStorage, resolveStorageUrls, type Storage } from './storage-core.js';

export * from './storage-core.js';

let instance: Storage | null = null;

/** Storage configurado pelo ambiente (STORAGE_DRIVER=local|r2). */
export function getStorage(): Storage {
  instance ??= createStorage({
    driver: env.STORAGE_DRIVER,
    localDir: env.STORAGE_DIR,
    localPublicUrl: `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/files`,
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      publicUrl: env.R2_PUBLIC_URL,
    },
  });
  return instance;
}

/** Converte referências `storage://` em URLs públicas do storage configurado. */
export function publicUrls(text: string): string {
  return resolveStorageUrls(text, getStorage().publicBaseUrl);
}
