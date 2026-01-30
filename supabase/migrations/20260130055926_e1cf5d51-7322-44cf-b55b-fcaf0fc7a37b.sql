-- Per-user Mercado Pago credentials (encrypted)

-- Enable pgcrypto for symmetric encryption helpers
create extension if not exists pgcrypto;

create table if not exists public.user_payment_credentials (
  user_id uuid not null primary key,
  mercado_pago_access_token_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_payment_credentials enable row level security;

-- RLS: users can manage only their own credentials
create policy "Users can view own payment credentials"
on public.user_payment_credentials
for select
using (auth.uid() = user_id);

create policy "Users can insert own payment credentials"
on public.user_payment_credentials
for insert
with check (auth.uid() = user_id);

create policy "Users can update own payment credentials"
on public.user_payment_credentials
for update
using (auth.uid() = user_id);

create policy "Users can delete own payment credentials"
on public.user_payment_credentials
for delete
using (auth.uid() = user_id);

-- Updated_at trigger
create trigger update_user_payment_credentials_updated_at
before update on public.user_payment_credentials
for each row
execute function public.update_updated_at_column();