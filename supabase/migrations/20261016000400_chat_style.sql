-- Style des pseudos dans le squatte : couleur et badge par joueur.
-- Réglables depuis le dashboard (table profiles) : les joueurs ne peuvent pas modifier leur profil.
-- Sans réglage : admin en doré 👑, modérateurs en violet 🛡️. Base des futurs cosmétiques (weedoses).

alter table public.profiles
  add column chat_color text check (chat_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column chat_badge text check (char_length(chat_badge) <= 8);

-- Copiés dans le message à l'envoi : l'historique garde le style du moment, sans jointure à la lecture.
alter table public.chat_messages
  add column author_color text,
  add column author_badge text;

create or replace function public.chat_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  author public.profiles;
begin
  if new.kind = 'quiz' and current_setting('weedapp.quiz_bot', true) = 'on' then
    new.user_id := null;
    new.pseudo := 'Quiz du squatte';
    new.author_color := null;
    new.author_badge := null;
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
  select * into author from public.profiles where id = new.user_id;
  new.pseudo := author.pseudo;
  new.author_color := coalesce(author.chat_color, case author.role when 'admin' then '#FFC94D' when 'moderator' then '#C79BFF' end);
  new.author_badge := coalesce(author.chat_badge, case author.role when 'admin' then '👑' when 'moderator' then '🛡️' end);
  new.created_at := now();
  new.deleted_at := null;
  new.deleted_by := null;
  return new;
end;
$$;

-- Les modérateurs masquent des messages : le style ne doit pas pouvoir être modifié non plus.
create or replace function public.chat_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.body <> old.body or new.user_id <> old.user_id or new.pseudo <> old.pseudo or new.created_at <> old.created_at
     or new.author_color is distinct from old.author_color or new.author_badge is distinct from old.author_badge then
    raise exception 'ONLY_DELETION_ALLOWED' using errcode = 'P0001';
  end if;
  new.deleted_by := auth.uid();
  return new;
end;
$$;
