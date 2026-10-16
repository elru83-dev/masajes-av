import type { Metadata, Viewport } from 'next';
import { Fraunces, Figtree } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-titulos', display: 'swap' });
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-texto', display: 'swap' });

export const metadata: Metadata = {
  title: 'Masajes AV · Ma. Alejandra Villanueva · Pilar',
  description:
    'Masajes relajantes y descontracturantes, drenaje linfático, masaje deportivo y para embarazadas en Pilar, Barrio Santo Tomás. Reservá tu turno online.',
  openGraph: { title: 'Masajes AV', description: 'Relajación y terapia en equilibrio · Pilar', locale: 'es_AR', type: 'website' },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#2E5E58' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
