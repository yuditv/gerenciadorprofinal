-- Account members (internal attendants)
create table if not exists public.account_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  unique (owner_id, member_id)
);

alter table public.account_members enable row level security;

-- Permissions specific to the Inbox for each attendant
create table if not exists public.account_member_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  member_id uuid not null,
  can_send boolean not null default true,
  can_transfer boolean not null default true,
  can_manage_labels_macros boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, member_id)
);

alter table public.account_member_permissions enable row level security;

-- Helper: resolve the owner account for any logged-in user (owner or attendant)
create or replace function public.account_owner_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.account_members where member_id = p_user_id limit 1),
    p_user_id
  );
$$;

-- RLS: account_members
create policy "Owners can manage their members"
on public.account_members
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Members can view their own membership"
on public.account_members
for select
to authenticated
using (auth.uid() = member_id);

-- RLS: account_member_permissions
create policy "Owners can manage member permissions"
on public.account_member_permissions
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Members can view their own permissions"
on public.account_member_permissions
for select
to authenticated
using (auth.uid() = member_id);

-- ===== Update Inbox-related policies to allow attendants to access owner's Inbox safely =====

-- Conversations
drop policy if exists "Users can view conversations from their instances" on public.conversations;
create policy "Users can view conversations from their instances"
on public.conversations
for select
to authenticated
using (
  (
    exists (
      select 1 from public.whatsapp_instances wi
      where wi.id = conversations.instance_id
        and wi.user_id = auth.uid()
    )
  )
  or (
    conversations.assigned_to = auth.uid()
    and exists (
      select 1 from public.whatsapp_instances wi
      where wi.id = conversations.instance_id
        and wi.user_id = public.account_owner_id(auth.uid())
    )
  )
  or public.is_admin(auth.uid())
);

drop policy if exists "Users can update conversations they have access to" on public.conversations;
create policy "Users can update conversations they have access to"
on public.conversations
for update
to authenticated
using (
  (
    exists (
      select 1 from public.whatsapp_instances wi
      where wi.id = conversations.instance_id
        and wi.user_id = auth.uid()
    )
  )
  or (
    conversations.assigned_to = auth.uid()
    and exists (
      select 1 from public.whatsapp_instances wi
      where wi.id = conversations.instance_id
        and wi.user_id = public.account_owner_id(auth.uid())
    )
  )
  or public.is_admin(auth.uid())
);

-- Chat inbox messages
drop policy if exists "Users can view messages from accessible conversations" on public.chat_inbox_messages;
create policy "Users can view messages from accessible conversations"
on public.chat_inbox_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.whatsapp_instances wi on wi.id = c.instance_id
    where c.id = chat_inbox_messages.conversation_id
      and (
        wi.user_id = auth.uid()
        or (
          c.assigned_to = auth.uid()
          and wi.user_id = public.account_owner_id(auth.uid())
        )
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists "Users can insert messages to accessible conversations" on public.chat_inbox_messages;
create policy "Users can insert messages to accessible conversations"
on public.chat_inbox_messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations c
    join public.whatsapp_instances wi on wi.id = c.instance_id
    where c.id = chat_inbox_messages.conversation_id
      and (
        wi.user_id = auth.uid()
        or (
          c.assigned_to = auth.uid()
          and wi.user_id = public.account_owner_id(auth.uid())
        )
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists "Users can update messages in accessible conversations" on public.chat_inbox_messages;
create policy "Users can update messages in accessible conversations"
on public.chat_inbox_messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.whatsapp_instances wi on wi.id = c.instance_id
    where c.id = chat_inbox_messages.conversation_id
      and (
        wi.user_id = auth.uid()
        or (
          c.assigned_to = auth.uid()
          and wi.user_id = public.account_owner_id(auth.uid())
        )
        or public.is_admin(auth.uid())
      )
  )
);

drop policy if exists "Users can delete messages from accessible conversations" on public.chat_inbox_messages;
create policy "Users can delete messages from accessible conversations"
on public.chat_inbox_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.whatsapp_instances wi on wi.id = c.instance_id
    where c.id = chat_inbox_messages.conversation_id
      and (
        wi.user_id = auth.uid()
        or (
          c.assigned_to = auth.uid()
          and wi.user_id = public.account_owner_id(auth.uid())
        )
        or public.is_admin(auth.uid())
      )
  )
);

-- Conversation labels
drop policy if exists "Users can manage labels on accessible conversations" on public.conversation_labels;
create policy "Users can manage labels on accessible conversations"
on public.conversation_labels
for all
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.whatsapp_instances wi on wi.id = c.instance_id
    where c.id = conversation_labels.conversation_id
      and (
        wi.user_id = auth.uid()
        or (
          c.assigned_to = auth.uid()
          and wi.user_id = public.account_owner_id(auth.uid())
        )
        or public.is_admin(auth.uid())
      )
  )
);

-- inbox_labels: owner full; attendants read-only
drop policy if exists "Users can manage own labels" on public.inbox_labels;
create policy "Owners can manage own labels"
on public.inbox_labels
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Members can view owner labels"
on public.inbox_labels
for select
to authenticated
using (user_id = public.account_owner_id(auth.uid()));

-- whatsapp_instances: attendants read-only (so Inbox can load instances)
create policy "Members can view owner instances"
on public.whatsapp_instances
for select
to authenticated
using (user_id = public.account_owner_id(auth.uid()));

-- inbox_teams: owner full; attendants can view
drop policy if exists "Users can manage own teams" on public.inbox_teams;
create policy "Owners can manage own teams"
on public.inbox_teams
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Members can view owner teams"
on public.inbox_teams
for select
to authenticated
using (user_id = public.account_owner_id(auth.uid()));

-- inbox_team_members: owner full; attendants can view rows for owner's teams
-- (keep existing owner policy name; re-create for consistency)
drop policy if exists "Users can manage team members for own teams" on public.inbox_team_members;
create policy "Owners can manage team members for own teams"
on public.inbox_team_members
for all
to authenticated
using (
  exists (
    select 1 from public.inbox_teams t
    where t.id = inbox_team_members.team_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.inbox_teams t
    where t.id = inbox_team_members.team_id
      and t.user_id = auth.uid()
  )
);

create policy "Members can view team membership"
on public.inbox_team_members
for select
to authenticated
using (
  exists (
    select 1 from public.inbox_teams t
    where t.id = inbox_team_members.team_id
      and t.user_id = public.account_owner_id(auth.uid())
  )
);
