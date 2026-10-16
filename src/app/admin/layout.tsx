import type { Metadata } from 'next';
import Link from 'next/link';
import { Lockup } from '@/components/Logo';
import { supabaseSession } from '@/lib/supabase/server';
import { signOut } from './actions';
import './admin.css';

export const metadata: Metadata = { title: 'Panel · Masajes AV', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseSession();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="admin">
      {user && (
        <header className="admin-bar">
          <div className="wrap admin-bar-in">
            <Link href="/admin" aria-label="Agenda"><Lockup /></Link>
            <nav className="admin-nav" aria-label="Panel">
              <Link href="/admin">Agenda</Link>
              <Link href="/admin/ajustes">Ajustes</Link>
              <a href="/" target="_blank">Ver sitio</a>
              <form action={signOut}><button className="btn btn--texto" type="submit">Salir</button></form>
            </nav>
          </div>
        </header>
      )}
      <main className="wrap admin-main">{children}</main>
    </div>
  );
}
