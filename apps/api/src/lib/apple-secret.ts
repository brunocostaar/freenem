import { createPrivateKey, sign } from 'node:crypto';

export interface AppleSecretOptions {
  /** Team ID da conta Apple Developer (10 caracteres) */
  teamId: string;
  /** Key ID da chave "Sign in with Apple" (.p8) */
  keyId: string;
  /** Services ID usado no login web (é o client_id) */
  clientId: string;
  /** conteúdo PEM do arquivo .p8 (aceita "\n" escapado, comum em variáveis de ambiente) */
  privateKey: string;
  /** validade em segundos; a Apple aceita no máximo 6 meses */
  expiresInSeconds?: number;
  /** relógio injetável (testes) */
  now?: Date;
}

/** A Apple aceita client_secret com validade de até 6 meses (15777000 s). */
export const APPLE_SECRET_MAX_AGE = 15_777_000;

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

/**
 * Gera o client_secret do "Sign in with Apple": um JWT ES256 assinado com a chave .p8.
 * É gerado a cada inicialização da API, então não precisa ser renovado à mão a cada 6 meses.
 */
export function createAppleClientSecret(opts: AppleSecretOptions): string {
  const iat = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const exp = iat + Math.min(opts.expiresInSeconds ?? APPLE_SECRET_MAX_AGE, APPLE_SECRET_MAX_AGE);
  const header = { alg: 'ES256', kid: opts.keyId, typ: 'JWT' };
  const payload = {
    iss: opts.teamId,
    iat,
    exp,
    aud: 'https://appleid.apple.com',
    sub: opts.clientId,
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(opts.privateKey.replace(/\\n/g, '\n'));
  const signature = sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${b64url(signature)}`;
}
