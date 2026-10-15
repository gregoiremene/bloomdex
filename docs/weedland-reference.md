# Weed-Land.net — Référence du jeu original

> Rétro-ingénierie du jeu web **Weed-Land.net** (v7.2.92, 2003-2026, navigateur/PHP, FR), faite le 2026-09-29.
> Sources : FAQ interne du jeu (compte connecté), pages internes en lecture seule (boutique, immobilier, lieux de vente, métiers, banque…),
> forum public (forum.weed-land.net : ~780 sujets « Annonces/Mises à jour » + « Une question sur le jeu ? »), calculateur de ventes fait par des joueurs.
> Les prix de revente fluctuent (réévalués ~1×/mois selon le stock global) : les valeurs ci-dessous sont un **instantané**, à utiliser comme calibrage, pas comme vérité.
> ⚠️ Inspiration uniquement : on ne réutilise ni textes, ni images, ni noms de marque du site original.

---

## 1. Principe & boucle de jeu

Le joueur est un « cannabiculteur » : il **cultive**, **récolte**, puis **revend** (lieux publics, autres joueurs, grossiste), et réinvestit
(matériel, habitation plus grande, véhicule, métier…). Deux façons de gagner : cultiver/revendre (lent, gros gains) ou acheter/revendre (rapide, petits gains).

- Départ : **2 000 Wl** (weedlars, monnaie), habitation **Chambre** (3 plants max).
- Le monde avance par **actualisations horaires** (plants, ventes, météo, indice police) → jeu « temps réel » type OGame.
- **Impôts hebdomadaires** chaque lundi 04h00 (habitation + eau + électricité + gardes + ISF − salaire du métier).
- Présence conseillée : ~15 min/jour, pas plus de ~18 h sans passer (sinon les plants meurent de soif).
- Monnaie premium : **Weedies** (Allopass/PayPal) → boosts, location d'habitation, métiers, casino premium.

## 2. Habitations (progression linéaire, obligatoire niveau par niveau)

| Habitation | Plants indoor | Jardin (outdoor) | Réserve | Impôt/sem. | Prix | Indice police max |
|---|---|---|---|---|---|---|
| Chambre | 3 | – | – | ~0 | départ | 200 |
| Cabane | 9 | – | 1 m² | 400 | 13 500 | 300 |
| Maisonnette | 18 | 2 | 2 m² | 1 850 | 60 000 | ? |
| Maison | 40 | 4 | 4 m² | 6 500 | 140 000 | 850 |
| Villa | 70 | 10 | 10 m² | 15 000 | 500 000 | ? |
| Fermette | 130 | 18 | 25 m² | 35 000 | 2 500 000 | ? |
| Laboratoire | 200 | 30 | 25 m² | 80 000 | 15 000 000 | ? |

- Acheter une habitation remplace l'ancienne (non remboursée) ; matériel et plants sont déplacés.
- Paliers débloquant des features : **Cabane** → alliances ; **Maisonnette** → outdoor, panneaux solaires, citerne ; **Maison** → peut être volé (et voler), métiers Dessinateur/Politicien ; **Villa** → éoliennes, métiers sportifs ; **Fermette** → Chirurgien/PDG.
- Location (premium) : Maisonnette/Maison à la semaine, sans jardin ni impôts.
- La « réserve » stocke pots, terreau, engrais, insecticide (pas de limite réelle).

## 3. Culture

### 3.1 Étapes
1. **Germination** : graines dans un **kit de germination** (15 graines/kit). Pousse ~1 jour jusqu'à **10 cm**. Chaque germe a un *indice de développement* aléatoire (germes rapides/lents) → les joueurs font germer plus de graines que nécessaire et gardent les plus rapides (option payante « sélectionner les X premiers », 1 Wl/plant ; on peut jeter des germes).
2. **Végétation** (manuel : « planter » le germe ≥ 10 cm dans un pot + terreau). Eau **≤ 5 cl**, engrais végétation **≤ 5 ml**. Éclairage **18 h/j**. Passage auto en floraison à **~70 cm** (outdoor ~80 cm).
3. **Floraison** : eau **≤ 15 cl**, engrais floraison **≤ 15 ml**. Éclairage **12 h/j**. Le **sexe** se révèle (aléatoire, pas d'astuce). Passage auto en séchage à **~160 cm** (outdoor ~220 cm).
4. **Séchage** : 7-8 h, puis récolte (récupérer **les graines avant la beuh**, sinon elles sont perdues).

- Cycle complet germination → fin séchage : **~6,5-7 jours** réels (fiche variété : « floraison 15 jours »).
- L'eau/engrais **diminuent à chaque actualisation**. **0 = mort**, **dépassement du max = surdose = mort** → sauf **rempotage** (nécessite un pot neuf de même taille ; il faut ré-arroser ensuite). Sécurité : max 10 cl (végé) / 25 cl (flo) par action.
- **Geler/dégeler** : met les plants en pause (pas de pousse, pas de consommation). Les mâles gelés pollinisent quand même.
- **Hibernation** du compte (≥ 8 jours) : pas d'impôts, plants gelés.
- **Pucerons** : ralentissent la pousse. Traitement préventif **2×** (1 en végétation, 1 en floraison), **4 ml d'insecticide/plant**, ensuite immunisé. *(WeedApp : en flo, la protection s'use après 36-60 h, voir CLAUDE.md.)*
- **Mâles** : produisent très peu (~17 g) et **pollinisent** les femelles (effet à partir de ~100 cm) → femelles donnent des **graines** au lieu de beuh. On peut les jeter (en masse). Femelle saine sans pollinisation ≈ **125-150 g** (fiche : 125 g). Session « graines » complète ≈ 17 g + ~98 graines/pied.
- **Événements aléatoires** (panne de courant, lapins, vent violent…) : 1 h sans croissance.
- **Plants morts** : à supprimer ; classement « plus mauvais cultivateur ».

