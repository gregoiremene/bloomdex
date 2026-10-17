# Vision — le jeu de fleurs (refonte de WeedApp)

> Document de travail, rédigé le 2026-10-17 après les premiers retours joueurs.
> À valider, puis à reporter dans `CLAUDE.md` (qui décrit encore la version « beuh »).

## Pourquoi on change

Les premiers testeurs l'ont dit clairement : une copie fidèle de Weed-Land ne peut pas rivaliser avec la nostalgie
que les anciens joueurs ont pour l'original. On garde ce qui marche (la boucle cultiver → vendre → grandir, les
sessions courtes, le social), mais on lui donne **une identité propre** : un jeu de **collection de fleurs**.

Bonus : plus aucun risque lié au thème cannabis (stores, prestataires de paiement, classification 18+).

## Pour qui

Les amateurs de **jeux de gestion chill** : sessions courtes, pas de stress, une interface **simple mais jolie**, et une
**progression** visible (habitations, collection). Le côté **collection** (« un TCG, mais avec des fleurs ») est le
moteur à long terme.

## L'histoire

Tu es un·e **collectionneur·se de fleurs**. Pas de boutique : tu cultives, tu vends tes fleurs coupées pour vivre,
et tu cherches surtout à **découvrir des espèces rares** par croisement, pour compléter ton **herbier**.

## La boucle de jeu

1. **Semer** des graines dans des kits de semis.
2. **Faire pousser** : arroser, nourrir, protéger des pucerons, bien équiper sa serre.
3. **En floraison** : cueillir les fleurs pour les vendre… ou **croiser** deux fleurs pour obtenir une nouvelle espèce.
4. **Vendre** les fleurs coupées dans les lieux de vente, et les graines rares aux collectionneurs ou aux autres joueurs.
5. **Grandir** : plus grande habitation, plus de plants, des croisements plus ambitieux.
6. **Collectionner** : remplir l'herbier, viser les 3 fleurs dorées.

Rythme inchangé : **2 sessions courtes par jour**, un cycle complet d'environ **une semaine** pour une espèce commune.

## Les stades de pousse

| Stade | Ce qui s'y passe |
|---|---|
| **Semis** | Les graines germent dans les kits. Le germe montre la **couleur de sa rareté** (première révélation). Germes sélectionnables, ils meurent faute de place au bout de 48 h (règle actuelle). |
| **Croissance** | Le plant développe son feuillage ; **l'espèce se révèle** (seconde révélation). Eau, engrais, pucerons. |
| **Floraison** | Bouton puis fleur ouverte. C'est là qu'on **cueille** ou qu'on **croise**. |
| **Cueillette** | Les fleurs coupées rejoignent le stock, prêtes à vendre (remplace le séchage ; durée courte). |

**Plus une espèce est rare, plus elle met de temps à pousser** (et plus elle rapporte).

## Les espèces et la rareté

- **~20 espèces de base**, des fleurs connues : rose, tulipe, tournesol, marguerite, lavande, coquelicot, pivoine,
  lys, orchidée, iris, jacinthe, dahlia, camélia, hortensia, myosotis, pensée, œillet, jonquille, bleuet, glycine…
  Surtout **communes**, quelques **peu communes** (orchidée, pivoine, camélia…). Achetables en boutique.
- **~30 hybrides** à découvrir par croisement, **non achetables**.
- **3 fleurs dorées légendaires**, chacune avec son nom et son design propres. Les trophées du jeu.

| Rareté | Couleur du germe | Obtention | Pousse | Prix |
|---|---|---|---|---|
| Commune | vert | boutique | référence | référence |
| Peu commune | bleu | boutique / croisement | un peu plus long | plus cher |
| Rare | violet | croisement | plus long | cher |
| Épique | orange | croisement de rares | long | très cher |
| Légendaire (dorée) | **doré, qui brille** | croisement précis d'épiques, chance infime | très long | inestimable |

## Le croisement (le cœur du jeu)

- **Action volontaire** dans la salle de floraison : on choisit une fleur **mère** et une fleur **donneuse**, puis
  « Polliniser ».
- **Résultat immédiat** : un **germe de l'espèce obtenue** apparaît tout de suite dans les kits de semis
  (sa rareté se voit à sa couleur, son espèce se révèle en croissance), **plus quelques graines** de cette espèce :
  plusieurs pour une commune, une seule (voire aucune) pour une très rare.
- **Recettes secrètes** : certains couples donnent un hybride (Rose × Tulipe → ?). Les joueurs les découvrent en
  expérimentant et se les échangent : de quoi faire vivre le squatte.
