import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from './db/index.js';
import { env, features } from './env.js';
import { createAppleClientSecret } from './lib/apple-secret.js';
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
  // a Apple devolve o login com um POST (form_post) vindo de appleid.apple.com
  trustedOrigins: [env.WEB_ORIGIN, ...(features.appleLogin ? ['https://appleid.apple.com'] : [])],
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
  socialProviders: {
    ...(features.googleLogin
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
            prompt: 'select_account' as const,
          },
        }
      : {}),
    ...(features.appleLogin
      ? {
          apple: {
            clientId: env.APPLE_CLIENT_ID as string,
            clientSecret: createAppleClientSecret({
              teamId: env.APPLE_TEAM_ID as string,
              keyId: env.APPLE_KEY_ID as string,
              clientId: env.APPLE_CLIENT_ID as string,
              privateKey: env.APPLE_PRIVATE_KEY as string,
            }),
            ...(env.APPLE_APP_BUNDLE_ID ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_ID } : {}),
          },
        }
      : {}),
  },
  account: {
    // quem já tem conta com e-mail e senha entra com Google/Apple no mesmo e-mail sem duplicar o usuário
    accountLinking: { enabled: true, trustedProviders: ['google', 'apple'] },
  },
});

export type Auth = typeof auth;
