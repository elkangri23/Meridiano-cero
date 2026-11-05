// Envío de correo para verificación y recuperación (Fase B).
//
// La API solo envía correo si el entorno trae RESEND_API_KEY y MAIL_FROM.
// Sin ellas no se inventa ningún remitente ni se registran secretos: la
// cuenta se crea igual, la verificación queda pendiente y se registra
// EMAIL_NOT_CONFIGURED (sin el token y sin la dirección). Cuando Antonio
// configure esas dos variables en el .env del VPS, el flujo completo
// funciona sin tocar código. No se reutiliza la clave de Resend de retaton:
// pertenece a otro proyecto.

export interface Mailer {
  sendMail(to: string, subject: string, text: string): Promise<void>;
}

export function createMailer(env: NodeJS.ProcessEnv): Mailer | null {
  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM;
  if (!apiKey || !from) return null;
  return {
    async sendMail(to: string, subject: string, text: string): Promise<void> {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('MAIL_SEND_FAILED');
    },
  };
}
