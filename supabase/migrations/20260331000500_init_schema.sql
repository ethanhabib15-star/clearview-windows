-- Core app tables for invoices, payments, contact messages, and quote requests.
-- Safe to run multiple times.

create table if not exists public.invoices (
  id text primary key,
  number text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_number_idx on public.invoices (number);
create index if not exists invoices_updated_at_idx on public.invoices (updated_at desc);

create table if not exists public.payments (
  id text primary key,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_created_at_idx on public.payments (created_at desc);

create table if not exists public.contact_messages (
  id text primary key,
  subject text not null default 'general',
  name text,
  email text,
  phone text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_subject_idx on public.contact_messages (subject);

create table if not exists public.quote_requests (
  id text primary key,
  message_id text not null references public.contact_messages(id) on delete cascade,
  name text,
  email text,
  phone text,
  service_type text,
  budget_range text,
  project_details text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists quote_requests_created_at_idx on public.quote_requests (created_at desc);
create unique index if not exists quote_requests_message_id_uidx on public.quote_requests (message_id);

-- Keep invoices.updated_at in sync on direct updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_set_updated_at on public.invoices;
create trigger trg_invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

-- Harden direct REST access. Service-role key still has full access.
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.contact_messages enable row level security;
alter table public.quote_requests enable row level security;
