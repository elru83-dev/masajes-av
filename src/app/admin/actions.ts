'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { gcalDelete, gcalInsert } from '@/lib/gcal';
import { supabaseSession } from '@/lib/supabase/server';
import { isIsoDay, localToIso } from '@/lib/time';

const TIME_RE = /^\d{2}:\d{2}$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Vuelve a la pantalla de origen (solo rutas del panel) con un mensaje. */
function back(f: FormData, msg?: { error?: string; ok?: string }): never {
  const raw = str(f, 'back');
  const url = new URL(raw.startsWith('/admin') ? raw : '/admin', 'http://x');
  url.searchParams.delete('error');
  url.searchParams.delete('ok');
  if (msg?.error) url.searchParams.set('error', msg.error);
  if (msg?.ok) url.searchParams.set('ok', msg.ok);
  revalidatePath('/admin', 'layout');
  redirect(url.pathname + url.search);
}

// ---------------------------------------------------------------- Sesión
export async function signIn(_prev: string | null, f: FormData): Promise<string | null> {
  const supabase = await supabaseSession();
  const { error } = await supabase.auth.signInWithPassword({ email: str(f, 'email'), password: String(f.get('password') ?? '') });
  if (error) return 'Email o contraseña incorrectos.';
  redirect('/admin');
}