### 3.2 Matériel & capacités
- Les **lampes éclairent N plants** quelle que soit la salle (végé + flo partagent les lampes ; on règle juste les heures par salle). Idem radiateurs/ventilateurs/diffuseurs CO2 → capacité totale ≥ nb plants en végé+flo, sinon pousse plus lente / rendement moindre.
- **Usure** : lampes/radiateurs/ventilateurs tombent en panne tous les 10-15 j (réparation gratuite, remplacement obligatoire à la 4ᵉ). CO2 à recharger tous les 15-20 j.
- **CO2** : accélère légèrement la pousse (superflu au début).
- **Pots** : 20/25/30/40 cm (terreau 2/3/4/6 L). Rôle exact de la taille non documenté (hypothèse joueurs : plus gros pot = meilleur).
- Éclairage à 0 dans les deux salles = pas de facture d'électricité.

### 3.3 Outdoor (dès Maisonnette)
- Jardin = salle unique végé+flo, pas de pot (6 L de terreau), soleil gratuit (pas de lampes).
- Dépend de la **météo** (actualisée chaque heure) : Canicule, Ensoleillé, Couvert, Pluvieux, Orage, Neige, Tempête. Le mauvais temps peut tuer des plants.
- Rendement beuh outdoor faible, bon pour produire des graines. Blueberry et Crystal indoor seulement.

### 3.4 Shit
- 3 variétés de beuh « à shit » → shit : **Afghane → Afghan**, **Tibetaine → Charas**, **Marocaine → Pollen**.
- Conversion : **−20 %** de poids, **24 h**, minimum 100 g. Le shit se vend plus cher.

## 4. Boutique (prix instantané)

| Article | Détail | Prix |
|---|---|---|
| Graines (paquet de 15) | 14 variétés, voir §5 | 33 → 200 Wl |
| Terreau | sac 15 L | 45 |
| Engrais végétation | 250 ml | 60 |
| Engrais floraison | 250 ml | 78 |
| Insecticide | 50 ml | 20 |
| Pots | 20 / 25 / 30 / 40 cm | 7 / 11 / 17 / 24 |
| Lampes | 250 W→3 pl · 400 W→5 · 600 W→10 · 1000 W→15 | 230 / 360 / 690 / 1 000 |
| Radiateurs | 3 / 5 / 10 / 15 plants | 200 / 340 / 600 / 800 |
| Ventilateurs | 3 / 5 / 10 / 15 plants | 200 / 340 / 600 / 800 |
| Kit de germination | 15 graines | 350 |
| Diffuseur CO2 | 5 / 10 / 25 plants | 2 500 / 4 350 / 9 550 |
| Panneau solaire | dès Maisonnette, 1 / 3 m², ~10 Wl/j au soleil | 750 |
| Éolienne | dès Villa, 1 / 65 m², ~40 Wl/j si vent | 4 750 |
| Citerne | auto, récupère la pluie → eau gratuite (pas en Chambre) | – |

**Brocante** : marché d'occasion entre joueurs pour graines/pots/lampes/radiateurs/ventilateurs/kits/CO2, prix entre 10 % et 100 % du prix boutique. Terreau/engrais/insecticide : boutique uniquement.

## 5. Variétés

Toutes les variétés poussent **à la même vitesse et produisent le même poids** ; seuls diffèrent le **prix des graines** et le **prix de revente** (qui fluctue).

