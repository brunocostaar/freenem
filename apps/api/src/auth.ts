import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from './db/index.js';
import { env, features } from './env.js';
import { sendEmail } from './lib/email.js';

/** Escapa o nome do usuário antes de interpolá-lo no HTML do e-mail. */
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'student', input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Sem provedor de e-mail configurado (dev), não bloqueamos o login.
    requireEmailVerification: features.emailVerification,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Redefinir sua senha - freenem',
        html: `<p>Olá, ${escapeHtml(user.name)}.</p><p><a href="${url}">Clique aqui para redefinir sua senha</a>.</p>`,
        text: `Redefina sua senha: ${url}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Confirme seu e-mail - freenem',
        html: `<p>Olá, ${escapeHtml(user.name)}! Bem-vindo(a) ao freenem.</p><p><a href="${url}">Confirmar meu e-mail</a></p>`,
        text: `Confirme seu e-mail: ${url}`,
      });
    },
  },
  ...(features.googleLogin
    ? {
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        },
      }
    : {}),
});

export type Auth = typeof auth;
