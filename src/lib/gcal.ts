import 'server-only';
import { JWT } from 'google-auth-library';
import { TZ } from './time';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
const SA_KEY = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');

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
