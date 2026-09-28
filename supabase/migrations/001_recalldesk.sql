create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  email text not null,
  plan text not null,
  environment text not null,
  status text not null default 'Needs attention',
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null,
  description text not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'Open' check (status in ('Open', 'Investigating', 'Waiting', 'Resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists tickets_customer_id_idx on public.tickets(customer_id);
create index if not exists messages_ticket_id_idx on public.messages(ticket_id);
create index if not exists ticket_events_ticket_id_idx on public.ticket_events(ticket_id);

alter table public.customers enable row level security;
alter table public.tickets enable row level security;
alter table public.messages enable row level security;
alter table public.ticket_events enable row level security;
