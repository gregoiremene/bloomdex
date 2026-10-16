-- Retours des joueurs (suggestions, bugs), envoyés depuis le bouton 💡 de tous les écrans.
-- Chaque joueur voit ses propres retours ; les modérateurs voient et traitent tout (dashboard pour l'instant).

create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  kind text not null check (kind in ('suggestion', 'bug', 'other')),
  body text not null check (char_length(body) between 1 and 1000),
  -- Contexte ajouté par l'app, pour comprendre un bug sans poser de questions.
  screen text not null default '' check (char_length(screen) <= 100),
  platform text not null default '' check (char_length(platform) <= 20),
  app_version text not null default '' check (char_length(app_version) <= 20),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);

create index feedback_recent on public.feedback (created_at desc);

-- Anti-spam (10 retours par heure) ; statut et date imposés par le serveur.
create function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  new.status := 'new';
  new.created_at := now();
  return new;
end;
$$;

create trigger feedback_before_insert
  before insert on public.feedback
  for each row execute function public.feedback_before_insert();

alter table public.feedback enable row level security;

create policy "envoyer un retour en son nom"
  on public.feedback for insert to authenticated
  with check (user_id = auth.uid());

create policy "voir ses retours (modérateurs : tous)"
  on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_moderator(auth.uid()));

create policy "les modérateurs traitent les retours"
  on public.feedback for update to authenticated
  using (public.is_moderator(auth.uid())) with check (public.is_moderator(auth.uid()));
