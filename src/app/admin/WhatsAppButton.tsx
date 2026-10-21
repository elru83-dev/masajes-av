'use client';

import { useId, useState } from 'react';
import { IconWhatsApp } from '@/components/Icons';

type Props = {
  phone: string;
  label: string;
  /** Mensaje sin seña. */
  text: string;
  /** Mensaje con seña; null si no se puede pedir (sin precio o sin alias). */
  depositText: string | null;
  /** Monto ya formateado, ej. "$9.000". */
  depositLabel?: string;
  /** Por qué no se puede pedir seña, para mostrarlo al pasar el mouse. */
  disabledReason?: string;
};

/** Botón de WhatsApp + check "Pedir seña": el mensaje se arma al instante, sin volver al servidor. */
export function WhatsAppButton({ phone, label, text, depositText, depositLabel, disabledReason }: Props) {
  const [deposit, setDeposit] = useState(false);
  const id = useId();
  const msg = deposit && depositText ? depositText : text;
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

  return (
    <>
      <label className="deposit-check" htmlFor={id} title={depositText ? undefined : disabledReason}>
        <input id={id} type="checkbox" checked={deposit} disabled={!depositText} onChange={(e) => setDeposit(e.target.checked)} />
        Pedir seña{depositText && depositLabel ? ` ${depositLabel}` : ''}
      </label>
      <a className="btn btn--wa btn--sm" href={href} target="_blank" rel="noopener noreferrer">
        <IconWhatsApp /> {label}
      </a>
    </>
  );
}
