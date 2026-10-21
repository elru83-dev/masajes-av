import Link from 'next/link';
import { IconWhatsApp } from '@/components/Icons';
import { supabaseSession } from '@/lib/supabase/server';
import { addDays, dayOf, fmtLongDay, fmtTime, fmtWeekRange, isIsoDay, localToIso, today, weekDays, weekStart } from '@/lib/time';
import type { Booking } from '@/lib/types';
import { toWaPhone, waLink } from '@/lib/whatsapp';
import { addManualBooking, cancelBooking, confirmBooking, copyWeek, rejectBooking, setDaySlots } from './actions';
import { Flash } from './Flash';

type Search = Promise<{ semana?: string; ok?: string; error?: string }>;

const STATUS = { pending: 'Pendiente', confirmed: 'Confirmado' } as const;

/** Agrupa una lista por día en una sola pasada. */
function groupByDay<T>(items: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of items) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export default async function AgendaPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const now = today();
  const monday = weekStart(isIsoDay(sp.semana) ? sp.semana : now);
  const from = localToIso(monday, '00:00');
  const to = localToIso(addDays(monday, 7), '00:00');
  const backUrl = `/admin?semana=${monday}`;
  const supabase = await supabaseSession();

  const [slots, bookings, services, settings] = await Promise.all([
    supabase.from('slots').select('starts_at').gte('starts_at', from).lt('starts_at', to).order('starts_at'),
    supabase
      .from('bookings')
      .select('id,service_id,starts_at,ends_at,client_name,client_phone,client_email,notes,status,gcal_event_id,services(name)')
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at')
      .returns<Booking[]>(),
    supabase.from('services').select('id,name,duration_min').eq('active', true).order('sort'),
    supabase.from('settings').select('buffer_min').eq('id', 1).maybeSingle<{ buffer_min: number }>(),
  ]);

  const list = bookings.data ?? [];
  const pending = list.filter((b) => b.status === 'pending');
  const key = (iso: string) => new Date(iso).toISOString().slice(0, 16);
  const bookingAt = new Map(list.map((b) => [key(b.starts_at), b]));
  const slotsByDay = groupByDay(slots.data ?? [], (s) => dayOf(s.starts_at));
  const bookingsByDay = groupByDay(list, (b) => dayOf(b.starts_at));
  const totalSlots = slots.data?.length ?? 0;

  // Horarios publicados que tapa un turno que empezó antes (masaje largo o su pausa).
  // Por día hay pocos turnos, así que la búsqueda lineal es lo más barato.
  const bufMs = (settings.data?.buffer_min ?? 0) * 60_000;
  const blockedBy = new Map<string, Booking>();
  const covers = new Map<string, string[]>();
  for (const [d, daySlots] of slotsByDay) {
    const dayBookings = bookingsByDay.get(d);
    if (!dayBookings) continue;
    for (const s of daySlots) {
      const k = key(s.starts_at);
      if (bookingAt.has(k)) continue;
      const t = Date.parse(s.starts_at);
      const b = dayBookings.find((x) => Date.parse(x.starts_at) < t && t < Date.parse(x.ends_at) + bufMs);
      if (!b) continue;
      blockedBy.set(k, b);
      const arr = covers.get(b.id);
      if (arr) arr.push(fmtTime(s.starts_at));
      else covers.set(b.id, [fmtTime(s.starts_at)]);
    }
  }
  const days = weekDays(monday);

  return (
    <div className="stack-lg">
      <Flash ok={sp.ok} error={sp.error} />

      {/* Cabecera de la semana */}
      <section className="week-head card">
        <div className="week-head-nav">
          <Link className="btn btn--secundario btn--sm" href={`/admin?semana=${addDays(monday, -7)}`}>← Anterior</Link>
          <div>
            <h1 className="h2">Semana del {fmtWeekRange(monday)}</h1>
            <p className="muted small">
              {totalSlots} horarios publicados · {pending.length} pendientes · {list.length - pending.length} confirmados
            </p>
          </div>
          <Link className="btn btn--secundario btn--sm" href={`/admin?semana=${addDays(monday, 7)}`}>Siguiente →</Link>
        </div>
        <form action={copyWeek} className="week-publish">
          <input type="hidden" name="back" value={backUrl} />
          <input type="hidden" name="from" value={addDays(monday, -7)} />
          <input type="hidden" name="to" value={monday} />
          <button className="btn btn--texto" type="submit">Copiar los horarios de la semana anterior</button>
        </form>
      </section>

      {/* Pedidos por confirmar */}
      {pending.length > 0 && (
        <section className="stack">
          <h2 className="h3">Por confirmar</h2>
          <div className="booking-list">
            {pending.map((b) => <BookingRow key={b.id} b={b} backUrl={backUrl} covers={covers.get(b.id)} showDay />)}
          </div>
        </section>
      )}

      {/* Días */}
      <section className="days-grid">
        {days.map((d) => {
          const daySlots = slotsByDay.get(d) ?? [];
          const dayBookings = bookingsByDay.get(d) ?? [];
          const past = d < now;
          const value = daySlots.map((s) => fmtTime(s.starts_at)).join(', ');
          return (
            <article key={d} className={`card day-card${past ? ' day-card--past' : ''}`}>
              <h3 className="h3">{fmtLongDay(d)}</h3>

              {daySlots.length > 0 ? (
                <ul className="slot-chips" aria-label="Horarios publicados">
                  {daySlots.map((s) => {
                    const k = key(s.starts_at);
                    const b = bookingAt.get(k);
                    const by = b ? undefined : blockedBy.get(k);
                    return (
                      <li
                        key={s.starts_at}
                        className={`slot-chip slot-chip--${b?.status ?? (by ? 'blocked' : 'free')}`}
                        title={by ? `Lo ocupa el turno de las ${fmtTime(by.starts_at)} (${by.client_name}, hasta ${fmtTime(by.ends_at)})` : undefined}
                      >
                        <strong>{fmtTime(s.starts_at)}</strong>
                        <span>{b ? b.client_name.split(' ')[0] : by ? 'Ocupado' : 'Libre'}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted small">Sin horarios publicados</p>
              )}

              {!past && (
                <form action={setDaySlots} className="slot-form">
                  <input type="hidden" name="back" value={backUrl} />
                  <input type="hidden" name="day" value={d} />
                  <label className="sr-only" htmlFor={`times-${d}`}>Horarios del {fmtLongDay(d)}</label>
                  <input id={`times-${d}`} className="input" name="times" defaultValue={value} placeholder="Ej.: 9, 12, 13:30, 15" autoComplete="off" />
                  <button className="btn btn--primario btn--sm" type="submit">Guardar</button>
                </form>
              )}

              {dayBookings.length > 0 && (
                <div className="booking-list">
                  {dayBookings.map((b) => <BookingRow key={b.id} b={b} backUrl={backUrl} covers={covers.get(b.id)} />)}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <p className="muted small">
        Escribí los horarios de inicio separados por coma, como los mandás por WhatsApp. Los horarios con turno tomado se
        mantienen aunque los borres; para liberarlos, cancelá o rechazá el turno. Si un masaje largo pasa por encima del
        horario siguiente, ese horario aparece como <strong>Ocupado</strong> y deja de ofrecerse en la web.
      </p>

      {/* Turno manual */}
      <form action={addManualBooking} className="card stack manual">
        <h2 className="h3">Agregar turno manual</h2>
        <p className="muted small">Para turnos que te piden por WhatsApp. Entra confirmado y va a tu Google Calendar.</p>
        <input type="hidden" name="back" value={backUrl} />
        <div className="row">
          <div className="field"><label htmlFor="mb-service">Servicio</label>
            <select id="mb-service" name="service" className="input" required>
              {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_min} min)</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="mb-day">Día</label>
            <select id="mb-day" name="day" className="input" defaultValue={days.find((d) => d >= now) ?? days[0]}>
              {days.map((d) => <option key={d} value={d}>{fmtLongDay(d)}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="mb-time">Hora</label><input id="mb-time" type="time" name="time" className="input" required step={900} /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="mb-name">Nombre</label><input id="mb-name" name="name" className="input" required minLength={2} maxLength={80} /></div>
          <div className="field"><label htmlFor="mb-phone">WhatsApp</label><input id="mb-phone" name="phone" className="input" required inputMode="tel" /></div>
          <div className="field"><label htmlFor="mb-notes">Notas</label><input id="mb-notes" name="notes" className="input" maxLength={500} /></div>
        </div>
        <button className="btn btn--primario" type="submit">Agregar confirmado</button>
      </form>
    </div>
  );
}

function BookingRow({ b, backUrl, covers, showDay = false }: { b: Booking; backUrl: string; covers?: string[]; showDay?: boolean }) {
  const service = b.services?.name ?? 'Masaje';
  const when = `${showDay ? `${fmtLongDay(dayOf(b.starts_at))} · ` : ''}${fmtTime(b.starts_at)}–${fmtTime(b.ends_at)}`;
  const confirmText =
    `Hola ${b.client_name.split(' ')[0]}, te confirmo tu turno de ${service} el ` +
    `${fmtLongDay(dayOf(b.starts_at)).toLowerCase()} a las ${fmtTime(b.starts_at)} hs. ¡Te espero! — Alejandra, Masajes AV`;

  return (
    <div className={`bk bk--${b.status}`}>
      <div className="bk-info">
        <strong>{when}</strong>
        <span>{b.client_name} · {service}</span>
        {b.notes && <span className="muted small">“{b.notes}”</span>}
        <span className="bk-tags">
          <span className={b.status === 'pending' ? 'tag tag--piel' : 'tag'}>{STATUS[b.status as keyof typeof STATUS]}</span>
          {covers && <span className="tag tag--piel">Ocupa también {covers.join(', ')}</span>}
          {b.gcal_event_id && <span className="tag tag--gris">En Google Calendar</span>}
        </span>
      </div>
      <div className="bk-actions">
        <a className="btn btn--wa btn--sm" href={waLink(confirmText, toWaPhone(b.client_phone))} target="_blank" rel="noopener noreferrer">
          <IconWhatsApp /> {b.status === 'pending' ? 'Escribir' : 'Avisar'}
        </a>
        {b.status === 'pending' && (
          <>
            <ActionButton action={confirmBooking} id={b.id} backUrl={backUrl} className="btn btn--primario btn--sm">Confirmar</ActionButton>
            <ActionButton action={rejectBooking} id={b.id} backUrl={backUrl} className="btn btn--texto">Rechazar</ActionButton>
          </>
        )}
        {b.status === 'confirmed' && (
          <ActionButton action={cancelBooking} id={b.id} backUrl={backUrl} className="btn btn--texto">Cancelar</ActionButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({ action, id, backUrl, className, children }: {
  action: (f: FormData) => Promise<void>; id: string; backUrl: string; className: string; children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={backUrl} />
      <button className={className} type="submit">{children}</button>
    </form>
  );
}
