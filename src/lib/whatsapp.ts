export const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? '5492304513837';

export const waLink = (text: string, phone: string = WHATSAPP) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

/** Normaliza un celular argentino a formato wa.me (549 + característica + número). */
export function toWaPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2'); // quita el 15 viejo
  return `549${d}`;
}
