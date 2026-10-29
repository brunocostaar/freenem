/**
 * Erro de domínio com status HTTP e código estável. O handler global (plugins/errors.ts)
 * responde `{ error: { code, message, details? } }`.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
