'use client';

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestBooking, type BookingState } from '@/app/actions';
import type { Service } from '@/lib/types';
import { addDays, dayOf, fmtLongDay, fmtShortDay, fmtTime, fmtWeekRange, today, weekDays, weekStart } from '@/lib/time';
import { waLink } from '@/lib/whatsapp';
import { IconChevron, IconWhatsApp } from './Icons';

const MAX_WEEKS_AHEAD = 4;
export const PICK_EVENT = 'av:pick-service';

type SlotsByDay = Map<string, string[]>;

export function Booking({ services }: { services: Service[] }) {
  const firstWeek = useMemo(() => weekStart(today()), []);
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? '');
  const [monday, setMonday] = useState(firstWeek);
  const [slots, setSlots] = useState<SlotsByDay | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const cache = useRef(new Map<string, SlotsByDay>());
  const [state, formAction, sending] = useActionState<BookingState, FormData>(requestBooking, { status: 'idle' });

  const service = services.find((s) => s.id === serviceId);

  const load = useCallback(async (svc: string, week: string, signal?: AbortSignal, force = false) => {
    const key = `${svc}|${week}`;
    const hit = cache.current.get(key);
    if (hit && !force) return hit;
    const res = await fetch(`/api/slots?service=${svc}&from=${week}`, { signal });
    if (!res.ok) throw new Error('slots');
    const { slots: list } = (await res.json()) as { slots: string[] };
    const byDay: SlotsByDay = new Map();
    for (const iso of list) {
      const d = dayOf(iso);
      const arr = byDay.get(d);
      if (arr) arr.push(iso);
      else byDay.set(d, [iso]);
    }
    cache.current.set(key, byDay);
    return byDay;
  }, []);

  // Carga los horarios al cambiar servicio o semana.
  useEffect(() => {
    if (!serviceId) return;
    const ctrl = new AbortController();
    setSlots(null);
    setLoadError(false);
    setStart(null);
    load(serviceId, monday, ctrl.signal)
      .then((byDay) => {
        setSlots(byDay);
        setDay((prev) => (prev && byDay.has(prev) ? prev : (byDay.keys().next().value ?? null)));
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setLoadError(true);
      });
    return () => ctrl.abort();
  }, [serviceId, monday, load]);

  // Si el horario se ocupó mientras completaba el formulario, refresca la semana.
  useEffect(() => {
    if (state.status === 'error' && state.slotTaken) {
      setStart(null);
      load(serviceId, monday, undefined, true).then(setSlots).catch(() => setLoadError(true));
    }
  }, [state, serviceId, monday, load]);

  // Las tarjetas de servicio de la landing eligen el servicio y bajan hasta acá.
  useEffect(() => {
    const onPick = (e: Event) => setServiceId((e as CustomEvent<string>).detail);
    window.addEventListener(PICK_EVENT, onPick);
    return () => window.removeEventListener(PICK_EVENT, onPick);
  }, []);

  if (state.status === 'ok' && state.start) {
    const text =
      `Hola Alejandra, pedí un turno por la web: ${service?.name ?? 'masaje'} ` +
      `el ${fmtLongDay(dayOf(state.start)).toLowerCase()} a las ${fmtTime(state.start)}.`;
    return (
      <div className="card booking-done" role="status">
        <span className="tag">Pedido recibido</span>
        <h3 className="h2">¡Gracias! Tu turno quedó reservado y pendiente de confirmación.</h3>
        <p className="lead">
          {service?.name} · {fmtLongDay(dayOf(state.start))} · {fmtTime(state.start)} a {fmtTime(state.end)} hs
        </p>
        <p className="muted">Alejandra te va a confirmar por WhatsApp. Si querés agilizarlo, avisale ahora:</p>
        <a className="btn btn--wa" href={waLink(text)} target="_blank" rel="noopener noreferrer">
          <IconWhatsApp /> Avisar por WhatsApp
        </a>
      </div>
    );
  }

  const days = weekDays(monday);
  const daySlots = (day && slots?.get(day)) || [];
  const canPrev = monday > firstWeek;
  const canNext = monday < addDays(firstWeek, 7 * MAX_WEEKS_AHEAD);

  return (
    <div className="booking card">
      {/* 1 · Servicio */}
      <fieldset className="booking-step">
        <legend className="booking-legend"><span>1</span> Elegí el servicio</legend>
        <div className="booking-services">
          {services.map((s) => (
            <button key={s.id} type="button" className="svc-chip" aria-pressed={s.id === serviceId} onClick={() => setServiceId(s.id)}>
              <strong>{s.name}</strong>
              <span>{s.duration_min} min</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 2 · Día y horario */}
      <fieldset className="booking-step">
        <legend className="booking-legend"><span>2</span> Elegí día y horario</legend>
        <div className="week-nav">
          <button type="button" className="btn btn--texto" disabled={!canPrev} onClick={() => setMonday(addDays(monday, -7))} aria-label="Semana anterior">
            <IconChevron left />
          </button>
          <strong>Semana del {fmtWeekRange(monday)}</strong>
          <button type="button" className="btn btn--texto" disabled={!canNext} onClick={() => setMonday(addDays(monday, 7))} aria-label="Semana siguiente">
            <IconChevron />
          </button>
        </div>

        <div className="days" role="tablist" aria-label="Días">
          {days.map((d) => {
            const n = slots?.get(d)?.length ?? 0;
            return (
              <button key={d} type="button" role="tab" className="day" aria-selected={d === day} disabled={!n} onClick={() => { setDay(d); setStart(null); }}>
                <span>{fmtShortDay(d)}</span>
                <small>{slots ? (n ? `${n} libres` : '—') : '…'}</small>
              </button>
            );
          })}
        </div>

        {loadError ? (
          <p className="msg-error">No pudimos cargar la agenda. Probá de nuevo o consultanos por WhatsApp.</p>
        ) : !slots ? (
          <p className="muted" aria-live="polite">Cargando horarios…</p>
        ) : slots.size === 0 ? (
          <p className="muted">No hay turnos disponibles esta semana. Probá la siguiente o consultanos por WhatsApp.</p>
        ) : (
          <div className="turnos" role="group" aria-label={day ? `Horarios del ${fmtLongDay(day)}` : 'Horarios'}>
            {daySlots.map((iso) => (
              <button key={iso} type="button" className="turno" aria-pressed={iso === start} onClick={() => setStart(iso)}>
                {fmtTime(iso)}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {/* 3 · Datos */}
      {start && (
        <form action={formAction} className="booking-step">
          <p className="booking-legend"><span>3</span> Tus datos</p>
          <p className="booking-summary">
            {service?.name} · {fmtLongDay(dayOf(start))} · {fmtTime(start)} hs
          </p>
          <input type="hidden" name="service" value={serviceId} />
          <input type="hidden" name="start" value={start} />
          <div className="sr-only" aria-hidden="true">
            <label>No completar <input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="bk-name">Nombre y apellido</label>
              <input id="bk-name" className="input" name="name" required minLength={2} maxLength={80} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="bk-phone">WhatsApp</label>
              <input id="bk-phone" className="input" name="phone" required inputMode="tel" autoComplete="tel" placeholder="230 451 1111" pattern="[0-9 +()\-]{8,20}" />
            </div>
            <div className="field">
              <label htmlFor="bk-email">Email <span className="muted">(opcional)</span></label>
              <input id="bk-email" className="input" type="email" name="email" autoComplete="email" maxLength={120} />
            </div>
            <div className="field form-grid-full">
              <label htmlFor="bk-notes">¿Algo que debamos saber? <span className="muted">(opcional)</span></label>
              <textarea id="bk-notes" className="input" name="notes" maxLength={500} placeholder="Molestias, embarazo, competencia próxima…" />
            </div>
          </div>
          {state.status === 'error' && <p className="msg-error" role="alert">{state.message}</p>}
          <button className="btn btn--primario" type="submit" disabled={sending}>
            {sending ? 'Enviando…' : 'Reservar turno'}
          </button>
          <p className="muted small">El turno queda pendiente hasta que Alejandra lo confirme por WhatsApp.</p>
        </form>
      )}
    </div>
  );
}
