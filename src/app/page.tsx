import Image from 'next/image';
import { Booking } from '@/components/Booking';
import { PickService } from '@/components/PickService';
import { Lockup, Mark } from '@/components/Logo';
import { IconBed, IconCalendar, IconDrop, IconLeaf, IconMail, IconPin, IconShield, IconWhatsApp } from '@/components/Icons';
import { supabasePublic } from '@/lib/supabase/server';
import type { Service } from '@/lib/types';
import { waLink } from '@/lib/whatsapp';

// La lista de servicios se regenera cada 5 minutos; la agenda se consulta en vivo.
export const revalidate = 300;

const DEV_WA = process.env.NEXT_PUBLIC_DEV_WHATSAPP;
const MAPS = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Barrio Santo Tomás, Pilar, Buenos Aires');
const WA_CONSULTA = waLink('Hola Alejandra, quiero consultar disponibilidad de turno.');
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const CUIDADOS = [
  { icon: <IconDrop />, title: 'Ambiente preparado', text: 'Luz, aroma y temperatura pensados para tu descanso.' },
  { icon: <IconShield />, title: 'Estricta higiene', text: 'Espacio y superficies desinfectados en cada turno.' },
  { icon: <IconBed />, title: 'Camilla de uso único', text: 'Vestimenta descartable, nueva para cada persona.' },
  { icon: <IconLeaf />, title: 'Productos hipoalergénicos', text: 'Aceites y cremas suaves, aptos para pieles sensibles.' },
];

async function getServices(): Promise<Service[]> {
  const { data } = await supabasePublic()
    .from('services')
    .select('id,slug,name,category,description,duration_min,price,featured,active,sort,image_url,image_path')
    .eq('active', true)
    .order('sort');
  return (data as Service[] | null) ?? [];
}

export default async function Home() {
  const services = await getServices();

  return (
    <>
      <header className="site-header">
        <div className="wrap site-header-in">
          <a href="#inicio" aria-label="Masajes AV, inicio"><Lockup /></a>
          <nav aria-label="Principal" className="site-nav">
            <a href="#servicios">Servicios</a>
            <a href="#cuidado">Cuidado</a>
            <a href="#contacto">Contacto</a>
            <a className="btn btn--primario btn--sm" href="#reservar">Reservar turno</a>
          </nav>
        </div>
      </header>

      <main id="inicio">
        {/* Hero */}
        <section className="hero">
          <div className="wrap hero-in">
            <div className="stack hero-copy">
              <span className="eyebrow">Pilar · Barrio Santo Tomás</span>
              <h1 className="h-display">Tu cuerpo, en equilibrio</h1>
              <p className="lead">
                Masajes relajantes y terapéuticos con Ma. Alejandra Villanueva, en un espacio cuidado al detalle:
                higiene estricta, camilla de uso único y productos hipoalergénicos.
              </p>
              <div className="cta-row">
                <a className="btn btn--primario" href="#reservar"><IconCalendar /> Reservar turno</a>
                <a className="btn btn--wa" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer"><IconWhatsApp /> Consultar por WhatsApp</a>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="blk blk-tinta" />
              <span className="blk blk-euca"><Mark size={220} inverse /></span>
              <span className="blk blk-piel" />
            </div>
          </div>
        </section>

        {/* Servicios */}
        <section id="servicios" className="section">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Servicios</span>
              <h2 className="h2">Un masaje para cada momento</h2>
            </div>
            <div className="grid">
              {services.map((s) => (
                <article key={s.id} className={`card svc-card${s.featured ? ' svc-card--destacada' : ''}${s.image_url ? ' svc-card--foto' : ''}`}>
                  {s.image_url && (
                    <div className="svc-img">
                      <Image src={s.image_url} alt={s.name} fill sizes="(min-width: 1120px) 352px, (min-width: 700px) 50vw, 100vw" />
                    </div>
                  )}
                  {s.category && <span className="eyebrow">{s.category}</span>}
                  <h3 className="svc-title">{s.name}</h3>
                  <p>{s.description}</p>
                  <p className="muted small">{s.duration_min} min · sesión individual</p>
                  <div className="svc-foot">
                    {s.price != null ? <span className="price">{money.format(s.price)}</span> : <span className="muted small">Consultá el valor</span>}
                    <PickService id={s.id} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Cuidado */}
        <section id="cuidado" className="section band-piel">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Tu tranquilidad</span>
              <h2 className="h2">Cuidamos cada detalle</h2>
              <p className="lead">Para que solo te ocupes de relajarte.</p>
            </div>
            <div className="grid">
              {CUIDADOS.map((c) => (
                <div key={c.title} className="card care">
                  <span className="care-icon">{c.icon}</span>
                  <h3 className="svc-title">{c.title}</h3>
                  <p className="muted">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reservas */}
        <section id="reservar" className="section">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Turnos online</span>
              <h2 className="h2">Reservá tu turno</h2>
              <p className="lead">Elegí el servicio, el día y el horario. Alejandra te confirma por WhatsApp.</p>
            </div>
            {services.length ? <Booking services={services} /> : <p className="muted">La agenda no está disponible en este momento.</p>}
          </div>
        </section>

        {/* Contacto */}
        <section id="contacto" className="section band-euca">
          <div className="wrap contact">
            <div className="stack">
              <span className="eyebrow eyebrow--claro">Contacto</span>
              <h2 className="h2">¿Tenés dudas? Escribinos</h2>
              <a className="contact-line contact-link" href={MAPS} target="_blank" rel="noopener noreferrer"><IconPin /> Barrio Santo Tomás, Pilar, Buenos Aires</a>
              <a className="contact-line contact-link" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer"><IconWhatsApp /> 230 451-3837</a>
              <a className="contact-line contact-link" href="mailto:av.masajes.integrales@gmail.com"><IconMail /> av.masajes.integrales@gmail.com</a>
            </div>
            <div className="cta-row">
              <a className="btn btn--wa" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer"><IconWhatsApp /> Escribir por WhatsApp</a>
              <a className="btn btn--claro" href="https://www.instagram.com/av.masajes.integrales" target="_blank" rel="noopener noreferrer">@av.masajes.integrales</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap site-footer-in">
          <span>© {new Date().getFullYear()} Masajes AV · Ma. Alejandra Villanueva</span>
          {DEV_WA ? (
            <a className="dev-credit" href={waLink('Hola Rulo, vi la web de Masajes AV y quiero consultarte por una página para mi negocio.', DEV_WA)} target="_blank" rel="noopener noreferrer">
              Powered by @RuloOo
            </a>
          ) : (
            <span>Powered by @RuloOo</span>
          )}
        </div>
      </footer>

      <a className="wa-float" href={WA_CONSULTA} target="_blank" rel="noopener noreferrer" aria-label="Consultar por WhatsApp">
        <IconWhatsApp />
      </a>
    </>
  );
}
