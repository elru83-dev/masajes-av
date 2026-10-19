import { gcalCheck } from '@/lib/gcal';
import { mailCheck } from '@/lib/notify';
import { explain } from '@/lib/errors';
import { supabaseSession } from '@/lib/supabase/server';

type Check = { name: string; ok: boolean; detail: string; fix?: string };

const has = (k: string) => Boolean(process.env[k]?.trim());

export default async function EstadoPage() {
  const sb = await supabaseSession();

  const [{ data: { user } }, admin, slots, photos, bucket, gcal, mail] = await Promise.all([
    sb.auth.getUser(),
    sb.rpc('is_admin'),
    sb.from('slots').select('starts_at', { head: true, count: 'exact' }),
    sb.from('services').select('image_url').limit(1),
    sb.storage.from('services').list('', { limit: 1 }),
    gcalCheck(),
    mailCheck(),
  ]);

  const env = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_WHATSAPP', 'NEXT_PUBLIC_DEV_WHATSAPP'];
  const missingEnv = env.filter((k) => !has(k));

  const checks: Check[] = [
    {
      name: 'Variables de entorno',
      ok: !missingEnv.some((k) => k.includes('SUPABASE')),
      detail: missingEnv.length ? `Faltan: ${missingEnv.join(', ')}` : 'Todas cargadas',
      fix: 'Vercel → Settings → Environment Variables, y después Redeploy',
    },
    { name: 'Sesión', ok: Boolean(user), detail: user ? `Ingresaste como ${user.email}` : 'Sin sesión' },
    {
      name: 'Permiso de administradora',
      ok: admin.data === true,
      detail: admin.error ? explain(admin.error) : admin.data ? 'OK' : `${user?.email} no está en public.admins`,
      fix: `insert into public.admins (user_id) select id from auth.users where email = '${user?.email ?? 'EMAIL'}';`,
    },
    {
      name: 'Agenda (tabla de horarios)',
      ok: !slots.error,
      detail: slots.error ? explain(slots.error) : `OK · ${slots.count ?? 0} horarios cargados`,
      fix: 'Ejecutar supabase/migrations/0001_init.sql (versión con horarios por día)',
    },
    {
      name: 'Servicios con fotos',
      ok: !photos.error,
      detail: photos.error ? explain(photos.error) : 'OK',
      fix: 'Ejecutar supabase/migrations/0002_service_photos.sql',
    },
    {
      name: 'Espacio de fotos (Storage)',
      ok: !bucket.error,
      detail: bucket.error ? explain(bucket.error) : 'OK',
      fix: 'Ejecutar supabase/migrations/0002_service_photos.sql',
    },
    { name: 'Google Calendar', ok: gcal.ok, detail: gcal.detail, fix: 'Ver README → Google Calendar' },
    { name: 'Aviso por mail', ok: mail.ok, detail: mail.detail, fix: 'Ver README → Aviso por mail' },
  ];

  return (
    <div className="stack-lg">
      <div className="stack">
        <h1 className="h2">Estado del sistema</h1>
        <p className="muted">Revisa la configuración. No muestra claves, solo si están bien.</p>
      </div>
      <div className="checks">
        {checks.map((c) => (
          <div key={c.name} className={`card check-row ${c.ok ? 'check-row--ok' : 'check-row--bad'}`}>
            <span className="check-dot" aria-hidden="true">{c.ok ? '✓' : '✕'}</span>
            <div className="stack-sm">
              <strong>{c.name}</strong>
              <span className="small">{c.detail}</span>
              {!c.ok && c.fix && <code className="check-fix">{c.fix}</code>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
