-- Messages privés (MP) entre joueurs.
-- Lisibles uniquement par l'expéditeur et le destinataire ; les modérateurs ne voient que les MP signalés
-- (copie du texte dans le signalement). Supprimés automatiquement au bout de 90 jours.

create table public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index direct_messages_inbox on public.direct_messages (recipient_id, created_at desc);
create index direct_messages_outbox on public.direct_messages (sender_id, created_at desc);
create index direct_messages_unread on public.direct_messages (recipient_id) where read_at is null;

-- Refus si l'expéditeur est muet (ban du squatte ou du jeu), si l'un a bloqué l'autre, ou en cas de flood.
create function public.dm_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_banned(new.sender_id, 'chat') then
    raise exception 'BANNED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.blocks
    where (blocker_id = new.recipient_id and blocked_id = new.sender_id)
       or (blocker_id = new.sender_id and blocked_id = new.recipient_id)
  ) then
    raise exception 'BLOCKED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.direct_messages
      where sender_id = new.sender_id and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  new.created_at := now();
  new.read_at := null;
  return new;
end;
$$;

create trigger dm_before_insert
  before insert on public.direct_messages
  for each row execute function public.dm_before_insert();

-- Le destinataire ne peut que marquer un message comme lu.
create function public.dm_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.body <> old.body or new.sender_id <> old.sender_id or new.recipient_id <> old.recipient_id or new.created_at <> old.created_at then
    raise exception 'ONLY_READ_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger dm_before_update
  before update on public.direct_messages
  for each row execute function public.dm_before_update();

alter table public.direct_messages enable row level security;

create policy "lire ses MP"
  on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "envoyer un MP en son nom"
  on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid());

create policy "marquer ses MP reçus comme lus"
  on public.direct_messages for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

alter publication supabase_realtime add table public.direct_messages;

-- ============================================================ Conversations

-- Une ligne par interlocuteur : dernier message et nombre de non-lus.
create function public.dm_conversations() returns table (
  peer_id uuid,
  peer_pseudo text,
  last_body text,
  last_at timestamptz,
  last_from_me boolean,
  unread integer
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select m.*, case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as peer
    from public.direct_messages m
    where m.sender_id = auth.uid() or m.recipient_id = auth.uid()
  ),
  latest as (
    select distinct on (peer) peer, body, created_at, sender_id = auth.uid() as from_me
    from mine
    order by peer, created_at desc
  )
  select l.peer, p.pseudo, l.body, l.created_at, l.from_me,
    (select count(*)::integer from mine u where u.peer = l.peer and u.recipient_id = auth.uid() and u.read_at is null)
  from latest l
  join public.profiles p on p.id = l.peer
  order by l.created_at desc;
$$;

revoke execute on function public.dm_conversations from public, anon;
grant execute on function public.dm_conversations to authenticated;

-- ============================================================ Signalements

-- Copie du message signalé : seule fenêtre des modérateurs sur les MP (et elle survit à la purge des 90 jours).
create table public.dm_reports (
  id bigint generated always as identity primary key,
  message_id bigint references public.direct_messages on delete set null,
  reporter_id uuid not null references public.profiles on delete cascade,
  reported_id uuid not null references public.profiles on delete cascade,
  body text not null,
  sent_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 300),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

alter table public.dm_reports enable row level security;

create policy "les modérateurs lisent les signalements de MP"
  on public.dm_reports for select to authenticated using (public.is_moderator(auth.uid()));

create policy "les modérateurs traitent les signalements de MP"
  on public.dm_reports for update to authenticated
  using (public.is_moderator(auth.uid())) with check (public.is_moderator(auth.uid()));

-- Seul le destinataire peut signaler un MP reçu (le texte est recopié côté serveur, pas fourni par le client).
create function public.report_direct_message(p_message_id bigint, p_reason text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  msg public.direct_messages;
begin
  select * into msg from public.direct_messages where id = p_message_id and recipient_id = auth.uid();
  if msg.id is null then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.dm_reports (message_id, reporter_id, reported_id, body, sent_at, reason)
  values (msg.id, auth.uid(), msg.sender_id, msg.body, msg.created_at, left(coalesce(p_reason, ''), 300))
  on conflict (message_id, reporter_id) do nothing;
end;
$$;

revoke execute on function public.report_direct_message from public, anon;
grant execute on function public.report_direct_message to authenticated;

-- ============================================================ Conservation : 90 jours

select cron.schedule(
  'purge-mp-90-jours',
  '17 4 * * *',
  $$delete from public.direct_messages where created_at < now() - interval '90 days'$$
);
