import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { APPLE_SECRET_MAX_AGE, createAppleClientSecret } from './apple-secret.js';

describe('createAppleClientSecret', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const now = new Date('2026-11-12T00:00:00Z');

  const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());

  it('gera um JWT ES256 com os campos que a Apple exige e assinatura válida', () => {
    const jwt = createAppleClientSecret({
      teamId: 'TEAM123456',
      keyId: 'KEY1234567',
      clientId: 'br.com.freenem.web',
      privateKey: pem,
      now,
    });
    const [h, p, s] = jwt.split('.') as [string, string, string];
    expect(decode(h)).toEqual({ alg: 'ES256', kid: 'KEY1234567', typ: 'JWT' });
    const payload = decode(p);
    expect(payload).toMatchObject({
      iss: 'TEAM123456',
      sub: 'br.com.freenem.web',
      aud: 'https://appleid.apple.com',
    });
    expect(payload.exp - payload.iat).toBe(APPLE_SECRET_MAX_AGE);
    const ok = verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(s, 'base64url'),
    );
    expect(ok).toBe(true);
  });

  it('aceita a chave com quebras de linha escapadas e limita a validade a 6 meses', () => {
    const jwt = createAppleClientSecret({
      teamId: 'T',
      keyId: 'K',
      clientId: 'C',
      privateKey: pem.replace(/\n/g, '\\n'),
      expiresInSeconds: 10 * APPLE_SECRET_MAX_AGE,
      now,
    });
    const payload = decode(jwt.split('.')[1] as string);
    expect(payload.exp - payload.iat).toBe(APPLE_SECRET_MAX_AGE);
  });
});
