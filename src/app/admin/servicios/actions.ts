'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { explain } from '@/lib/errors';
import { supabaseSession } from '@/lib/supabase/server';

const BUCKET = 'services';
const MAX_IMAGE = 2 * 1024 * 1024;
const PATH = '/admin/servicios';

type Sb = Awaited<ReturnType<typeof supabaseSession>>;

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function done(msg: { ok?: string; error?: string }): never {
  revalidatePath('/');
  revalidatePath(PATH);
  const q = new URLSearchParams(msg as Record<string, string>);
  redirect(`${PATH}?${q}`);
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'servicio';

async function uploadImage(sb: Sb, file: File, slug: string) {
  if (!file.type.startsWith('image/') || file.size > MAX_IMAGE) throw new Error('image');
  const ext = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${slug}-${Date.now().toString(36)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000', // nombre único por versión: se puede cachear un año
    upsert: false,
  });
  if (error) throw error;
  return { path, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

async function removeImage(sb: Sb, path: string | null) {
  if (path) await sb.storage.from(BUCKET).remove([path]);
}

/** Crea o actualiza un servicio (con foto opcional). */
export async function saveService(f: FormData) {
  const id = str(f, 'id');
  const name = str(f, 'name');
  const duration = Number(str(f, 'duration'));
  const priceRaw = str(f, 'price');
  const image = f.get('image');
  const file = image instanceof File && image.size > 0 ? image : null;

  if (name.length < 2) done({ error: 'Poné un nombre para el servicio' });
  if (!(duration >= 15 && duration <= 240)) done({ error: 'La duración debe estar entre 15 y 240 minutos' });

  const sb = await supabaseSession();
  const fields = {
    name,
    category: str(f, 'category').slice(0, 40),
    description: str(f, 'description').slice(0, 280),
    duration_min: duration,
    price: priceRaw ? Number(priceRaw) : null,
    active: f.get('active') === 'on',
    featured: f.get('featured') === 'on',
  };

  // Servicio existente: lee la foto actual para reemplazarla o quitarla.
  const current = id
    ? (await sb.from('services').select('slug,image_path').eq('id', id).maybeSingle()).data
    : null;
  if (id && !current) done({ error: 'El servicio no existe' });

  const slug = current?.slug ?? `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

  let img: { path: string; url: string } | null = null;
  if (file) {
    try {
      img = await uploadImage(sb, file, slug);
    } catch (e) {
      done({ error: (e as Error).message === 'image' ? 'La foto debe ser JPG, PNG o WebP de hasta 2 MB' : `No se pudo subir la foto: ${explain(e as Error)}` });
    }
  }
  const dropImage = f.get('remove_image') === 'on';
  const imageFields = img
    ? { image_url: img.url, image_path: img.path }
    : dropImage
      ? { image_url: null, image_path: null }
      : {};

  if (current) {
    const { data: updated, error } = await sb.from('services').update({ ...fields, ...imageFields }).eq('id', id).select('id');
    if (error || !updated?.length) {
      await removeImage(sb, img?.path ?? null);
      done({ error: `No se pudo guardar el servicio: ${explain(error ?? { code: '42501' })}` });
    }
    if (img || dropImage) await removeImage(sb, current.image_path);
    done({ ok: `“${name}” actualizado` });
  }

  // Nuevo: va al final de la lista.
  const { data: last } = await sb.from('services').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle();
  const { error } = await sb.from('services').insert({ ...fields, ...imageFields, slug, sort: (last?.sort ?? 0) + 1 });
  if (error) {
    await removeImage(sb, img?.path ?? null);
    done({ error: `No se pudo crear el servicio: ${explain(error)}` });
  }
  done({ ok: `“${name}” creado` });
}

/** Elimina el servicio; si ya tiene turnos, lo oculta para no perder el historial. */
export async function deleteService(f: FormData) {
  const id = str(f, 'id');
  const sb = await supabaseSession();
  const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('service_id', id);

  if (count) {
    await sb.from('services').update({ active: false }).eq('id', id);
    done({ ok: 'El servicio tiene turnos registrados: quedó oculto en la web en lugar de borrarse' });
  }

  const { data } = await sb.from('services').delete().eq('id', id).select('image_path').maybeSingle();
  await removeImage(sb, data?.image_path ?? null);
  done({ ok: 'Servicio eliminado' });
}

/** Sube o baja un servicio en el orden de la web (intercambia con el vecino). */
export async function moveService(f: FormData) {
  const id = str(f, 'id');
  const up = str(f, 'dir') === 'up';
  const sb = await supabaseSession();
  const { data: list } = await sb.from('services').select('id,sort').order('sort').order('name');
  if (!list) done({});

  const i = list.findIndex((s) => s.id === id);
  const j = up ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) done({});

  // Reasigna posiciones 1..n con el intercambio aplicado (corrige empates de orden).
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(
    list.map((s, k) => (s.sort === k + 1 ? null : sb.from('services').update({ sort: k + 1 }).eq('id', s.id))),
  );
  done({});
}
