import type { z } from 'zod';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3340').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions<S extends z.ZodType | undefined> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Schema Zod (de @freenem/shared) para validar a resposta. */
  schema?: S;
  signal?: AbortSignal;
}

/**
 * Cliente tipado. Caminhos relativos à API (ex.: '/api/v1/me').
 * Erros da API ({ error: { code, message } }) viram `ApiError`.
 */
export async function api<S extends z.ZodType | undefined = undefined>(
  path: string,
  opts: RequestOptions<S> = {},
): Promise<S extends z.ZodType ? z.infer<S> : unknown> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      credentials: 'include',
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor.');
  }
  const text = await res.text();
  const json: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Erro inesperado.',
      e?.details,
    );
  }
  return (opts.schema ? opts.schema.parse(json) : json) as never;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
