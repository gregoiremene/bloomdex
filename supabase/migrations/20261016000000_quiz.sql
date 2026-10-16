-- Quiz du squatte : une question toutes les 15 min dans le chat global.
-- La question en cours s'affiche dans un bandeau (pas dans le fil) ; le premier qui écrit la bonne réponse
-- dans le chat gagne des weedlars, versés dans sa partie à sa prochaine action (fonction game).
-- Si personne ne trouve, la réponse est affichée avec la question suivante.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- ============================================================ Réglages (une seule ligne)

create table public.quiz_config (
  id boolean primary key default true check (id),
  reward integer not null default 200 check (reward >= 0),
  -- Récompenses maximum par joueur et par jour (heure de Paris).
  daily_cap integer not null default 5 check (daily_cap >= 0),
  -- Pas de question entre quiet_start h et quiet_end h (heure de Paris).
  quiet_start smallint not null default 1 check (quiet_start between 0 and 23),
  quiet_end smallint not null default 7 check (quiet_end between 0 and 23),
  -- Pas de question si personne n'a écrit depuis ce délai (chat vide = on ne parle pas tout seul).
  idle_minutes integer not null default 180 check (idle_minutes > 0)
);

insert into public.quiz_config default values;

alter table public.quiz_config enable row level security;
-- Aucune politique : lecture et écriture réservées au serveur (et au dashboard).

-- ============================================================ Banque de questions

