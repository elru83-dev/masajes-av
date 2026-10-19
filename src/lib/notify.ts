import 'server-only';
import nodemailer from 'nodemailer';
import { TZ } from './time';
import { toWaPhone } from './whatsapp';

/**
 * Aviso por mail cuando entra un pedido de turno desde la web (Gmail SMTP, gratis).
 * Sin GMAIL_USER + GMAIL_APP_PASSWORD no hace nada y la agenda funciona igual.
 */

export type NewBooking = {
  service: string;
  startsAt: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
};

const clean = (v?: string) => v?.trim() || undefined;
const USER = clean(process.env.GMAIL_USER);
const PASS = clean(process.env.GMAIL_APP_PASSWORD)?.replace(/\s/g, ''); // Google la muestra con espacios
const TO = clean(process.env.NOTIFY_EMAIL_TO) ?? USER;
const SITE = (clean(process.env.NEXT_PUBLIC_SITE_URL) ?? '').replace(/\/$/, '');

// Un solo transporter por instancia: se reutiliza entre invocaciones.
const mailer = USER && PASS
  ? nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: USER, pass: PASS } })
  : null;

const fmt = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

const row = (label: string, value: string, bold = false) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${label}</td>` +
  `<td style="padding:6px 0;white-space:pre-wrap">${bold ? `<b>${esc(value)}</b>` : esc(value)}</td></tr>`;

const button = (href: string, text: string, bg: string) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;background:${bg};color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${text}</a>`;

/** Nunca lanza: si el mail falla, la reserva ya quedó guardada igual. */
export async function notifyNewBooking(b: NewBooking): Promise<void> {
  if (!mailer) return;

  const when = fmt.format(new Date(b.startsAt));
  const wa = `https://wa.me/${toWaPhone(b.phone)}`;
  const panel = SITE ? `${SITE}/admin` : '';

  try {
    await mailer.sendMail({
      from: `"Turnos Masajes AV" <${USER}>`,
      to: TO,
      replyTo: b.email || undefined, // "Responder" en Gmail le escribe al cliente
      subject: `Nuevo turno por confirmar · ${b.service} · ${when}`,
      text: [
        'Pedido nuevo de turno', '',
        `Servicio: ${b.service}`,
        `Día y hora: ${when}`,
        `Cliente: ${b.name}`,
        `WhatsApp: ${wa}`,
        b.email && `Email: ${b.email}`,
        b.notes && `Notas: ${b.notes}`,
        panel && `\nConfirmalo en ${panel}`,
      ].filter(Boolean).join('\n'),
      html: `
<div style="font-family:system-ui,-apple-system,Arial,sans-serif;max-width:480px;margin:auto;color:#222;font-size:15px">
  <h2 style="margin:0 0 12px;font-size:20px">Nuevo turno por confirmar</h2>
  <table style="border-collapse:collapse;width:100%">
    ${row('Servicio', b.service, true)}
    ${row('Día y hora', when, true)}
    ${row('Cliente', b.name)}
    ${row('WhatsApp', `+${toWaPhone(b.phone)}`)}
    ${b.email ? row('Email', b.email) : ''}
    ${b.notes ? row('Notas', b.notes) : ''}
  </table>
  <p style="margin:20px 0 0">
    ${panel ? button(panel, 'Abrir panel', '#222') : ''}${button(wa, 'Escribirle por WhatsApp', '#25D366')}
  </p>
</div>`,
    });
  } catch (err) {
    console.error('[notify] no se pudo enviar el aviso por mail:', err);
  }
}

/** Para /admin/estado: prueba el login SMTP sin mandar ningún mail. */
export async function mailCheck(): Promise<{ ok: boolean; detail: string }> {
  if (!mailer) return { ok: false, detail: 'Faltan GMAIL_USER y GMAIL_APP_PASSWORD: los pedidos nuevos no avisan por mail' };
  try {
    await mailer.verify();
    return { ok: true, detail: `Los pedidos nuevos avisan a ${TO}` };
  } catch (e) {
    const msg = (e as Error).message;
    if (/535|Username and Password not accepted|BadCredentials/i.test(msg)) {
      return { ok: false, detail: 'Gmail rechazó la contraseña. Tiene que ser una contraseña de aplicación (16 letras), no la clave normal de la cuenta' };
    }
    return { ok: false, detail: msg.slice(0, 200) };
  }
}
