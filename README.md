# Masajes AV · Landing + agenda de turnos

Landing de Masajes AV con reserva online y un panel para que Alejandra maneje su agenda.

- **Clientes**: eligen servicio → día → horario, dejan nombre y WhatsApp. El turno queda **pendiente** y el horario se bloquea al instante para que nadie más lo tome.
- **Alejandra** (`/admin`):
  - publica **los horarios de cada día** escribiéndolos como los manda por WhatsApp (`11, 14:30, 19:30`);
  - copia la semana anterior con un clic;
  - ve qué horarios están libres, pendientes o confirmados;
  - confirma o rechaza pedidos;
  - carga turnos que le piden por WhatsApp.
- **Google Calendar**: al confirmar un turno se crea el evento en su calendario. Al cancelarlo, se borra.

Stack: Next.js 15 (App Router) + Supabase (Postgres + Auth). Se publica gratis en Vercel.

---

## Cómo funciona la agenda

Alejandra no trabaja con un horario fijo: arma cada día según los pedidos y las actividades de los chicos. Por eso la agenda funciona con **horarios de inicio publicados día por día**:

| Pieza | Dónde se edita | Qué hace |
| --- | --- | --- |
| Horarios del día | Agenda → campo de cada día | Lista de horarios de inicio, ej. `9, 12, 13:30, 15`. Se puede pegar el mensaje de WhatsApp tal cual: toma solo los horarios |
| Copiar semana | Agenda → *Copiar los horarios de la semana anterior* | Suma a la semana actual los horarios de la anterior (no toca los días pasados) |
| Reglas | Ajustes → Reglas | Pausa entre turnos (30 min), anticipación mínima, hasta cuántos días se puede reservar |
| Servicios | Panel → Servicios | Crear, editar, ordenar, ocultar o eliminar; foto, descripción, duración, precio, destacado |

Reglas que aplica la base de datos:

- **Distancia mínima entre horarios**: entre dos inicios tiene que entrar el masaje más la pausa. Con 60 + 30 min, el mínimo es 1:30 h; si escribe `11, 12`, el sistema avisa que están muy juntos.
- **Turnos tomados**: un horario con turno tomado no se borra al editar la lista. Para liberarlo hay que cancelar o rechazar el turno.
- **Sin superposiciones**: una restricción de Postgres (`exclude using gist`) garantiza que dos turnos activos nunca se pisen, aunque dos personas reserven el mismo horario en el mismo segundo.

Estados de un turno: `pending` (pedido web) → `confirmed` (va a Google Calendar), o `rejected` / `cancelled` (el horario se libera).

---

## Instalación

### 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com). La región más cercana es São Paulo.
2. Ir a **SQL Editor** y ejecutar, en orden, `supabase/migrations/0001_init.sql` y después `0002_service_photos.sql` (crea el espacio para las fotos de los servicios). El 0002 se puede correr aunque ya hayas ejecutado el 0001 antes.
3. Ir a **Authentication → Sign In / Providers** y desactivar **Allow new users to sign up**. Solo Alejandra entra al panel.
4. Ir a **Authentication → Users → Add user**, crear el usuario de Alejandra con el email `av.masajes.integrales@gmail.com` y una contraseña, y marcar *Auto confirm*.
5. Darle permiso de administradora. En SQL Editor:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'av.masajes.integrales@gmail.com';
   ```
6. Copiar desde **Project Settings → API** la *Project URL* y la *anon public key*.

### 2. Google Calendar (opcional, recomendado)

Se usa una **cuenta de servicio**: no hace falta que Alejandra inicie sesión con Google en la web.

1. En [console.cloud.google.com](https://console.cloud.google.com), crear un proyecto y habilitar **Google Calendar API**.
2. Ir a **IAM y administración → Cuentas de servicio → Crear** (sin roles), y luego **Claves → Agregar clave → JSON**.
3. En el Google Calendar de Alejandra, ir a **Configuración del calendario → Compartir con personas específicas**. Agregar el email de la cuenta de servicio con el permiso **"Hacer cambios en los eventos"**.
4. Del JSON se usan `client_email` (va en `GOOGLE_SA_EMAIL`) y `private_key` (va en `GOOGLE_SA_PRIVATE_KEY`). El `GOOGLE_CALENDAR_ID` es `av.masajes.integrales@gmail.com`. El calendario a compartir es el principal de esa cuenta.

Sin estas variables todo funciona igual, solo que no sincroniza con el calendario.

### 3. Variables de entorno

Copiar `.env.example` a `.env.local` y completar los valores.

### 4. Correr y publicar

```bash
npm install
npm run dev        # http://localhost:3000  ·  panel en /admin
```

Para publicar en [Vercel](https://vercel.com):

1. Importar el repositorio.
2. Cargar las mismas variables de entorno.
3. Hacer el deploy.
4. Opcional: conectar el dominio, por ejemplo `masajesav.com.ar`.

---

## Servicios y fotos

En **Panel → Servicios** Alejandra puede crear, editar, ordenar (↑ ↓), ocultar y eliminar servicios. El orden del panel es el orden en que se ven en la web.

- **Fotos**: se suben desde el celular o la PC. El navegador las achica a 1600 px y las convierte a WebP antes de subirlas (de varios MB a unos 200 KB). Se guardan en Supabase Storage, y la web las sirve optimizadas con `next/image`.
- **Eliminar un servicio** que ya tiene turnos registrados no lo borra: lo oculta, para no perder el historial.
- **Tiempo de actualización**: los cambios se ven en la web al instante.

## Uso semanal de Alejandra

1. Entrar a `/admin` e ir a la semana siguiente.
2. Escribir los horarios de cada día, por ejemplo lunes `11, 14:30, 19:30` y martes `9, 12, 13:30, 15`, y tocar **Guardar**. Si la semana se parece a la anterior, usar **Copiar** y después ajustar.
3. Para no atender un día, dejar el campo vacío y guardar.
4. Cuando entra un pedido, aparece en **Por confirmar**.
   - **Escribir** abre WhatsApp con el cliente y un mensaje de confirmación ya armado.
   - **Confirmar** lo agrega a Google Calendar.
5. Los turnos que le piden por WhatsApp se cargan con **Agregar turno manual**.

## Estructura

```
supabase/migrations/0001_init.sql   esquema, get_slots, request_booking, set_day_slots, copy_week_slots, RLS
src/app/page.tsx                    landing (ISR cada 5 min)
src/components/Booking.tsx          widget de reserva (cliente)
src/app/api/slots/route.ts          horarios libres de una semana
src/app/actions.ts                  pedido de turno (server action)
src/app/admin/…                     panel: login, agenda semanal, servicios con fotos, ajustes
src/lib/gcal.ts                     Google Calendar (cuenta de servicio)
src/middleware.ts                   protege /admin
```

Powered by @RuloOo
