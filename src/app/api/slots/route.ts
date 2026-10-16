import { NextResponse, type NextRequest } from 'next/server';
import { supabasePublic } from '@/lib/supabase/server';
import { addDays, isIsoDay, today } from '@/lib/time';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/slots?service=<uuid>&from=YYYY-MM-DD → horarios libres de esa semana (7 días). */
export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get('service');
  const from = req.nextUrl.searchParams.get('from');

  if (!service || !UUID_RE.test(service) || !isIsoDay(from) || from < addDays(today(), -7)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const { data, error } = await supabasePublic().rpc('get_slots', {
    p_service_id: service,
    p_from: from,
    p_to: addDays(from, 6),
  });

  if (error) return NextResponse.json({ error: 'No pudimos cargar la agenda' }, { status: 500 });

  const slots = (data as { slot_start: string }[]).map((r) => r.slot_start);
  return NextResponse.json({ slots }, { headers: { 'Cache-Control': 'no-store' } });
}
