import { supabaseSession } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Settings } from '@/lib/types';
import { updateSettings } from '../actions';
import { Flash } from '../Flash';

const BACK = '/admin/ajustes';

export default async function AjustesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseSession();
  const settings = await supabase.from('settings').select('buffer_min,min_notice_hours,max_days_ahead').eq('id', 1).maybeSingle<Settings>();
  const s = settings.data;

  return (
    <div className="stack-lg">
      <Flash ok={sp.ok} error={sp.error} />
      <h1 className="h2">Ajustes</h1>

      {/* Reglas de la agenda */}
      {s && (
        <form action={updateSettings} className="card stack">
          <h2 className="h3">Reglas de la agenda</h2>
          <p className="muted small">La pausa entre turnos se suma a la duración del masaje: con 60 min + 30 min de pausa, dos horarios publicados tienen que estar al menos a 1:30 h de distancia.</p>
          <input type="hidden" name="back" value={BACK} />
          <div className="row">
            <div className="field"><label htmlFor="st-buf">Pausa entre turnos (min)</label><input id="st-buf" type="number" name="buffer_min" className="input" min={0} max={120} step={5} defaultValue={s.buffer_min} /></div>
            <div className="field"><label htmlFor="st-notice">Anticipación mínima (horas)</label><input id="st-notice" type="number" name="min_notice_hours" className="input" min={0} max={72} defaultValue={s.min_notice_hours} /></div>
            <div className="field"><label htmlFor="st-ahead">Reservas hasta (días)</label><input id="st-ahead" type="number" name="max_days_ahead" className="input" min={1} max={120} defaultValue={s.max_days_ahead} /></div>
          </div>
          <button className="btn btn--primario" type="submit">Guardar reglas</button>
        </form>
      )}

      <p className="muted">Los servicios, con sus fotos y precios, se editan en <Link href="/admin/servicios">Servicios</Link>.</p>
    </div>
  );
}
