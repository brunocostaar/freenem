import { Resend } from 'resend';
import { env } from '../env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** Envia e-mail via Resend; sem chave configurada, apenas loga no console (dev). */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (!resend) {
    console.log(
      `\n[email:dev] para=${msg.to}\n[email:dev] assunto=${msg.subject}\n[email:dev] ${msg.text ?? msg.html}\n`,
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
  if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`);
}
