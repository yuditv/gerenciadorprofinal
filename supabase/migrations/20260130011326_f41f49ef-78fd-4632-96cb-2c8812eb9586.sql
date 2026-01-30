alter table public.account_members
  add column if not exists member_email text null;

alter table public.account_members
  add column if not exists member_name text null;
