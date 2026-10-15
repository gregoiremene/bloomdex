# WeedApp — jeu mobile de culture/gestion inspiré de Weed-Land.net

Langue du projet : **français** (UI, docs, échanges). Code et identifiants en anglais.

- Référence complète du jeu original (règles, chiffres, tables) : [docs/weedland-reference.md](docs/weedland-reference.md)
- Ce fichier = vision, périmètre V0, architecture. À tenir à jour quand une décision change.

## Vision

Un tycoon de culture **mobile**, sessions courtes, qui garde l'ADN de Weed-Land (cultiver → récolter → dealer → risque police → grandir)
mais supprime sa micro-gestion pénible. Les chiffres du jeu original servent de **calibrage de départ**, pas de contrat.

Principes :
1. **Un vrai jeu dont on s'occupe chaque jour, en sessions courtes** : **2 sessions/jour** (matin dans les transports, soir), 2-5 min chacune. Chaque session a des tâches utiles (arroser, engrais, insecticide, planter les germes, jeter les mâles, lancer/relever une vente, déposer à la banque). Les notifications rappellent quoi faire.
2. **Cycle de culture complet = ~1 semaine réelle** (comme l'original). `GAME_SPEED = 1`. Les consommations d'eau/engrais sont calibrées pour qu'**un intervalle de ~12 h soit sûr** et qu'on tienne ~18-24 h avant la mort (une session ratée ne tue pas tout).
3. **Actions groupées** par défaut (arroser toute la salle, planter les N germes les plus rapides) ; le plant par plant reste possible.
4. **Multijoueur social dès la V0** : on joue entre potes (chat, vols, gardes). Serveur autoritaire.
5. Pas d'apologie : univers cartoon/satirique, 100 % fictif, rappel légal au premier lancement, âge 17+/18+.

## Périmètre V0 (en ligne, entre potes)

**Dans la V0**
- Comptes joueurs (pseudo), **un seul monde global** (à découper en mondes/serveurs plus tard si la population l'exige).
- Habitations : **les 7** (Chambre → Cabane → Maisonnette → Maison → Villa → Fermette → Laboratoire), achat niveau par niveau. Seule la culture indoor en V0 (jardins outdoor en V1).
- Culture indoor complète : germination (indice de développement aléatoire), végétation, floraison, séchage ; eau/engrais avec plancher 0 et plafond (surdose) ; rempotage ; éclairage 18 h / 12 h ; sexe aléatoire, mâles & pollinisation → graines ; pucerons + insecticide ; geler/dégeler.
- Matériel avec capacité (lampes/radiateurs/ventilateurs en « plants couverts ») ; pénalité si sous-équipé. (Usure/pannes : V1.)
- Boutique : graines (14 variétés), terreau, engrais végé/flo, insecticide, pots, lampes, radiateurs, ventilateurs, kits de germination.
- Vente dans les **12 lieux** (horaires, risque, rente, capacité/h) + **indice police** plafonné par l'habitation, descente des stups, **Sarcasto**.
- **Prix dynamiques** simulés (réévaluation périodique par variété).
- **Impôts hebdo** (habitation, eau, électricité, **ISF** sur la bourse) + **métiers** (13).
- **Banque : un seul livret** (dépôt/retrait avec frais, intérêts hebdo, plafond). Indispensable : l'argent en bourse subit l'ISF et les voleurs.
- **Vols entre joueurs + gardes du corps** (règles de l'original : 10 % max de la bourse, 3 attaques/jour, pas d'attaque vers plus petite habitation, < Maison inattaquable). **Détective** (dossier sur un joueur) : faible coût, à décider.
- **Chat global (squatte)** temps réel, avec signalement + blocage d'un joueur (exigé par les stores pour le contenu généré par les utilisateurs).
- **Modération** : rôle admin/modérateur ; **ban temporaire** (durée au choix, motif) qui coupe le chat et/ou l'accès au jeu ; suppression de message ; file des signalements. Modération manuelle par l'équipe au lancement.
- **Départ** : petit stock de beuh offert (~150 g, à équilibrer) + tutoriel, pour pouvoir vendre dès le jour 1 malgré l'absence de grossiste et la 1ʳᵉ récolte à J+7.
- Journal des 50 dernières actions (dont vols subis/tentés) ; notifications push (soif, passage de stade, séchage fini, vente terminée, indice police critique, vol subi, impôts).

**V1** : grossiste PNJ, outdoor + météo + citerne + solaire/éolien, shit (conversion 24 h, −20 %), usure matériel + CO2, livrets B/C/D, véhicules + cachette, jardinier, casino/loterie, quizz du squatte, succès/quêtes.

**V2** : marché entre joueurs + ventes directes, prix par l'offre réelle, alliances, MP, classements multi-mondes, saisons (reset), monétisation.

**Hors périmètre** : paris sportifs réels, pubs joueurs, parrainage.

## Architecture technique (validée le 2026-09-30)

- **Expo (React Native) + TypeScript**, Expo Router pour la navigation.
- **Moteur de simulation pur TS** (`packages/engine/`) : aucune dépendance UI/React/réseau, fonctions pures `state + temps → state`, testé avec Vitest. **Partagé** entre le serveur (autorité) et le client (affichage/projection).
- **Backend : Supabase** — Auth, Postgres (état joueur + monde), **Realtime** (chat, notifications en jeu), **Edge Functions** (toutes les actions de jeu passent par le serveur : arroser, vendre, voler, déposer…), **pg_cron** (impôts du lundi, intérêts, réévaluation des prix).
- **Évaluation paresseuse** : chaque joueur a `lastTickAt` ; avant toute action le concernant (la sienne, ou un vol contre lui), le serveur rejoue ses actualisations horaires manquées via `advance(state, now)` (déterministe, RNG seedé dans l'état). Pas besoin d'un tick global toutes les heures.
- Client : **Zustand** + cache local, affichage optimiste recalculé avec le même moteur.
- Notifications : **push** (expo-notifications + envoi serveur) pour les événements causés par d'autres joueurs (vols, chat) ; locales pour les rappels prévisibles (soif, séchage).
- Données de jeu (variétés, habitations, lieux, matériel, métiers, banque) en **fichiers de config typés** (`packages/engine/src/data/`) → équilibrage sans toucher au code.

```
apps/mobile/src/      # app Expo (SDK 54, RN 0.81) — vérifier la doc Expo v54 (docs.expo.dev/versions/v54.0.0/) avant toute API
  app/            # écrans Expo Router : (tabs)/ index (exploitation), shop, sell, bank, chat, more ; housing, jobs, players, journal, login
  game/           # client de jeu (Supabase ou démo locale), store zustand, libellés FR
  auth/           # session Supabase + profil (rôle)
  lib/supabase.ts # client (null si non configuré → mode démo hors ligne)
  notifications.ts# rappels locaux (projection du moteur) + jeton push
  ui/             # thème et composants
packages/engine/src/  # partagé client + serveur (aucune dépendance, imports en .ts explicites)
  data/           # varieties, housings, equipment, places, jobs, balance
  systems/        # actualisation horaire : growth, sales (+ police), market, economy (impôts, intérêts)
  actions/        # actions joueur pures : shop, culture, economy, pvp ; dispatch.ts = parseAction + applyAction
  advance.ts      # rattrapage des actualisations horaires manquées
  clock.ts        # heure du jeu (Europe/Paris)
supabase/
  migrations/     # schéma SQL + RLS
  functions/      # game (action joueur), pvp (vol, détective) ; _shared/engine = copie générée (npm run sync:engine)
docs/
  weedland-reference.md
```

## Commandes
- `npm test` : tests de tous les workspaces (Vitest) · `npm run typecheck`
- `npm test -w @weedapp/engine` : tests du moteur seul
- `npm run functions:check` : copie le moteur dans les fonctions et vérifie leur typage (Deno)
- `npm run functions:deploy` · `npm run db:push` : déploiement Supabase (projet lié)
- `npm run ios -w @weedapp/mobile` : build natif + simulateur · `npx expo export` (dans apps/mobile) : vérifie le bundle
- `npm run web:deploy -w @weedapp/mobile` : export web + déploiement EAS Hosting (`<nom>.expo.app`)
- Mise en route complète : [README.md](README.md)

## Conventions
- Les actions ne modifient jamais l'état reçu : elles clonent, puis renvoient le nouvel état ou lèvent une `GameError` (code métier).
- Toute règle de jeu vit dans `engine/` + `data/`, jamais dans les composants.
- Toute valeur d'équilibrage vient de `data/` (pas de nombres magiques dans le moteur).
- Chaque système du moteur a ses tests unitaires (croissance, surdose/mort, vente/indice, impôts).
- Monnaie : weedlars (`Wl`) — nom définitif du jeu et de la monnaie à trouver (ne pas réutiliser la marque « Weed-Land »).

## Décisions ouvertes
- Nom du jeu / DA (cartoon ? pixel ?), thème final (cannabis assumé vs reskin plus neutre selon politiques App Store / Play Store).
- Quantité exacte du stock de départ (150 g de Super Skunk pour l'instant).
- Formules provisoires à équilibrer en jeu : baisse de l'indice police (2,5 % du max/h), réussite d'un vol (voleurs / (voleurs + gardes)), part volée (5-10 %), échelle de prix de revente redistribuée toutes les 6 semaines (7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 2, 2), saturation par joueur (−10 % / 3 000 g vendus d'une variété, plancher −50 %), livret unique (1,5 %/sem., plafond 25 M), électricité/eau.

## Décisions prises
- 2026-09-30 : cycle complet ~1 semaine, 2 sessions courtes/jour (pas de cycle compressé à 1 jour).
- 2026-09-30 : en V0 → chat global, banque à 1 livret, vols + gardes, les 7 habitations ; grossiste repoussé en V1.
- 2026-09-30 : stack Expo + Supabase + moteur TS partagé ; **un seul monde et un chat global** (pas de mondes privés) ; modération manuelle avec ban temporaire ; stock de départ offert.
- 2026-10-07 : ISF calculé sur la part de la bourse au-dessus du seuil (pas de cliff) ; au passage en floraison, eau/engrais convertis pour garder la même autonomie ; « Disney Village » renommé « Parc d'attractions » (pas de marque).
- 2026-10-07 : le jeu doit aussi être jouable sur le web (export Metro `single`, hébergement EAS Hosting) ; pas de notifications sur le web.
- 2026-10-10 : projet rétrogradé de SDK 57 à **SDK 54** (Expo Go de l'utilisateur·rice en 54 ; compatible Xcode 16.1+, donc build iOS local possible).
- 2026-10-10 : développement en **Expo Go** (plus rapide) ; notifications désactivées dans Expo Go et sur le web (module chargé à la demande), réactivées automatiquement dans un dev build / build store.
- 2026-10-13 : pucerons — 1 traitement suffit en végé ; en flo la protection s'use après 36-60 h (tirage par plant et par traitement, ≈ 2 traitements par flo). Durée **jamais affichée** : seul un 🐜 signale un plant non protégé, les joueurs apprennent le rythme en jouant.
- 2026-10-13 : les germes morts occupent le kit jusqu'à ce qu'on les jette. Les plants morts restent affichés dans la salle où ils sont morts.
- 2026-10-15 : un germe meurt faute de place **48 h après son semis**, quelle que soit sa taille (remplace « 12 h à 15 cm », qui laissait vivre indéfiniment les germes lents) ; signalé « à l'étroit » ses 12 dernières heures.
- 2026-10-15 : prix de revente = une échelle fixe redistribuée au hasard entre les 14 variétés **toutes les 6 semaines** (comme l'original : toujours 2 variétés à 7 Wl/g, jamais les mêmes d'office). Pour éviter que tout le monde ne plante que celles-là : **saturation par joueur**, son prix baisse avec ce qu'il a déjà vendu de la variété pendant la période (compteur `marketSold`, remis à zéro à chaque réévaluation). Remplace « prix de base × 0,6-1,5 chaque semaine ». (V2 : saturation globale selon l'offre réelle.)
- Ordre de travail : 1) moteur de culture + tests (local) 2) Supabase + comptes + banque 3) ventes, police, impôts 4) chat + modération, puis vols + gardes.