| Variété | Graines (15) | Revente Wl/g (instantané) | Outdoor |
|---|---|---|---|
| Jack Herer | 150 | 2 | oui |
| Big Bud | 88 | 6 | oui |
| Shiva Shanti | 33 | 3 | oui |
| Super Skunk | 44 | 7 | oui |
| Marley's Collie | 120 | 7 | oui |
| Blueberry | 150 | 4 | **non** |
| Aurora Indica | 45 | 5 | oui |
| White Widow | 140 | 2 | oui |
| Early Girl | 89 | 4 | oui |
| AK48 | 115 | 5 | oui |
| Crystal | 200 | 4 | **non** |
| Afghane *(→ shit Afghan)* | 135 | 3 | oui |
| Tibetaine *(→ shit Charas)* | 130 | 2 | oui |
| Marocaine *(→ shit Pollen)* | 135 | 6 | oui |
| **Shit** Afghan / Charas / Pollen | – | 4 / 8 / 7 | – |

- Réévaluation périodique des prix : variété abondante dans le jeu → prix baisse, rare → prix monte (pousse à diversifier).
- Le « prix maximum » grossiste plafonne aussi les ventes entre joueurs.

## 6. Acheter / vendre

### 6.1 Achat
- **Grossiste** (PNJ) : stock global par variété, **250 g max / 24 h**, rechargé manuellement par les admins quand tout est épuisé. (+ « fumer un joint » = gag visuel.)
- **Marché joueurs** : annonces publiques (2 achats/min max).
- **Achats directs** : vente privée ciblée d'un joueur à un autre (≥ 1 Wl/g).

### 6.2 Vente dans les lieux publics/privés (cœur de l'économie PvE)
On « pose » X grammes dans un lieu ouvert ; à chaque actualisation horaire, la **capacité/h** est vendue au prix variété × **indice de rente** (%) ; l'**indice police** monte selon le **risque** × grammes vendus. On peut retirer sa vente. La dernière heure avant fermeture ne compte pas.

| Lieu | Horaires | Risque | Rente | Capacité g/h | Clients (dealers max) |
|---|---|---|---|---|---|
| Collège | 8h-17h semaine | 0,85 % | 110 | 124 | 800 (300) |
| Lycée | 8h-18h semaine | 0,80 % | 105 | 131 | 1 200 (360) |
| Université | 0h-24h semaine | 0,60 % | 105 | 138 | 1 500 (420) |
| Boîte de nuit | 0h-8h ven. & sam. | 0,90 % | 115 | 142 | 900 (350) |
| Fête foraine | 10h-22h week-end | 0,60 % | 110 | 138 | 2 000 (450) |
| Cage d'escalier | 6h-24h semaine | 0,75 % | 115 | 147 | 700 (260) |
| Rave party | 24/24 week-end | 0,75 % | 125 | 158 | 3 500 (750) |
| Disney Village | 8h-22h 7j/7 | 0,95 % | 120 | 146 | 1 200 (400) |
| Plage | 24/24 week-end | 0,55 % | 110 | 146 | 7 500 (900) |
| Parc | 8h-22h 7j/7 | 0,60 % | 115 | 136 | 600 (220) |
| Place du village | 0h-7h 7j/7 | 0,50 % | 115 | 129 | 500 (190) |
| Gare | 6h-23h 7j/7 | 0,60 % | 115 | 132 | 1 100 (350) |

Exemple calibré (calculateur joueurs) : 1 000 g à 8 Wl/g à la Rave → 10 000 Wl, 7 h, indice +83 (≈ risque × grammes / ~9 ; formule exacte inconnue).

### 6.3 Indice police & stups
- Indice affiché « x / max » ; max dépend de l'habitation (Chambre 200, Cabane 300, Maison 850…).
- Monte uniquement avec les ventes en lieux publics ; **baisse chaque heure** sans vente en cours.
- Dépassement du max → **descente des stups dans l'heure** : amende = **indice × 30 Wl** + confiscation de l'argent gagné sur le lieu ; la bourse peut passer en négatif ; **perte du métier**.
- **Commissaire Sarcasto** (corrompu) : remet l'indice à 0 pour **indice × 20 Wl**.

## 7. Économie & gestion

- **Bourse** : ce que le joueur a « sur lui » (argent + grammes par variété) → exposé aux vols, aux stups, et à l'**ISF** (bourse > 15 000 Wl au moment des impôts, ~6 %).
- **Impôts** (lundi 04h00) : habitation + électricité (matériel allumé) + eau (arrosage hors citerne) + gardes du corps + ISF − réduction écolo (solaire/éolien) − salaire. Passer en négatif est toléré.
- **Banque** : un seul livret à la fois (upgrade transfère) ; intérêts versés tous les 7 jours ; frais de retrait.

| Livret | Intérêts/sem. | Frais retrait | Plafond | Coût |
|---|---|---|---|---|
| A | 1,8 % | 2,3 % | 500 000 | 5 000 |
| B | 2 % | 2,5 % | 7 500 000 | 150 000 |
| C | 2,2 % | 3 % | 50 000 000 | 2 000 000 |
| D | 2,4 % | 3,5 % | 500 000 000 | 17 500 000 |