export async function signOut() {
  const supabase = await supabaseSession();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// ---------------------------------------------------------------- Horarios
/** Interpreta horarios escritos como los manda por WhatsApp: "9, 12, 13:30, 15 h", "19.30". */
function parseTimes(raw: string): string[] | null {
  const out = new Set<string>();
  for (const m of raw.matchAll(/(\d{1,2})(?:\s*[:.]\s*(\d{2}))?/g)) {
    const h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    if (h > 23 || min > 59) return null;
    out.add(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return [...out].sort();
}

export async function setDaySlots(f: FormData) {
  const day = str(f, 'day');
  const times = parseTimes(str(f, 'times'));
  if (!isIsoDay(day)) back(f, { error: 'Día inválido' });
  if (!times) back(f, { error: 'Revisá los horarios (ej.: 9, 12, 13:30, 15)' });

  const supabase = await supabaseSession();
  const { error } = await supabase.rpc('set_day_slots', { p_day: day, p_times: times });
  if (error) {
    const close = /slots_too_close:(\S+)-(\S+)/.exec(error.message);
    back(f, {
      error: close
        ? `${close[1]} y ${close[2]} están muy juntos: tiene que entrar el masaje y la pausa entre turnos`
        : 'No se pudieron guardar los horarios',
    });
  }
  back(f, { ok: times.length ? 'Horarios publicados' : 'Día sin horarios' });
}

export async function copyWeek(f: FormData) {
  const from = str(f, 'from');
  const to = str(f, 'to');
  if (!isIsoDay(from) || !isIsoDay(to)) back(f, { error: 'Semana inválida' });
  const supabase = await supabaseSession();
  const { data, error } = await supabase.rpc('copy_week_slots', { p_src_monday: from, p_dst_monday: to });
  if (error) {
    const close = /slots_too_close:(\S+)-(\S+)/.exec(error.message);
    back(f, { error: close ? `No se pudo copiar: ${close[1]} y ${close[2]} quedarían muy juntos` : 'No se pudo copiar la semana' });
  }
  back(f, { ok: data ? `Se copiaron los horarios (${data} en total)` : 'La semana anterior no tenía horarios' });
}

// ---------------------------------------------------------------- Turnos
type BookingForCal = {
  id: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  client_phone: string;
  notes: string;
  services: { name: string } | null;
};

const SELECT_CAL = 'id,starts_at,ends_at,client_name,client_phone,notes,services(name)';

async function pushToCalendar(supabase: Awaited<ReturnType<typeof supabaseSession>>, b: BookingForCal) {
  const eventId = await gcalInsert({
    summary: `${b.services?.name ?? 'Masaje'} · ${b.client_name}`,
    description: [`WhatsApp: +${b.client_phone}`, b.notes && `Notas: ${b.notes}`, 'Reservado desde Masajes AV'].filter(Boolean).join('\n'),
    start: b.starts_at,
    end: b.ends_at,
  });
  if (eventId) await supabase.from('bookings').update({ gcal_event_id: eventId }).eq('id', b.id);
}

export async function confirmBooking(f: FormData) {
  const supabase = await supabaseSession();
  // Transición atómica: solo confirma si sigue pendiente.
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', str(f, 'id'))
    .eq('status', 'pending')
    .select(SELECT_CAL)
    .maybeSingle<BookingForCal>();

  if (error || !data) back(f, { error: 'El turno ya no está pendiente' });
  try {
    await pushToCalendar(supabase, data);
  } catch {
    back(f, { error: 'Turno confirmado, pero no se pudo agregar a Google Calendar' });
  }
  back(f, { ok: 'Turno confirmado' });
}

export async function rejectBooking(f: FormData) {
  const supabase = await supabaseSession();
  await supabase.from('bookings').update({ status: 'rejected' }).eq('id', str(f, 'id')).eq('status', 'pending');
  back(f, { ok: 'Pedido rechazado: el horario volvió a quedar libre' });
}

export async function cancelBooking(f: FormData) {
  const supabase = await supabaseSession();
  const { data } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', str(f, 'id'))
    .in('status', ['pending', 'confirmed'])
    .select('gcal_event_id')
    .maybeSingle<{ gcal_event_id: string | null }>();
  try {
    await gcalDelete(data?.gcal_event_id ?? null);
  } catch {
    back(f, { error: 'Turno cancelado, pero no se pudo borrar de Google Calendar' });
  }
  back(f, { ok: 'Turno cancelado' });
}

/** Turno cargado a mano (pedidos por WhatsApp o teléfono): entra confirmado. */
export async function addManualBooking(f: FormData) {
  const day = str(f, 'day');
  const time = str(f, 'time');
  const phone = str(f, 'phone').replace(/\D/g, '');
  const name = str(f, 'name');
  if (!isIsoDay(day) || !TIME_RE.test(time)) back(f, { error: 'Revisá día y hora' });
  if (name.length < 2 || !/^\d{8,15}$/.test(phone)) back(f, { error: 'Revisá nombre y WhatsApp' });

  const supabase = await supabaseSession();
  const { data: svc } = await supabase.from('services').select('duration_min').eq('id', str(f, 'service')).maybeSingle<{ duration_min: number }>();
  if (!svc) back(f, { error: 'Elegí un servicio' });

  const start = new Date(localToIso(day, time));
  const end = new Date(start.getTime() + svc.duration_min * 60_000);

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      service_id: str(f, 'service'),
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      client_name: name,
      client_phone: phone,
      notes: str(f, 'notes').slice(0, 500),
      status: 'confirmed',
    })
    .select(SELECT_CAL)
    .single<BookingForCal>();

  if (error) back(f, { error: error.code === '23P01' ? 'Ese horario se superpone con otro turno' : 'No se pudo guardar el turno' });
  try {
    await pushToCalendar(supabase, data);
  } catch {
    back(f, { error: 'Turno guardado, pero no se pudo agregar a Google Calendar' });
  }
  back(f, { ok: 'Turno agregado' });
}

// ---------------------------------------------------------------- Ajustes
export async function updateSettings(f: FormData) {
  const n = (k: string) => Number(str(f, k));
  const supabase = await supabaseSession();
  const { error } = await supabase
    .from('settings')
    .update({
      buffer_min: n('buffer_min'),
      min_notice_hours: n('min_notice_hours'),
      max_days_ahead: n('max_days_ahead'),
    })
    .eq('id', 1);
  back(f, error ? { error: 'Algún valor está fuera de rango' } : { ok: 'Ajustes guardados' });
}
