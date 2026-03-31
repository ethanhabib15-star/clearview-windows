-- Run this in Supabase SQL editor.

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
