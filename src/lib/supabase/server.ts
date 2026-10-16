import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '../database';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente con la sesión de la persona logueada (panel). */
export async function supabaseSession() {
  const store = await cookies();
  return createServerClient<Database>(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Llamado desde un Server Component: el middleware ya refresca la sesión.
        }
      },
    },
  });
}

/** Cliente anónimo sin cookies para la parte pública (permite cachear). */
let publicClient: ReturnType<typeof createClient<Database>> | null = null;
export function supabasePublic() {
  publicClient ??= createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  return publicClient;
}
