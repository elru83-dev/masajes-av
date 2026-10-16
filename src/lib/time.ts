// Fechas siempre en la zona horaria del consultorio.
// Los días se manejan como texto ISO 'YYYY-MM-DD' para evitar corrimientos de zona.
export const TZ = 'America/Argentina/Buenos_Aires';

const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const longDayFmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });
const rangeFmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short' });

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDay = (v: unknown): v is string => typeof v === 'string' && DAY_RE.test(v);

/** Día ISO de un instante, en la zona del consultorio. */
export const dayOf = (instant: Date | string): string => isoDayFmt.format(new Date(instant));

export const today = (): string => dayOf(new Date());

const toUtc = (day: string): Date => new Date(`${day}T00:00:00Z`);

export function addDays(day: string, n: number): string {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana que contiene `day`. */
export function weekStart(day: string): string {
  const dow = toUtc(day).getUTCDay(); // 0 = domingo
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

export const weekDays = (monday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const fmtTime = (instant: Date | string): string => timeFmt.format(new Date(instant));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtLongDay = (day: string): string => cap(longDayFmt.format(toUtc(day)));
export const fmtShortDay = (day: string): string => cap(shortDayFmt.format(toUtc(day)).replace('.', ''));
export const fmtWeekRange = (monday: string): string =>
  `${rangeFmt.format(toUtc(monday))} al ${rangeFmt.format(toUtc(addDays(monday, 6)))}`;

/** 'YYYY-MM-DD' + 'HH:MM' en hora local del consultorio → ISO con offset (Argentina no usa horario de verano). */
export const localToIso = (day: string, hhmm: string): string => `${day}T${hhmm}:00-03:00`;

export const minutesBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
