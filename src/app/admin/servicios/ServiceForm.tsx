'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Service } from '@/lib/types';
import { saveService } from './actions';

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Achica la foto en el navegador y la pasa a WebP (de varios MB a ~150–300 KB). */
async function compress(file: File): Promise<File> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', QUALITY));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn--primario" type="submit" disabled={busy || pending}>
      {busy ? 'Preparando foto…' : pending ? 'Guardando…' : label}
    </button>
  );
}

export function ServiceForm({ service }: { service?: Service }) {
  const [preview, setPreview] = useState<string | null>(service?.image_url ?? null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const id = service?.id ?? 'nuevo';

  // Libera las vistas previas locales al cambiar o desmontar.
  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const original = input.files?.[0];
    if (!original) return;
    setBusy(true);
    try {
      const small = await compress(original);
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
      setPreview(URL.createObjectURL(small));
      setRemoved(false);
    } catch {
      setPreview(URL.createObjectURL(original));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={saveService} className="svc-form">
      {service && <input type="hidden" name="id" value={service.id} />}

      <div className="svc-photo">
        {preview && !removed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" />
        ) : (
          <span className="muted small">Sin foto</span>
        )}
      </div>
      <div className="svc-photo-actions">
        <label className="btn btn--secundario btn--sm" htmlFor={`img-${id}`}>{preview && !removed ? 'Cambiar foto' : 'Subir foto'}</label>
        <input id={`img-${id}`} className="sr-only" type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
        {service?.image_url && (
          <label className="check small">
            <input type="checkbox" name="remove_image" checked={removed} onChange={(e) => setRemoved(e.target.checked)} /> Quitar foto
          </label>
        )}
      </div>

      <div className="field"><label htmlFor={`n-${id}`}>Nombre</label>
        <input id={`n-${id}`} name="name" className="input" defaultValue={service?.name} required minLength={2} maxLength={60} />
      </div>
      <div className="field"><label htmlFor={`c-${id}`}>Categoría <span className="muted">(se ve arriba del nombre)</span></label>
        <input id={`c-${id}`} name="category" className="input" defaultValue={service?.category} maxLength={40} placeholder="Terapéutico, Bienestar…" />
      </div>
      <div className="field"><label htmlFor={`d-${id}`}>Descripción</label>
        <textarea id={`d-${id}`} name="description" className="input" defaultValue={service?.description} maxLength={280} />
      </div>
      <div className="row">
        <div className="field"><label htmlFor={`m-${id}`}>Duración (min)</label>
          <input id={`m-${id}`} type="number" name="duration" className="input" min={15} max={240} step={5} defaultValue={service?.duration_min ?? 60} required />
        </div>
        <div className="field"><label htmlFor={`p-${id}`}>Precio ($)</label>
          <input id={`p-${id}`} type="number" name="price" className="input" min={0} step={100} defaultValue={service?.price ?? ''} placeholder="Se usa para calcular la seña" />
        </div>
      </div>
      <label className="check"><input type="checkbox" name="active" defaultChecked={service?.active ?? true} /> Visible en la web</label>
      <label className="check"><input type="checkbox" name="show_price" defaultChecked={service?.show_price ?? false} /> Precio visible <span className="muted small">(destildado: en la web dice «Consultá el valor», pero se usa para la seña)</span></label>
      <label className="check"><input type="checkbox" name="featured" defaultChecked={service?.featured ?? false} /> Destacado (fondo piel)</label>
      <Submit busy={busy} label={service ? 'Guardar cambios' : 'Crear servicio'} />
    </form>
  );
}
