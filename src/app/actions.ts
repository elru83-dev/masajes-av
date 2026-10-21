'use server';

import { after } from 'next/server';
import { notifyNewBooking } from '@/lib/notify';
import { supabasePublic } from '@/lib/supabase/server';

export type BookingState =
  | { status: 'idle' }
  | { status: 'ok'; start: string; end: string }
  | { status: 'error'; message: string; slotTaken?: boolean };

const ERRORS: Record<string, string> = {
  invalid_name: 'Revisá tu nombre.',
  invalid_phone: 'Revisá tu número de WhatsApp (con característica, sin 0 ni 15).',
  too_many_pending: 'Ya tenés turnos pendientes de confirmación. Escribinos por WhatsApp.',
  slot_unavailable: 'Ese horario se acaba de ocupar. Elegí otro, por favor.',
};

export async function requestBooking(_prev: BookingState, form: FormData): Promise<BookingState> {
  // Campo trampa para bots: una persona nunca lo completa.
  if (form.get('website')) return { status: 'ok', start: '', end: '' };

  const str = (k: string) => String(form.get(k) ?? '').trim();
  const serviceId = str('service');
  const name = str('name');
  const phone = str('phone');
  const email = str('email') || null;
  const notes = str('notes') || null;

  const db = supabasePublic();
  const { data, error } = await db.rpc('request_booking', {
    p_service_id: serviceId,
    p_start: str('start'),
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_notes: notes,
  });

  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return {
      status: 'error',
      message: key ? ERRORS[key] : 'No pudimos registrar el turno. Probá de nuevo o escribinos por WhatsApp.',
      slotTaken: key === 'slot_unavailable',
    };
  }

  const row = data[0];

  // Corre después de responderle al cliente: la reserva no espera al mail.
  after(async () => {
    const { data: svc } = await db.from('services_web').select('name').eq('id', serviceId).maybeSingle<{ name: string }>();
    await notifyNewBooking({
      service: svc?.name ?? 'Masaje',
      startsAt: row.booking_start,
      endsAt: row.booking_end,
      covers: row.covered_slots ?? [],
      nextFree: row.next_free,
      name,
      phone,
      email,
      notes,
    });
  });

  return { status: 'ok', start: row.booking_start, end: row.booking_end };
}
