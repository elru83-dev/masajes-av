'use client';

import { PICK_EVENT } from './Booking';

export function PickService({ id, label = 'Reservar' }: { id: string; label?: string }) {
  return (
    <button
      type="button"
      className="btn btn--primario btn--sm"
      onClick={() => {
        window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: id }));
        document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {label}
    </button>
  );
}
