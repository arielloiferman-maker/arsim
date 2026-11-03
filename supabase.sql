create table if not exists public.beach_room_events (
  id bigint generated always as identity primary key,
  room_code text not null check (room_code ~ '^[A-F0-9]{6}$'),
  created_at timestamptz not null default now()
);

alter table public.beach_room_events enable row level security;
revoke all on public.beach_room_events from anon, authenticated;
grant insert on public.beach_room_events to service_role;
