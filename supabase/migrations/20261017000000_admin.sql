-- Page admin : les admins (et eux seuls, pas les modérateurs) lisent la partie de tous les joueurs.
-- Lecture seule : aucune écriture n'est ouverte, les parties ne changent que par la fonction game.

create function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = uid), false);
$$;

create policy "les admins lisent toutes les parties"
  on public.player_states for select to authenticated
  using (public.is_admin(auth.uid()));
