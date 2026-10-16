import { supabaseSession } from '@/lib/supabase/server';
import type { Service } from '@/lib/types';
import { Flash } from '../Flash';
import { deleteService, moveService } from './actions';
import { ServiceForm } from './ServiceForm';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default async function ServiciosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const sb = await supabaseSession();
  const { data } = await sb.from('services').select('*').order('sort').order('name').returns<Service[]>();
  const services = data ?? [];

  return (
    <div className="stack-lg">
      <Flash ok={sp.ok} error={sp.error} />
      <div className="stack">
        <h1 className="h2">Servicios</h1>
        <p className="muted">Lo que cargues acá se ve en la sección Servicios de la web y en el selector de reservas, en este mismo orden.</p>
      </div>

      <details className="card svc-new">
        <summary className="btn btn--primario">+ Nuevo servicio</summary>
        <ServiceForm />
      </details>

      <div className="svc-admin-list">
        {services.map((s, i) => (
          <article key={s.id} className={`card svc-admin${s.active ? '' : ' svc-admin--off'}`}>
            <div className="svc-admin-head">
              <div className="svc-thumb">
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">—</span>
                )}
              </div>
              <div className="svc-admin-info">
                <strong>{s.name}</strong>
                <span className="muted small">
                  {s.duration_min} min · {s.price != null ? money.format(s.price) : 'Precio a consultar'}
                </span>
                <span className="bk-tags">
                  {s.active ? <span className="tag">Visible</span> : <span className="tag tag--gris">Oculto</span>}
                  {s.featured && <span className="tag tag--piel">Destacado</span>}
                </span>
              </div>
              <div className="svc-order">
                <form action={moveService}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button className="btn btn--texto" type="submit" disabled={i === 0} aria-label={`Subir ${s.name}`}>↑</button>
                </form>
                <form action={moveService}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button className="btn btn--texto" type="submit" disabled={i === services.length - 1} aria-label={`Bajar ${s.name}`}>↓</button>
                </form>
              </div>
            </div>

            <details className="svc-edit">
              <summary className="btn btn--secundario btn--sm">Editar</summary>
              <ServiceForm service={s} />
              <details className="svc-delete">
                <summary className="btn btn--texto">Eliminar servicio</summary>
                <form action={deleteService} className="svc-delete-confirm">
                  <input type="hidden" name="id" value={s.id} />
                  <span className="small">¿Seguro? Si ya tiene turnos, se oculta en lugar de borrarse.</span>
                  <button className="btn btn--peligro btn--sm" type="submit">Sí, eliminar</button>
                </form>
              </details>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
