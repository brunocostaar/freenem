import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import tls from 'node:tls';
import { inflateRawSync } from 'node:zlib';
import { CACHE_DIR } from './db.js';

/**
 * Leitor mínimo de ZIP remoto via HTTP Range: baixa só o diretório central e os bytes do
 * arquivo desejado (os microdados do INEP têm centenas de MB, mas o CSV de itens é pequeno).
 */

/**
 * O servidor do INEP não envia o certificado intermediário (RNP/GlobalSign), então o
 * Node falha a validação. Em vez de desligar a verificação TLS, buscamos o intermediário
 * pelo campo AIA do certificado (como os navegadores fazem) e o adicionamos às CAs confiáveis.
 */
const INTERMEDIATE_URL = 'http://secure.globalsign.com/cacert/rnpicpedugr46ovtlsca2025.crt';

let caCache: string[] | null = null;
async function trustedCas(): Promise<string[]> {
  if (caCache) return caCache;
  const extraFile = process.env.INEP_CA_FILE;
  const certFile = path.join(CACHE_DIR, 'inep-intermediate.pem');
  let extra: string | null = null;
  if (extraFile && existsSync(extraFile)) extra = await readFile(extraFile, 'utf8');
  else if (existsSync(certFile)) extra = await readFile(certFile, 'utf8');
  else {
    const der = await new Promise<Buffer>((resolve, reject) => {
      http
        .get(INTERMEDIATE_URL, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', reject);
    });
    const b64 = der.toString('base64').replace(/(.{64})/g, '$1\n');
    extra = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(certFile, extra);
  }
  caCache = [...tls.rootCertificates, extra];
  return caCache;
}

async function rangeRequest(url: string, range: string): Promise<{ body: Buffer; total: number }> {
  // O servidor do INEP derruba conexões de vez em quando: tenta de novo.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await rangeRequestOnce(url, range);
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError;
}

async function rangeRequestOnce(
  url: string,
  range: string,
): Promise<{ body: Buffer; total: number }> {
  const ca = await trustedCas();
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { range },
        ca,
        maxVersion: 'TLSv1.2',
      },
      (res) => {
        if (res.statusCode !== 206 && res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} em ${url} (range ${range})`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const cr = String(res.headers['content-range'] ?? '');
          const total = Number(cr.split('/')[1] ?? res.headers['content-length'] ?? 0);
          resolve({ body: Buffer.concat(chunks), total });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(120_000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

export async function listRemoteZip(url: string): Promise<ZipEntry[]> {
  const tail = await rangeRequest(url, 'bytes=-131072');
  const buf = tail.body;
  const total = tail.total;
  const tailStart = total - buf.length;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('EOCD do ZIP não encontrado');
  let cdSize = buf.readUInt32LE(eocd + 12);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    // ZIP64: o localizador fica logo antes do EOCD
    const loc = eocd - 20;
    if (buf.readUInt32LE(loc) !== 0x07064b50) throw new Error('localizador ZIP64 ausente');
    const z64Offset = Number(buf.readBigUInt64LE(loc + 8));
    const rec = z64Offset - tailStart;
    let z64: Buffer;
    if (rec >= 0) z64 = buf.subarray(rec, rec + 56);
    else z64 = (await rangeRequest(url, `bytes=${z64Offset}-${z64Offset + 55}`)).body;
    cdSize = Number(z64.readBigUInt64LE(40));
    cdOffset = Number(z64.readBigUInt64LE(48));
  }
  const cd =
    cdOffset >= tailStart
      ? buf.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize)
      : (await rangeRequest(url, `bytes=${cdOffset}-${cdOffset + cdSize - 1}`)).body;

  const entries: ZipEntry[] = [];
  let p = 0;
  while (p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const method = cd.readUInt16LE(p + 10);
    let compressedSize = cd.readUInt32LE(p + 20);
    let size = cd.readUInt32LE(p + 24);
    const nameLen = cd.readUInt16LE(p + 28);
    const extraLen = cd.readUInt16LE(p + 30);
    const commentLen = cd.readUInt16LE(p + 32);
    let localOffset = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nameLen);
    // campos ZIP64 no extra
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = cd.readUInt16LE(e);
      const len = cd.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = Number(cd.readBigUInt64LE(q));
          q += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = Number(cd.readBigUInt64LE(q));
          q += 8;
        }
        if (localOffset === 0xffffffff) localOffset = Number(cd.readBigUInt64LE(q));
      }
      e += 4 + len;
    }
    entries.push({ name, method, compressedSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export async function readRemoteEntry(url: string, entry: ZipEntry): Promise<Buffer> {
  const header = (await rangeRequest(url, `bytes=${entry.localOffset}-${entry.localOffset + 29}`))
    .body;
  if (header.readUInt32LE(0) !== 0x04034b50) throw new Error('cabeçalho local inválido');
  const nameLen = header.readUInt16LE(26);
  const extraLen = header.readUInt16LE(28);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  const data = (await rangeRequest(url, `bytes=${start}-${start + entry.compressedSize - 1}`)).body;
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`método de compressão ${entry.method} não suportado`);
}