create table public.quiz_questions (
  id bigint generated always as identity primary key,
  question text not null check (char_length(question) between 5 and 300),
  -- Réponses acceptées ; la première est celle qu'on affiche. Comparées sans casse, accents, ponctuation ni article.
  answers text[] not null check (cardinality(answers) >= 1),
  category text not null default 'culture',
  active boolean not null default true,
  last_asked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.quiz_questions enable row level security;

create policy "les modérateurs gèrent les questions"
  on public.quiz_questions for all to authenticated
  using (public.is_moderator(auth.uid())) with check (public.is_moderator(auth.uid()));

-- ============================================================ Manches

create table public.quiz_rounds (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.quiz_questions on delete cascade,
  asked_at timestamptz not null default now(),
  -- Fermée quand la question suivante arrive (ou à l'heure du calme).
  closed_at timestamptz,
  winner_id uuid references public.profiles on delete set null,
  winner_pseudo text,
  won_at timestamptz
);

create index quiz_rounds_recent on public.quiz_rounds (asked_at desc);

alter table public.quiz_rounds enable row level security;

-- Pas de réponse dans cette table : les joueurs peuvent la lire (et suivre ses changements en temps réel).
create policy "manches visibles"
  on public.quiz_rounds for select to authenticated using (true);

alter publication supabase_realtime add table public.quiz_rounds;

-- ============================================================ Récompenses en attente

create table public.quiz_rewards (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  round_id bigint not null references public.quiz_rounds on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  -- Rempli quand la fonction game verse la récompense dans la partie.
  claimed_at timestamptz
);

create index quiz_rewards_pending on public.quiz_rewards (user_id) where claimed_at is null;

alter table public.quiz_rewards enable row level security;
-- Aucune politique : géré par le serveur.

-- ============================================================ Messages du bot dans le chat

-- Les messages du bot n'ont pas d'auteur.
alter table public.chat_messages
  add column kind text not null default 'player' check (kind in ('player', 'quiz')),
  alter column user_id drop not null,
  add constraint chat_messages_author check (kind = 'quiz' or user_id is not null);

-- Seul le serveur peut écrire au nom du bot (drapeau de session posé par quiz_bot_say).
create or replace function public.chat_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'quiz' and current_setting('weedapp.quiz_bot', true) = 'on' then
    new.user_id := null;
    new.pseudo := 'Quiz du squatte';
    new.created_at := now();
    return new;
  end if;
  new.kind := 'player';
  if public.is_banned(new.user_id, 'chat') then
    raise exception 'BANNED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.chat_messages
      where user_id = new.user_id and created_at > now() - interval '10 seconds') >= 3 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  new.pseudo := (select pseudo from public.profiles where id = new.user_id);
  new.created_at := now();
  new.deleted_at := null;
  new.deleted_by := null;
  return new;
end;
$$;

create function public.quiz_bot_say(message text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('weedapp.quiz_bot', 'on', true);
  insert into public.chat_messages (kind, body) values ('quiz', message);
  perform set_config('weedapp.quiz_bot', 'off', true);
end;
$$;

revoke execute on function public.quiz_bot_say from public, anon, authenticated;

-- ============================================================ Vérification des réponses

-- Forme comparable : minuscules, sans accents, sans ponctuation, sans article en tête.
create function public.quiz_normalize(input text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(lower(extensions.unaccent(input)), '[^a-z0-9]+', ' ', 'g'),
      '^\s*(le|la|les|l|un|une|des|du|de|d|the)\s+', ''),
    '\s+', '', 'g');
$$;

-- Après chaque message de joueur : bonne réponse à la manche ouverte ? Le premier gagne.
create function public.quiz_check_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.quiz_config;
  v_round bigint;
  v_answer text;
  today_wins integer;
begin
  if new.kind <> 'player' then
    return null;
  end if;

  select r.id, q.answers[1] into v_round, v_answer
  from public.quiz_rounds r
  join public.quiz_questions q on q.id = r.question_id
  where r.closed_at is null and r.winner_id is null
    and public.quiz_normalize(new.body) = any (select public.quiz_normalize(a) from unnest(q.answers) a)
  order by r.asked_at desc
  limit 1;
  if v_round is null then
    return null;
  end if;

  -- « where winner_id is null » : si deux joueurs répondent en même temps, un seul gagne.
  update public.quiz_rounds
  set winner_id = new.user_id, winner_pseudo = new.pseudo, won_at = now()
  where id = v_round and winner_id is null;
  if not found then
    return null;
  end if;

  select * into cfg from public.quiz_config;
  select count(*) into today_wins
  from public.quiz_rewards
  where user_id = new.user_id
    and (created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;

  if today_wins < cfg.daily_cap and cfg.reward > 0 then
    insert into public.quiz_rewards (user_id, round_id, amount) values (new.user_id, v_round, cfg.reward);
    perform public.quiz_bot_say(format('🎉 %s a trouvé : « %s » ! +%s Wl', new.pseudo, v_answer, cfg.reward));
  else
    perform public.quiz_bot_say(format('🎉 %s a trouvé : « %s » ! (plafond de %s gains par jour atteint)', new.pseudo, v_answer, cfg.daily_cap));
  end if;
  return null;
end;
$$;

create trigger quiz_check_answer
  after insert on public.chat_messages
  for each row execute function public.quiz_check_answer();

-- ============================================================ Question toutes les 15 min

create function public.quiz_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.quiz_config;
  paris_hour integer := extract(hour from now() at time zone 'Europe/Paris');
  v_question bigint;
begin
  select * into cfg from public.quiz_config;

  -- La manche précédente se ferme : sa réponse sera affichée avec la question suivante.
  update public.quiz_rounds set closed_at = now() where closed_at is null;

  if (cfg.quiet_start < cfg.quiet_end and paris_hour >= cfg.quiet_start and paris_hour < cfg.quiet_end)
     or (cfg.quiet_start > cfg.quiet_end and (paris_hour >= cfg.quiet_start or paris_hour < cfg.quiet_end)) then
    return;
  end if;
  if not exists (
    select 1 from public.chat_messages
    where kind = 'player' and created_at > now() - make_interval(mins => cfg.idle_minutes)
  ) then
    return;
  end if;

  -- Les questions jamais posées ou posées il y a le plus longtemps d'abord : on fait le tour de la banque.
  select id into v_question
  from public.quiz_questions
  where active
  order by last_asked_at nulls first, random()
  limit 1;
  if v_question is null then
    return;
  end if;

  update public.quiz_questions set last_asked_at = now() where id = v_question;
  insert into public.quiz_rounds (question_id) values (v_question);
end;
$$;

revoke execute on function public.quiz_tick from public, anon, authenticated;

select cron.schedule('quiz-du-squatte', '*/15 * * * *', $$select public.quiz_tick()$$);

-- ============================================================ Bandeau du chat

-- Question en cours (sans la réponse tant que personne n'a trouvé) et réponse de la précédente.
create function public.quiz_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  cfg public.quiz_config;
  cur record;
  prev record;
begin
  select * into cfg from public.quiz_config;

  select r.id, r.asked_at, r.winner_pseudo, q.question, q.answers[1] as answer into cur
  from public.quiz_rounds r join public.quiz_questions q on q.id = r.question_id
  where r.closed_at is null
  order by r.asked_at desc limit 1;

  select r.id, r.winner_pseudo, q.question, q.answers[1] as answer into prev
  from public.quiz_rounds r join public.quiz_questions q on q.id = r.question_id
  where r.closed_at is not null
  order by r.asked_at desc limit 1;

  return jsonb_build_object(
    'reward', cfg.reward,
    'quietStart', cfg.quiet_start,
    'quietEnd', cfg.quiet_end,
    'current', case when cur.id is null then null else jsonb_build_object(
      'id', cur.id,
      'question', cur.question,
      'askedAt', cur.asked_at,
      'winner', cur.winner_pseudo,
      'answer', case when cur.winner_pseudo is null then null else cur.answer end
    ) end,
    'previous', case when prev.id is null then null else jsonb_build_object(
      'question', prev.question,
      'answer', prev.answer,
      'winner', prev.winner_pseudo
    ) end
  );
end;
$$;

revoke execute on function public.quiz_status from public, anon;
grant execute on function public.quiz_status to authenticated;

-- ============================================================ Versement (fonction game)

-- Marque les récompenses en attente comme versées et les renvoie (appel serveur uniquement).
create function public.claim_quiz_rewards(uid uuid) returns table (id bigint, amount integer)
language sql security definer set search_path = '' as $$
  update public.quiz_rewards r set claimed_at = now()
  where r.user_id = uid and r.claimed_at is null
  returning r.id, r.amount;
$$;

-- Annule un versement si la sauvegarde de la partie a échoué.
create function public.release_quiz_rewards(ids bigint[]) returns void
language sql security definer set search_path = '' as $$
  update public.quiz_rewards set claimed_at = null where id = any (ids);
$$;

revoke execute on function public.claim_quiz_rewards from public, anon, authenticated;
revoke execute on function public.release_quiz_rewards from public, anon, authenticated;
