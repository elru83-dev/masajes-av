'use server';

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

  const { data, error } = await supabasePublic().rpc('request_booking', {
    p_service_id: str('service'),
    p_start: str('start'),
    p_name: str('name'),
    p_phone: str('phone'),
    p_email: str('email') || null,
    p_notes: str('notes') || null,
  });

  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return {
      status: 'error',
      message: key ? ERRORS[key] : 'No pudimos registrar el turno. Probá de nuevo o escribinos por WhatsApp.',
      slotTaken: key === 'slot_unavailable',
    };
  }

  const row = (data as { booking_start: string; booking_end: string }[])[0];
  return { status: 'ok', start: row.booking_start, end: row.booking_end };
}
