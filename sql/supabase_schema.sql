-- Esquema para Supabase (Postgres). Pegá todo este archivo en:
-- tu proyecto en supabase.com > SQL Editor > New query > Run.
--
-- Decisión de seguridad para esta etapa de prototipo: seguimos con el login
-- casero (hash propio, sin Supabase Auth). Eso significa que Postgres NO
-- puede distinguir "quién" hace cada pedido (no hay sesión real de Supabase),
-- así que:
--   - La tabla `usuarios` queda CERRADA por completo a la key pública (anon):
--     solo se puede leer/escribir a través de funciones RPC de abajo, que
--     nunca devuelven password_hash.
--   - Las tablas `mesas`, `inscripciones` y `config` quedan abiertas a la key
--     pública (cualquiera que tenga la anon key podría leerlas/escribirlas
--     directo, sin pasar por la app). Los admins solo se distinguen en la
--     interfaz (JS), no a nivel de base de datos. Esto está bien para probar
--     con el grupo de la posada, pero NO es seguridad real de producción.
--     El día que esto se abra al público en serio, conviene pasar a Supabase
--     Auth + RLS por usuario.

create extension if not exists pgcrypto;

-- ============ TABLAS ============

create table if not exists usuarios (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    apodo           text,
    email           text not null unique,
    telefono        text,
    password_hash   text not null,
    rol             text not null default 'usuario', -- 'usuario' | 'admin'
    bio             text,
    narrador        boolean not null default false,
    creado_en       timestamptz not null default now()
);

create table if not exists config (
    id                   int primary key default 1,
    nombre_posada        text not null default 'La Posada Rolera',
    ciudad               text not null default 'Puerto Madryn',
    temporada            text,
    max_mesas_activas    int not null default 5,
    constraint config_singleton check (id = 1)
);
insert into config (id) values (1) on conflict (id) do nothing;

create table if not exists mesas (
    id                      uuid primary key default gen_random_uuid(),
    nombre_mesa             text not null,
    sistema                 text not null,
    duracion                text not null,
    experiencia             text not null,
    descripcion             text,
    enfoque                 text,
    keywords                text[] default '{}',
    cupos                   int not null,
    fecha                   date not null,
    hora                    time,
    lugar                   text default 'La Posada Rolera',
    estado                  text not null default 'publicada', -- 'publicada' | 'archivada' | 'cancelada'
    creador_id              uuid references usuarios(id),
    narrador_nombre         text,
    narrador_contacto       text,
    creada_en               timestamptz not null default now()
);

create table if not exists inscripciones (
    id            uuid primary key default gen_random_uuid(),
    mesa_id       uuid not null references mesas(id) on delete cascade,
    usuario_id    uuid references usuarios(id) on delete cascade,
    tipo          text not null, -- 'cuenta' | 'invitado'
    nombre        text not null,
    contacto      text not null,
    estado        text not null default 'confirmada', -- 'pendiente' | 'confirmada' | 'cancelada'
    creada_en     timestamptz not null default now(),
    unique (mesa_id, usuario_id)
);

create index if not exists idx_mesas_estado_fecha on mesas (estado, fecha);
create index if not exists idx_inscripciones_mesa on inscripciones (mesa_id);

-- ============ RLS ============

alter table usuarios enable row level security;
alter table mesas enable row level security;
alter table inscripciones enable row level security;
alter table config enable row level security;

-- usuarios: sin políticas para anon → bloqueado por completo salvo por las
-- funciones RPC (que corren con permisos de su dueño, no del que llama).
drop policy if exists "mesas anon all" on mesas;
create policy "mesas anon all" on mesas for all to anon using (true) with check (true);

drop policy if exists "inscripciones anon all" on inscripciones;
create policy "inscripciones anon all" on inscripciones for all to anon using (true) with check (true);

drop policy if exists "config anon all" on config;
create policy "config anon all" on config for all to anon using (true) with check (true);

-- ============ FUNCIONES (acceso controlado a usuarios) ============

