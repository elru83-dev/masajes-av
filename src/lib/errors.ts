/** Traduce errores técnicos de Supabase a una causa entendible para el panel. */
export function explain(err: { message?: string; code?: string } | null | undefined): string {
  const m = err?.message ?? '';
  if (/forbidden|row-level security|42501/i.test(m) || err?.code === '42501')
    return 'tu usuario no tiene permiso de administradora (falta el insert en public.admins)';
  if (/does not exist|schema cache|could not find/i.test(m) || err?.code === '42P01' || err?.code === 'PGRST202' || err?.code === 'PGRST204')
    return 'la base no está actualizada: falta ejecutar 0001_init.sql y/o 0002_service_photos.sql';
  if (/bucket not found/i.test(m)) return 'falta el espacio de fotos: ejecutá 0002_service_photos.sql';
  if (/JWT|apikey|Invalid API key/i.test(m)) return 'las claves de Supabase en Vercel no son correctas';
  return m || 'error desconocido';
}
