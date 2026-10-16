import {
  HOUSINGS,
  JOBS,
  PLACES,
  VARIETIES,
  type GameEvent,
  type HousingId,
  type JobId,
  type LogEntry,
  type PlaceId,
  type VarietyId,
} from '@weedapp/engine';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export const fmt = (n: number) => nf.format(n);
export const fmt1 = (n: number) => nf1.format(n);
export const wl = (n: number) => `${nf.format(n)} Wl`;
export const grams = (n: number) => `${nf.format(n)} g`;

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
  return `${Math.floor(hours / 24)} j ${hours % 24} h`;
}

export function formatTime(at: number): string {
  return new Date(at).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const variety = (id: unknown) => VARIETIES[id as VarietyId]?.name ?? String(id);
const place = (id: unknown) => PLACES[id as PlaceId]?.name ?? String(id);
const housing = (id: unknown) => HOUSINGS[id as HousingId]?.name ?? String(id);
const job = (id: unknown) => JOBS[id as JobId]?.name ?? String(id);

const DEATH: Record<string, string> = { thirst: 'soif', starvation: "manque d'engrais", overdose: 'surdose' };

const ERRORS: Record<string, string> = {
  INVALID_QUANTITY: 'Quantité invalide.',
  UNKNOWN_ITEM: 'Article inconnu.',
  INSUFFICIENT_FUNDS: "Pas assez d'argent dans ta bourse.",
  INSUFFICIENT_SEEDS: 'Pas assez de graines.',
  GERMINATION_FULL: 'Tes kits de germination sont pleins. Achète un kit de plus.',
  GERM_NOT_FOUND: 'Germe introuvable.',
  GERM_NOT_READY: 'Ce germe ne fait pas encore 10 cm.',
  GERM_DEAD: 'Ce germe est mort : jette-le pour libérer sa place.',
  NOT_ENOUGH_READY_GERMS: "Pas assez de germes prêts (10 cm).",
  HOUSING_FULL: 'Plus de place dans ton habitation.',
  INSUFFICIENT_POTS: 'Pas assez de pots de cette taille.',
  INSUFFICIENT_SOIL: 'Pas assez de terreau.',
  INSUFFICIENT_FERTILIZER: "Pas assez d'engrais.",
  INSUFFICIENT_INSECTICIDE: "Pas assez d'insecticide.",
  PLANT_NOT_FOUND: 'Plant introuvable.',
  PLANT_NOT_GROWING: "Ce plant n'est plus en pousse.",
  PLANT_NOT_OVERDOSED: "Ce plant n'est pas surdosé.",
  INVALID_LIGHT_HOURS: "L'éclairage doit être entre 0 et 24 h.",
  UNKNOWN_PLACE: 'Lieu inconnu.',
  PLACE_CLOSED: 'Ce lieu est fermé en ce moment.',
  SALE_ALREADY_RUNNING: 'Tu as déjà une vente en cours ici.',
  SALE_NOT_FOUND: 'Aucune vente en cours ici.',
  INSUFFICIENT_STOCK: 'Pas assez de beuh dans ta bourse.',
  NOTHING_TO_BRIBE: 'Ton indice est déjà à zéro.',
  BANK_CAP_REACHED: 'Plafond du livret atteint.',
  INSUFFICIENT_BANK_BALANCE: 'Solde du livret insuffisant.',
  UNKNOWN_JOB: 'Métier inconnu.',
  ALREADY_IN_JOB: 'Tu exerces déjà ce métier.',
  HOUSING_TOO_SMALL: 'Ton habitation est trop petite pour ça.',
  MAX_HOUSING_REACHED: 'Tu as déjà la plus grande habitation.',
  NOT_ENOUGH_GUARDS: "Tu n'as pas autant de gardes.",
  CANNOT_TARGET_SELF: 'Tu ne peux pas te voler toi-même.',
  TARGET_PROTECTED: 'Ce joueur est trop petit pour être attaqué (moins que la Maison).',
  TARGET_TOO_SMALL: "Impossible d'attaquer une habitation plus petite que la tienne.",
  DAILY_THEFT_LIMIT: '3 attaques maximum par jour.',
  INVALID_ACTION: 'Action invalide.',
  BANNED: 'Ton compte est temporairement suspendu.',
  UNAUTHENTICATED: 'Session expirée, reconnecte-toi.',
  VERSION_CONFLICT: 'Conflit de synchronisation, réessaie.',
  PLAYER_NOT_FOUND: 'Joueur introuvable.',
  OFFLINE: 'Disponible uniquement en ligne.',
  FORBIDDEN: 'Réservé aux admins.',
  NETWORK_ERROR: 'Pas de connexion au serveur.',
  RATE_LIMITED: 'Doucement ! Attends quelques secondes.',
  BLOCKED: 'Impossible : l’un de vous a bloqué l’autre.',
  MESSAGE_NOT_FOUND: 'Message introuvable.',
};

export function errorMessage(code: string): string {
  return ERRORS[code] ?? `Erreur : ${code}`;
}

/** Texte d'une ligne du journal. */
export function logText(entry: LogEntry): string {
  const d = entry.data;
  switch (entry.type) {
    case 'purchase': return `Achat (${d.quantity}×) pour ${wl(Number(d.cost))}`;
    case 'seeds_sown': return `${d.count} graines de ${variety(d.variety)} mises à germer`;
    case 'germs_planted': return `${d.count} germes plantés (pots de ${d.potSize} cm)`;
    case 'germs_died': return `${d.count} germe(s) mort(s), faute de place dans le kit`;
    case 'plant_died': return `Un plant de ${variety(d.variety)} est mort (${DEATH[String(d.cause)] ?? d.cause})`;
    case 'drying_done': return `${variety(d.variety)} sèche et prête : ${grams(Number(d.grams))}`;
    case 'plants_repotted': return `${d.count} plant(s) rempoté(s)`;
    case 'harvest': return `Récolte : ${grams(Number(d.grams))} et ${d.seeds} graines (${d.plants} plants)`;
    case 'sale_started': return `Vente de ${grams(Number(d.grams))} de ${variety(d.variety)} à ${place(d.placeId)}`;
    case 'sale_completed': return `Vente terminée à ${place(d.placeId)} : ${wl(Number(d.earned))}`;
    case 'sale_stopped': return `Vente retirée de ${place(d.placeId)} : ${wl(Number(d.earned))}`;
    case 'raid': return `Descente des stups ! Amende ${wl(Number(d.fine))}, ${grams(Number(d.seizedGrams))} et ${wl(Number(d.seizedMoney))} saisis`;
    case 'bribe': return `Commissaire soudoyé : ${wl(Number(d.cost))}`;
    case 'weekly_bill': return `Impôts de la semaine : ${wl(Number(d.total))} (intérêts ${wl(Number(d.interest))})`;
    case 'bank_deposit': return `Dépôt au livret : ${wl(Number(d.amount))}`;
    case 'bank_withdrawal': return `Retrait du livret : ${wl(Number(d.amount))} (frais ${wl(Number(d.fee))})`;
    case 'job_changed': return `Nouveau métier : ${job(d.job)}`;
    case 'housing_bought': return `Nouvelle habitation : ${housing(d.housing)}`;
    case 'guards_hired': return `${d.count} garde(s) du corps embauché(s)`;
    case 'guards_fired': return `${d.count} garde(s) du corps licencié(s)`;
    case 'theft_success': return `Vol réussi chez ${d.target} : ${wl(Number(d.money))} et ${grams(Number(d.grams))}`;
    case 'theft_failed': return `Vol raté chez ${d.target} (${d.thieves} voleurs perdus)`;
    case 'robbed': return `${d.attacker} t'a volé ${wl(Number(d.money))} et ${grams(Number(d.grams))} !`;
    case 'theft_repelled': return `Tes gardes ont repoussé les voleurs de ${d.attacker}`;
    case 'quiz_reward': return `Quiz du squatte : ${wl(Number(d.amount))} gagnés (${d.wins} bonne(s) réponse(s))`;
    case 'detective': return `Dossier du détective sur ${d.target}`;
    default: return entry.type;
  }
}

/** Résumé des événements importants survenus pendant l'absence du joueur. */
export function eventsSummary(events: GameEvent[]): string | null {
  const parts: string[] = [];
  const deaths = events.filter((e) => e.type === 'plant_died').length;
  const germDeaths = events.reduce((sum, e) => sum + (e.type === 'germs_died' ? e.count : 0), 0);
  const dried = events.filter((e) => e.type === 'drying_done').length;
  const sales = events.filter((e) => e.type === 'sale_completed');
  const raid = events.find((e) => e.type === 'raid');
  const bill = events.find((e) => e.type === 'weekly_bill');
  if (raid) parts.push('🚨 Descente des stups !');
  if (deaths) parts.push(`💀 ${deaths} plant(s) mort(s)`);
  if (germDeaths) parts.push(`💀 ${germDeaths} germe(s) mort(s)`);
  if (dried) parts.push(`🌿 ${dried} plant(s) prêt(s) à récolter`);
  if (sales.length) parts.push(`💰 ${sales.length} vente(s) terminée(s)`);
  if (bill && bill.type === 'weekly_bill') parts.push(`🧾 Impôts : ${wl(bill.bill.total)}`);
  return parts.length ? parts.join(' · ') : null;
}

export const deathLabel = (cause: string | undefined) => (cause ? (DEATH[cause] ?? cause) : 'cause inconnue');

export { variety as varietyName, place as placeName, housing as housingName, job as jobName };