- **Le risque** : un couple sans recette, ou un tirage malchanceux, redonne simplement une des deux espèces parentes.
  Plus les parents sont rares, plus l'hybride possible l'est.
- **Le coût** : la **fleur mère est sacrifiée** (pas de cueillette pour elle). La donneuse ne perd rien.
  Le vrai choix : « je vends cette fleur, ou je tente ma chance ? »
- **Les 3 dorées** : une recette précise entre deux épiques, avec une chance infime à chaque croisement.
  Quand quelqu'un en obtient une, le bot l'annonce dans le squatte.

## L'herbier

Une page par espèce : silhouette tant qu'elle n'est pas découverte, puis son illustration, sa rareté, sa date de
découverte, et (une fois trouvée) la recette qui l'a donnée. Compteur « 23 / 53 espèces ». C'est la progression
de long terme, au même titre que les habitations.

## Vendre

- **Fleurs coupées** : le revenu courant, dans les lieux de vente (même système qu'aujourd'hui : horaires, débit,
  rente). La **saturation par joueur** reste : vendre toujours la même fleur rapporte de moins en moins.
- **Graines rares** : au **Salon des collectionneurs** (lieu dédié) et **entre joueurs**.
- **Vente entre joueurs** : pour commencer, une offre directe à un joueur précis (« 3 graines de X pour 5 000 pétales »),
  qu'il accepte ou refuse. Un marché public pourra suivre.

### Lieux de vente (12, à affiner)

Marché du dimanche, Fleuriste du quartier, Gare (petits bouquets), Hôpital, Restaurant chic, Hôtel de luxe,
Mariages, Fête des plantes, Festival d'été, Brocante, Boutique en ligne, **Salon des collectionneurs** (graines et raretés).

## Habitations (7, progression)

Balcon → Jardinet → Serre → Jardin → Pépinière → Domaine → Jardin botanique.

## Ce qu'on garde, transforme ou supprime

| Mécanique | Décision |
|---|---|
| Germination, pousse, eau/engrais, surdose, rempotage, éclairage, matériel, pucerons, geler | **Gardé** (renommé si besoin) |
| Germes qui meurent faute de place, sélection des germes | **Gardé** |
| Prix redistribués toutes les 6 semaines + saturation | **Gardé** (pour les espèces de base ; hybrides selon leur rareté) |
| Impôts, banque, métiers | **Gardé** (à rethématiser) |
| Vols entre joueurs | **Gardé**, **7 % maximum** de ce que possède la cible (pétales, fleurs, graines) |
| Gardes du corps | **Gardé**, rethématisé (chien de garde ? épouvantails ?) |
| Quiz, MP, retours, page admin | **Gardé** (questions « jeu » à réécrire) |
| Sexe des plants, mâles | **Supprimé** (remplacé par le croisement) |
| Police, descentes, commissaire | **Supprimé** |
| Séchage | **Remplacé** par la cueillette |
| Fraîcheur des fleurs coupées | **Pas pour l'instant** (idée gardée pour plus tard) |

## Monnaie

Les **pétales** (« 1 250 pétales ») remplacent les weedlars. Monnaie premium (monétisation, plus tard) : à nommer.

## Ambiance visuelle

Inspirée de **Forest** : fonds doux, couleurs pastel, beaucoup d'espace, des fleurs qui grandissent stade par stade.
Icônes : **Fluent Emoji** (Microsoft, licence MIT) — en 3D douce, identiques sur tous les appareils. À terme, des
illustrations par un·e illustrateur·rice pour les espèces (au moins les hybrides et les dorées).

## Monétisation (inchangée sur le principe)

Cosmétique avant tout (apparences de pots, de serre, cadres d'herbier, badge dans le chat), bonus de démarrage
plafonnés par habitation. Le thème fleurs lève les risques de refus des prestataires de paiement.

## Nom du jeu (à trouver)

« Pollinex » est déjà une marque (vaccin contre l'allergie au pollen) : à éviter. Pistes : **Pollen & Co**,
**Herbarium**, **Florilège**, **Pétalia**, **Bloomdex**, **Hybrida**, **Jardin secret**. Vérifier la disponibilité
(marque, nom de domaine, stores) avant de choisir.

## Questions ouvertes

- Durées de pousse et prix par rareté (à calibrer).
- Taux du croisement (parents / hybride), nombre de graines par rareté, chance des dorées.
- Liste exacte des espèces, des ~30 hybrides et de leurs recettes ; noms et designs des 3 dorées.
- Combien de croisements possibles par jour (une limite, ou seulement le coût de la fleur mère) ?
- Rethématisation des métiers, des impôts et des gardes.
- Que deviennent les comptes et parties de la version actuelle (remise à zéro au lancement de la version fleurs ?).
