import { supabaseSession } from '@/lib/supabase/server';
import type { Service, Settings } from '@/lib/types';
import { updateService, updateSettings } from '../actions';
import { Flash } from '../Flash';

const BACK = '/admin/ajustes';

export default async function AjustesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseSession();
  const [settings, services] = await Promise.all([
    supabase.from('settings').select('buffer_min,min_notice_hours,max_days_ahead').eq('id', 1).maybeSingle<Settings>(),
    supabase.from('services').select('*').order('sort').returns<Service[]>(),
  ]);
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

      {/* Servicios */}
      <section className="stack">
        <h2 className="h3">Servicios</h2>
        <div className="grid">
          {(services.data ?? []).map((sv) => (
            <form key={sv.id} action={updateService} className="card stack">
              <input type="hidden" name="back" value={BACK} />
              <input type="hidden" name="id" value={sv.id} />
              <div className="field"><label htmlFor={`n-${sv.id}`}>Nombre</label><input id={`n-${sv.id}`} name="name" className="input" defaultValue={sv.name} required /></div>
              <div className="field"><label htmlFor={`c-${sv.id}`}>Categoría</label><input id={`c-${sv.id}`} name="category" className="input" defaultValue={sv.category} /></div>
              <div className="field"><label htmlFor={`d-${sv.id}`}>Descripción</label><textarea id={`d-${sv.id}`} name="description" className="input" defaultValue={sv.description} maxLength={200} /></div>
              <div className="row">
                <div className="field"><label htmlFor={`m-${sv.id}`}>Duración (min)</label><input id={`m-${sv.id}`} type="number" name="duration" className="input" min={15} max={240} step={5} defaultValue={sv.duration_min} /></div>
                <div className="field"><label htmlFor={`p-${sv.id}`}>Precio ($)</label><input id={`p-${sv.id}`} type="number" name="price" className="input" min={0} step={100} defaultValue={sv.price ?? ''} /></div>
              </div>
              <label className="check"><input type="checkbox" name="active" defaultChecked={sv.active} /> Visible en la web</label>
              <label className="check"><input type="checkbox" name="featured" defaultChecked={sv.featured} /> Destacado</label>
              <button className="btn btn--secundario" type="submit">Guardar</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
