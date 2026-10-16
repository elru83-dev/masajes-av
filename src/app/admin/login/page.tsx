'use client';

import { useActionState } from 'react';
import { Mark } from '@/components/Logo';
import { signIn } from '../actions';

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="card login">
      <Mark size={56} />
      <h1 className="h2">Panel de turnos</h1>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" name="email" required autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" className="input" type="password" name="password" required autoComplete="current-password" />
      </div>
      {error && <p className="msg-error" role="alert">{error}</p>}
      <button className="btn btn--primario" type="submit" disabled={pending}>{pending ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  );
}
