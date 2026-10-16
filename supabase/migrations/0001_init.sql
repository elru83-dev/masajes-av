-- =====================================================================
-- Masajes AV · esquema inicial
-- Agenda por horarios publicados día a día + reservas sin superposición
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuración general (una sola fila)
-- ---------------------------------------------------------------------
create table public.settings (
  id               smallint primary key default 1 check (id = 1),
  tz               text     not null default 'America/Argentina/Buenos_Aires',
  buffer_min       smallint not null default 30 check (buffer_min between 0 and 120),
  min_notice_hours smallint not null default 3  check (min_notice_hours between 0 and 72),
  max_days_ahead   smallint not null default 30 check (max_days_ahead between 1 and 120)
);

-- ---------------------------------------------------------------------
-- Servicios
-- ---------------------------------------------------------------------
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  slug         text     not null unique,
  name         text     not null,
  category     text     not null default '',
  description  text     not null default '',
  duration_min smallint not null default 60 check (duration_min between 15 and 240),
  price        numeric(10,2),
  featured     boolean  not null default false,
  active       boolean  not null default true,
  sort         smallint not null default 0
);

-- ---------------------------------------------------------------------
-- Horarios publicados: cada fila es un horario de inicio que Alejandra
-- ofrece (ej. lunes 11:00, 14:30 y 19:30). Solo estos se pueden reservar.
-- ---------------------------------------------------------------------
create table public.slots (
  starts_at  timestamptz primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid        not null references public.services (id),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  period        tstzrange   generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  client_name   text        not null check (length(client_name) between 2 and 80),
  client_phone  text        not null check (client_phone ~ '^[0-9]{8,15}$'),
  client_email  text        check (client_email is null or client_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes         text        not null default '' check (length(notes) <= 500),
  status        text        not null default 'pending'
                            check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  gcal_event_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Garantía a nivel base de datos: dos turnos activos nunca se pisan,
  -- aunque dos personas reserven el mismo horario en el mismo instante.
  constraint bookings_no_overlap
    exclude using gist (period with &&) where (status in ('pending', 'confirmed'))
);
create index bookings_starts_at_idx on public.bookings (starts_at);
create index bookings_phone_pending_idx on public.bookings (client_phone) where status = 'pending';

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Administradoras del panel
-- ---------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- =====================================================================
-- Horarios libres para la web
-- Publicados − tomados (con la pausa entre turnos) − anticipación mínima
-- =====================================================================
create or replace function public.get_slots(p_service_id uuid, p_from date, p_to date)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql stable security definer set search_path = public as $$
  with cfg as (
    select tz,
           make_interval(mins => buffer_min)                   as buf,
           now() + make_interval(hours => min_notice_hours)    as earliest,
           (now() at time zone tz)::date + max_days_ahead + 1  as stop_day
    from settings where id = 1
  ),
  svc as (
    select make_interval(mins => duration_min) as dur
    from services where id = p_service_id and active
  )
  select s.starts_at, s.starts_at + v.dur
  from cfg c
  cross join svc v
  join slots s
    on s.starts_at >= greatest(p_from::timestamp at time zone c.tz, c.earliest)
   and s.starts_at <  (least(p_to + 1, c.stop_day))::timestamp at time zone c.tz
  where not exists (
    select 1 from bookings b
    where b.status in ('pending', 'confirmed')
      and b.period && tstzrange(s.starts_at - c.buf, s.starts_at + v.dur + c.buf)
  )
  order by s.starts_at;
$$;

-- =====================================================================
-- Pedido de turno desde la web (queda pendiente de confirmación)
-- =====================================================================
create or replace function public.request_booking(
  p_service_id uuid,
  p_start      timestamptz,
  p_name       text,
  p_phone      text,
  p_email      text default null,
  p_notes      text default null
)
returns table (booking_id uuid, booking_start timestamptz, booking_end timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_tz    text;
  v_day   date;
  v_end   timestamptz;
  v_id    uuid;
  v_name  text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_notes text := left(btrim(coalesce(p_notes, '')), 500);
begin
  if length(v_name) not between 2 and 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone !~ '^[0-9]{8,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if (select count(*) from bookings
      where client_phone = v_phone and status = 'pending' and starts_at > now()) >= 2 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;

  select tz into v_tz from settings where id = 1;
  v_day := (p_start at time zone v_tz)::date;

  select s.slot_end into v_end
  from get_slots(p_service_id, v_day, v_day) s
  where s.slot_start = p_start;

  if v_end is null then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  begin
    insert into bookings (service_id, starts_at, ends_at, client_name, client_phone, client_email, notes)
    values (p_service_id, p_start, v_end, v_name, v_phone, v_email, v_notes)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end;

  return query select v_id, p_start, v_end;
end $$;

-- =====================================================================
-- Panel: publicar los horarios de un día de una sola vez
-- Reemplaza los horarios libres del día por la lista nueva; los que ya
-- tienen un turno tomado se conservan siempre. Valida que entre un inicio
-- y el siguiente haya al menos (duración del masaje + pausa).
-- =====================================================================
create or replace function public.set_day_slots(p_day date, p_times time[])
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_tz    text;
  v_need  interval;
  v_from  timestamptz;
  v_to    timestamptz;
  v_final time[];
  v_prev  time;
  v_t     time;
  v_count integer;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select tz, make_interval(mins => buffer_min) into v_tz, v_need from settings where id = 1;
  select v_need + make_interval(mins => coalesce(max(duration_min), 60)) into v_need
  from services where active;

  v_from := p_day::timestamp at time zone v_tz;
  v_to   := (p_day + 1)::timestamp at time zone v_tz;

  -- Lista final = horarios nuevos ∪ horarios con turno tomado (sin repetir, ordenada)
  select coalesce(array_agg(t order by t), '{}') into v_final
  from (
    select unnest(coalesce(p_times, '{}')) as t
    union
    select (b.starts_at at time zone v_tz)::time
    from bookings b
    where b.status in ('pending', 'confirmed') and b.starts_at >= v_from and b.starts_at < v_to
  ) x;

  foreach v_t in array v_final loop
    if v_prev is not null and v_t - v_prev < v_need then
      raise exception 'slots_too_close:%-%', to_char(v_prev, 'HH24:MI'), to_char(v_t, 'HH24:MI')
        using errcode = 'P0001';
    end if;
    v_prev := v_t;
  end loop;

  delete from slots s
  where s.starts_at >= v_from and s.starts_at < v_to
    and (s.starts_at at time zone v_tz)::time <> all (v_final);

  insert into slots (starts_at)
  select (p_day + t) at time zone v_tz from unnest(v_final) t
  on conflict (starts_at) do nothing;

  select count(*) into v_count from slots s where s.starts_at >= v_from and s.starts_at < v_to;
  return v_count;
end $$;

-- Copia los horarios de una semana a otra (se suman a los que ya hubiera).
create or replace function public.copy_week_slots(p_src_monday date, p_dst_monday date)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_tz    text;
  v_day   date;
  v_times time[];
  v_total integer := 0;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select tz into v_tz from settings where id = 1;

  for i in 0..6 loop
    v_day := p_dst_monday + i;
    continue when v_day < (now() at time zone v_tz)::date;

    select array_agg(t) into v_times
    from (
      select (s.starts_at at time zone v_tz)::time as t from slots s
      where s.starts_at >= (p_src_monday + i)::timestamp at time zone v_tz
        and s.starts_at <  (p_src_monday + i + 1)::timestamp at time zone v_tz
      union
      select (s.starts_at at time zone v_tz)::time from slots s
      where s.starts_at >= v_day::timestamp at time zone v_tz
        and s.starts_at <  (v_day + 1)::timestamp at time zone v_tz
    ) x;

    if v_times is not null then
      v_total := v_total + set_day_slots(v_day, v_times);
    end if;
  end loop;
  return v_total;
end $$;

-- =====================================================================
-- Seguridad (RLS)
-- =====================================================================
alter table public.settings enable row level security;
alter table public.services enable row level security;
alter table public.slots    enable row level security;
alter table public.bookings enable row level security;
alter table public.admins   enable row level security;

create policy services_public_read on public.services
  for select using (active or public.is_admin());

create policy admin_all_settings on public.settings for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_services on public.services for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_slots    on public.slots    for all using (public.is_admin()) with check (public.is_admin());
create policy admin_all_bookings on public.bookings for all using (public.is_admin()) with check (public.is_admin());
create policy admin_read_self    on public.admins   for select using (user_id = auth.uid());

revoke all on function public.get_slots(uuid, date, date) from public;
revoke all on function public.request_booking(uuid, timestamptz, text, text, text, text) from public;
revoke all on function public.set_day_slots(date, time[]) from public;
revoke all on function public.copy_week_slots(date, date) from public;
grant execute on function public.get_slots(uuid, date, date) to anon, authenticated;
grant execute on function public.request_booking(uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.set_day_slots(date, time[]) to authenticated;
grant execute on function public.copy_week_slots(date, date) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- =====================================================================
-- Datos iniciales (editables desde el panel)
-- =====================================================================
insert into public.settings (id) values (1);

insert into public.services (slug, name, category, description, featured, sort) values
  ('relajante',         'Masaje relajante',         'Bienestar',        'Para soltar el estrés y descansar mejor.',               false, 1),
  ('descontracturante', 'Masaje descontracturante', 'Terapéutico',      'Alivio de tensiones en cuello, espalda y zona lumbar.',  false, 2),
  ('drenaje-linfatico', 'Drenaje linfático manual', 'Terapéutico',      'Técnica suave para la sensación de piernas pesadas.',    false, 3),
  ('deportivo',         'Masaje deportivo',         'Deportistas',      'Pre competencia para activar, post para recuperar.',     false, 4),
  ('embarazadas',       'Masaje para embarazadas',  'Cuidado especial', 'Posición segura y presión adaptada a cada etapa.',       true,  5);