- **Cachette** : coffre inviolable (ni stups, ni voleurs, ni ISF), alimentée uniquement via un **véhicule** (transfert en temps réel) :

| Véhicule | Capacité (g ou Wl) / trajet | Durée | Prix |
|---|---|---|---|
| Vélo | 300 | 6 h | 2 000 |
| Mobylette | 500 | 5 h | 4 500 |
| Scooter | 2 000 | 4 h | 8 500 |
| Moto | 6 000 | 3 h | 22 500 |
| Petite voiture | 25 000 | 2 h | 50 000 |
| Voiture de sport | 60 000 | 1 h | 100 000 |
| Camion | 200 000 | 2 h | 350 000 |
| Poids lourd | 500 000 | 2 h | 600 000 |

  (non revendable, remplacé par le suivant ; chaque type a 4 skins cosmétiques).

- **Métiers** (salaire hebdo versé avec les impôts ; frais d'études one-shot ; perdu si arrêté par les stups) :

| Métier | Salaire/sem. | Études | Habitation min. |
|---|---|---|---|
| Chauffeur de bus | 750 | 3 900 | Chambre |
| Serveur | 960 | 6 700 | Chambre |
| Chauffeur de taxi | 1 200 | 9 400 | Chambre |
| Pêcheur | 1 500 | 14 000 | Chambre |
| Maçon | 1 800 | 18 600 | Chambre |
| Professeur | 2 100 | 23 700 | Chambre |
| Agriculteur | 2 550 | 28 000 | Chambre |
| Dessinateur | 2 900 | 32 900 | Maison |
| Politicien | 3 300 | 37 300 | Maison |
| Basketteur | 3 900 | 42 500 | Villa |
| Footballeur | 4 600 | 53 000 | Villa |
| Chirurgien | 5 500 | 62 500 | Fermette |
| PDG | 7 000 | 75 000 | Fermette |

- **Jardinier** : arrose (à la dose cible), traite, retire les mâles pendant 1-3 jours consécutifs, 1×/semaine, **2 Wl/m²/h** ; utilise tes ressources ; ne répare pas le matériel.
- **Mairie** : stats globales (trésorerie, policiers/habitants, arrestations, production hebdo, records, « plus gros producteur » de la saison ~3 mois récompensé d'1 kg).

## 8. PvP & social

- **Voleurs** : 3 000 Wl/voleur, 3 attaques/jour, vole jusqu'à **10 % de la bourse** de la cible ; impossible d'attaquer une habitation plus petite que la sienne ; < Maison = inattaquable.
- **Gardes du corps** : 500 Wl l'embauche + 200 Wl/sem., licenciement 1 250 Wl.
- **Détective** : 250 Wl → dossier complet d'un joueur (habitation, véhicule, lampes, hibernation…).
- **Alliances** (dès Cabane) : création 100 000 Wl (perdu), adhésion caution 20 000 Wl (rendue 48 h après départ), 7 j de délai entre deux alliances ; coffre commun argent/weed/shit/graines avec paliers de stockage payants (6), grades renommables, droits fins et quotas de retrait, suppression après 2 mois d'inactivité ; classement des alliances.
- **Squatte** : chat global ; **Quizz** toutes les 15 min (100 Wl la bonne réponse) ; **jeu de l'icône** (clic le premier → 10-20 g aléatoires) ; règles anti-flood.
- **MP** (reçus/envoyés, contacts, ignore-list, bloc-notes), **pubs** joueurs (1 Wl/affichage), **parrainage** (500 Wl/filleul activé).
- **Classements** (top 10) : plus riches, producteurs de beuh, de graines, alliances, posteurs squatte, quizz, parrains, plus mauvais cultivateurs ; remis à 0 aléatoirement.

## 9. Mini-jeux
- **Casino** : dé (5 → ×5), carte (Dame de trèfle parmi 4 → ×3), roulette 0-36 (→ ×36).
- **Loterie** : tirage quotidien 00h00 (2 numéros + joker), cagnotte reportée.
- **Paris sportifs** sur de vrais matchs.

## 10. Monétisation d'origine (Weedies)
Boosts **+25 % production** ou **+25 % vitesse de pousse** (5 j / 15 j), indice police à 0, packs d'argent / de beuh, casino premium, location d'habitation, métiers, jardinier.

## 11. Problèmes connus du design original (leçons)
- Micro-gestion fastidieuse (arrosage plant par plant, F5 = double dose, checkboxes).
- Économie déséquilibrée → plusieurs remises à zéro globales ; inflation des impôts pour freiner les riches.
- Multi-comptes, abus du quizz, vols entre membres d'alliance.
- UI années 2000 en tableaux, non mobile.