create or replace function rpc_registrar_usuario(
    p_nombre text, p_apodo text, p_email text, p_telefono text, p_hash text
) returns table (id uuid, nombre text, apodo text, email text, telefono text, rol text, bio text, narrador boolean, creado_en timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if exists (select 1 from usuarios u where lower(u.email) = lower(p_email)) then
        raise exception 'email_en_uso';
    end if;
    return query
    insert into usuarios (nombre, apodo, email, telefono, password_hash, rol)
    values (trim(p_nombre), trim(coalesce(p_apodo, '')), lower(trim(p_email)), trim(coalesce(p_telefono, '')), p_hash, 'usuario')
    returning usuarios.id, usuarios.nombre, usuarios.apodo, usuarios.email, usuarios.telefono, usuarios.rol, usuarios.bio, usuarios.narrador, usuarios.creado_en;
end;
$$;

create or replace function rpc_login_usuario(p_email text, p_hash text)
returns table (id uuid, nombre text, apodo text, email text, telefono text, rol text, bio text, narrador boolean, creado_en timestamptz)
language sql security definer set search_path = public as $$
    select u.id, u.nombre, u.apodo, u.email, u.telefono, u.rol, u.bio, u.narrador, u.creado_en
    from usuarios u
    where lower(u.email) = lower(p_email) and u.password_hash = p_hash;
$$;

create or replace function rpc_obtener_usuario(p_id uuid)
returns table (id uuid, nombre text, apodo text, email text, telefono text, rol text, bio text, narrador boolean, creado_en timestamptz)
language sql security definer set search_path = public as $$
    select u.id, u.nombre, u.apodo, u.email, u.telefono, u.rol, u.bio, u.narrador, u.creado_en
    from usuarios u where u.id = p_id;
$$;

create or replace function rpc_listar_usuarios()
returns table (id uuid, nombre text, apodo text, email text, telefono text, rol text, bio text, narrador boolean, creado_en timestamptz)
language sql security definer set search_path = public as $$
    select u.id, u.nombre, u.apodo, u.email, u.telefono, u.rol, u.bio, u.narrador, u.creado_en
    from usuarios u order by u.creado_en asc;
$$;

create or replace function rpc_actualizar_perfil(
    p_id uuid, p_nombre text, p_apodo text, p_email text, p_telefono text, p_bio text, p_narrador boolean
) returns table (id uuid, nombre text, apodo text, email text, telefono text, rol text, bio text, narrador boolean, creado_en timestamptz)
language plpgsql security definer set search_path = public as $$
begin
    if exists (select 1 from usuarios u where lower(u.email) = lower(p_email) and u.id <> p_id) then
        raise exception 'email_en_uso';
    end if;
    return query
    update usuarios u set nombre = p_nombre, apodo = p_apodo, email = lower(p_email), telefono = p_telefono, bio = p_bio, narrador = p_narrador
    where u.id = p_id
    returning u.id, u.nombre, u.apodo, u.email, u.telefono, u.rol, u.bio, u.narrador, u.creado_en;
end;
$$;

create or replace function rpc_cambiar_password(p_id uuid, p_hash_actual text, p_hash_nuevo text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from usuarios u where u.id = p_id and u.password_hash = p_hash_actual) then
        return false;
    end if;
    update usuarios u set password_hash = p_hash_nuevo where u.id = p_id;
    return true;
end;
$$;

create or replace function rpc_cambiar_rol(p_id uuid, p_rol text)
returns void language sql security definer set search_path = public as $$
    update usuarios set rol = p_rol where id = p_id;
$$;

create or replace function rpc_eliminar_usuario(p_id uuid)
returns void language sql security definer set search_path = public as $$
    delete from usuarios where id = p_id;
$$;

-- El anon key puede EJECUTAR estas funciones (que sí controlan qué se expone),
-- aunque no pueda leer la tabla usuarios directamente.
grant execute on function rpc_registrar_usuario, rpc_login_usuario, rpc_obtener_usuario,
    rpc_listar_usuarios, rpc_actualizar_perfil, rpc_cambiar_password, rpc_cambiar_rol,
    rpc_eliminar_usuario to anon;

-- ============ Datos semilla (opcional, mismos usuarios demo de antes) ============
-- Los hashes de acá corresponden a "admin123" y "demo123" con el algoritmo
-- casero de js/storage.js. Si preferís no tener estas cuentas de prueba,
-- borrá este bloque antes de correr el script.
insert into usuarios (nombre, apodo, email, telefono, password_hash, rol, bio, narrador)
values
    ('Admin Posada', 'Posadero', 'admin@posadarolera.com', '', 'h20397489', 'admin', 'Cuenta administradora semilla del prototipo.', true),
    ('Jugadora Demo', 'Rolera Demo', 'demo@posadarolera.com', '', 'h-1464501631', 'usuario', '', false)
on conflict (email) do nothing;
