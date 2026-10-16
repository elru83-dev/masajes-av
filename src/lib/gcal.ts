import 'server-only';
import { JWT } from 'google-auth-library';
import { TZ } from './time';

/** Limpia lo que suele colarse al pegar en Vercel: espacios, comillas de más y `\n` escritos como texto. */
const clean = (v?: string) => v?.trim().replace(/^["']|["'],?$/g, '').trim() || undefined;

/**
 * Credenciales: lo más simple es pegar el archivo JSON completo en GOOGLE_SA_JSON.
 * Si no está, se usan GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY por separado.
 */
function readCredentials(): { email?: string; key?: string; error?: string } {
  const raw = process.env.GOOGLE_SA_JSON?.trim();
  if (raw) {
    try {
      const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
      return { email: j.client_email?.trim(), key: j.private_key };
    } catch {
      return { error: 'GOOGLE_SA_JSON no es un JSON válido: pegá el contenido completo del archivo, desde { hasta }' };
    }
  }
  return { email: clean(process.env.GOOGLE_SA_EMAIL), key: clean(process.env.GOOGLE_SA_PRIVATE_KEY)?.replace(/\\n/g, '\n') };
}

const CALENDAR_ID = clean(process.env.GOOGLE_CALENDAR_ID);
const CREDS = readCredentials();
const SA_EMAIL = CREDS.email;
const SA_KEY = CREDS.key;

let client: JWT | null = null;

const enabled = () => Boolean(CALENDAR_ID && SA_EMAIL && SA_KEY);

function jwt(): JWT {
  client ??= new JWT({ email: SA_EMAIL, key: SA_KEY, scopes: ['https://www.googleapis.com/auth/calendar.events'] });
  return client;
}

const base = () => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID!)}/events`;

export type CalendarEvent = { summary: string; description: string; start: string; end: string };

/** Crea el evento y devuelve su id (null si Google Calendar no está configurado). */
export async function gcalInsert(ev: CalendarEvent): Promise<string | null> {
  if (!enabled()) return null;
  const res = await jwt().request<{ id: string }>({
    url: base(),
    method: 'POST',
    data: {
      summary: ev.summary,
      description: ev.description,
      start: { dateTime: ev.start, timeZone: TZ },
      end: { dateTime: ev.end, timeZone: TZ },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
    },
  });
  return res.data.id;
}

export async function gcalDelete(eventId: string | null): Promise<void> {
  if (!enabled() || !eventId) return;
  try {
    await jwt().request({ url: `${base()}/${encodeURIComponent(eventId)}`, method: 'DELETE' });
  } catch (e) {
    // 404/410: ya no existe en el calendario; no es un error para la agenda.
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status !== 404 && status !== 410) throw e;
  }
}

/** Prueba la conexión: credenciales válidas y calendario compartido con la cuenta de servicio. */
export async function gcalCheck(): Promise<{ ok: boolean; detail: string }> {
  if (CREDS.error) return { ok: false, detail: CREDS.error };
  if (!enabled()) return { ok: false, detail: 'Faltan GOOGLE_CALENDAR_ID y GOOGLE_SA_JSON (o GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY)' };
  try {
    await jwt().request({ url: `${base()}?maxResults=1&timeMin=${encodeURIComponent(new Date().toISOString())}` });
    return { ok: true, detail: `Conectado a ${CALENDAR_ID}` };
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    const data = (e as { response?: { data?: { error?: string; error_description?: string } } }).response?.data;
    const msg = [(e as Error).message, data?.error, data?.error_description].filter(Boolean).join(' · ');
    if (/DECODER|PEM|private key|asn1/i.test(msg)) return { ok: false, detail: 'La clave privada (GOOGLE_SA_PRIVATE_KEY) está mal pegada' };
    if (/invalid_grant|invalid_client|unauthorized_client/i.test(msg)) {
      return {
        ok: false,
        detail:
          `Google rechazó las credenciales de ${SA_EMAIL ?? '(sin email)'}: ${data?.error_description ?? msg}. ` +
          'Suele pasar si el email y la clave salieron de archivos JSON distintos, si la clave se borró en Google Cloud o si quedó cortada al pegarla. Solución: pegá el JSON completo en GOOGLE_SA_JSON.',
      };
    }
    if (status === 404) return { ok: false, detail: `El calendario ${CALENDAR_ID} no está compartido con ${SA_EMAIL}` };
    if (status === 403) return { ok: false, detail: 'Google Calendar API no está habilitada en el proyecto de Google Cloud, o falta el permiso "Hacer cambios en los eventos"' };
    return { ok: false, detail: msg.slice(0, 200) };
  }
}
