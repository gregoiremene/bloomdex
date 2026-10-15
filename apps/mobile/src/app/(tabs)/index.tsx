import {
  BALANCE,
  equipmentFactor,
  germHoursLeft,
  germinationCapacity,
  isProtected,
  growingPlants,
  HOUR_MS,
  HOUSINGS,
  lightFactor,
  policeIndexMax,
  POT_SIZES,
  VARIETY_IDS,
  type GameState,
  type Germ,
  type Plant,
  type PotSize,
  type Room,
  type VarietyId,
} from '@weedapp/engine';
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { isOnline } from '@/lib/supabase';
import { deathLabel, fmt, fmt1, formatDuration, varietyName, wl } from '@/game/labels';
import { useGame, useGameState, useNow } from '@/game/store';
import { Body, Button, Card, Chips, Field, Muted, ProgressBar, Row, Screen, BubbleTabs, Stat, Stepper } from '@/ui/components';
import { PlantArt } from '@/ui/PlantArt';
import { colors, spacing } from '@/ui/theme';

const ROOM_LABEL: Record<Room, string> = { veg: 'Végétation', flo: 'Floraison' };

type StageTab = 'germ' | Room | 'drying';
const STAGE_TABS: readonly StageTab[] = ['germ', 'veg', 'flo', 'drying'];

/** Logo affiché sur un plant tant qu'il n'est pas traité contre les pucerons pour son stade. */
const UNPROTECTED_ICON = '🐞';

/** Plant à surveiller : soif/faim proche, surdose ou mort. */
const LOW_AUTONOMY_HOURS = 4;

function autonomyHours(plant: Plant): number {
  if (plant.stage !== 'veg' && plant.stage !== 'flo') return Infinity;
  const stage = BALANCE.stages[plant.stage];
  return Math.min(plant.waterCl / stage.waterPerHourCl, plant.fertMl / stage.fertPerHourMl);
}

export default function ExploitationScreen() {
  const state = useGameState();
  const sync = useGame((s) => s.sync);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<StageTab | null>(null);
  // Pages de la liste des germes chargées au fil du défilement (remise à zéro en changeant d'onglet).
  const [germPage, setGermPage] = useState(0);
  // Onglets déjà construits : une fois montés, ils restent (masqués) pour un changement d'onglet instantané.
  const [mounted, setMounted] = useState<ReadonlySet<StageTab>>(new Set());
  const loaded = state !== null;
  useEffect(() => {
    if (!loaded) return;
    const next = STAGE_TABS.find((t) => !mounted.has(t));
    if (!next) return;
    // Préchargement en arrière-plan, un onglet à la fois : l'écran affiché reste réactif.
    const id = setTimeout(() => setMounted((prev) => new Set(prev).add(next)), 50);
    return () => clearTimeout(id);
  }, [loaded, mounted]);
  if (!state) return null;

  const inRoom = (room: Room) => state.plants.filter((p) => p.stage === room);
  const needsCare = (plants: Plant[]) => plants.some((p) => p.overdosed || (!p.frozen && autonomyHours(p) < LOW_AUTONOMY_HOURS));
  const drying = state.plants.filter((p) => p.stage === 'drying' || p.stage === 'dry');
  const deadIn = (room: Room) => state.plants.some((p) => p.stage === 'dead' && p.diedIn === room);
  const tabs = [
    { value: 'germ', label: 'Germes', icon: <PlantArt stage="germ" grow={1} size={20} />, count: state.germs.length, alert: state.germs.some((g) => g.dead || isCramped(g, state.lastTickAt)) },
    { value: 'veg', label: 'Végé', icon: <PlantArt stage="veg" grow={0.5} size={20} />, count: inRoom('veg').length, alert: needsCare(inRoom('veg')) || deadIn('veg') },
    { value: 'flo', label: 'Flo', icon: <PlantArt stage="flo" grow={0.5} size={20} />, count: inRoom('flo').length, alert: needsCare(inRoom('flo')) || deadIn('flo') },
    { value: 'drying', label: 'Séchage', icon: <PlantArt stage="drying" size={20} />, count: drying.length },
  ] as const;
  // Par défaut : le premier stade qui contient quelque chose.
  const current = tab ?? tabs.find((t) => t.count > 0)?.value ?? 'germ';

  return (
    <View style={{ flex: 1 }}>
      <Screen
        onEndReached={current === 'germ' ? () => setGermPage((p) => p + 1) : undefined}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await sync();
          setRefreshing(false);
        }}
      >
        <Overview state={state} />
        {STAGE_TABS.map((t) => (
          <View key={t} style={[styles.panel, t !== current && styles.hidden]}>
            {(t === current || mounted.has(t)) &&
              (t === 'germ' ? (
                <Germination state={state} active={t === current} page={germPage} />
              ) : t === 'drying' ? (
                <Drying state={state} active={t === current} />
              ) : (
                <RoomCard state={state} room={t} active={t === current} />
              ))}
          </View>
        ))}
        {/* Place pour les bulles flottantes. */}
        <View style={{ height: 56 }} />
      </Screen>
      <View style={styles.bubbles}>
        <BubbleTabs
          tabs={tabs}
          value={current}
          onChange={(t) => {
            setTab(t);
            setGermPage(0);
          }}
        />
      </View>
    </View>
  );
}

function Overview({ state }: { state: GameState }) {
  const now = useNow();
  const role = useSession((s) => s.profile?.role);
  // Outil de test : admins en ligne, et tout le monde en mode démo (partie locale).
  const canRewind = !isOnline || role === 'admin';
  const housing = HOUSINGS[state.housing];
  const max = policeIndexMax(state);
  const ratio = state.policeIndex / max;
  const nextTick = (Math.floor(now / HOUR_MS) + 1) * HOUR_MS;
  return (
    <Card>
      <Row wrap>
        <Stat label="Bourse" value={wl(state.money)} tone={state.money < 0 ? 'danger' : undefined} />
        <Stat label="Livret" value={wl(state.bankBalance)} />
        <Stat label="Indice police" value={`${fmt(state.policeIndex)} / ${fmt(max)}`} tone={ratio > 0.8 ? 'danger' : ratio > 0.5 ? 'warning' : undefined} />
      </Row>
      <ProgressBar value={ratio} tone={ratio > 0.8 ? 'danger' : ratio > 0.5 ? 'warning' : 'info'} />
      {state.raidPending && <Text style={styles.alert}>🚨 Les stups arrivent à la prochaine actualisation ! Va voir le commissaire.</Text>}
      <Muted>
        {housing.name} · {growingPlants(state).length}/{housing.plantCapacity} plants · actualisation dans {formatDuration(nextTick - now)}
      </Muted>
      {canRewind && <RewindTool />}
    </Card>
  );
}

/**
 * Liste construite après le haut de l'onglet : à l'ouverture, résumé et boutons s'affichent
 * tout de suite, les germes/plants (nombreux dessins) arrivent à l'image suivante.
 * Onglet masqué : la liste est retirée pour ne pas alourdir les mises à jour.
 */
function DeferredList({ active, children }: { active: boolean; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    const id = setTimeout(() => setReady(true), 16);
    return () => clearTimeout(id);
  }, [active]);
  if (!active) return null;
  return ready ? (
    <>{children}</>
  ) : (
    <Card>
      <Row>
        <ActivityIndicator color={colors.accent} />
        <Muted>Chargement…</Muted>
      </Row>
    </Card>
  );
}

/** Admin : simule des actualisations (rejoue les heures passées, voir rewindClock). */
function RewindTool() {
  const rewind = useGame((s) => s.rewind);
  const busy = useGame((s) => s.busy);
  return (
    <Row wrap>
      <Text style={styles.admin}>🛠 Simuler</Text>
      <View style={{ flex: 1 }} />
      {[1, 6, 12, 24].map((hours) => (
        <Button key={hours} label={`+${hours} h`} compact variant="secondary" disabled={busy} onPress={() => void rewind(hours)} />
      ))}
    </Row>
  );
}

function intOr(text: string, fallback: number): number {
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function Germination({ state, active, page }: { state: GameState; active: boolean; page: number }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const owned = VARIETY_IDS.filter((v) => state.inventory.seeds[v] > 0);
  const [variety, setVariety] = useState<VarietyId>(owned[0] ?? 'super_skunk');
  const [sowCount, setSowCount] = useState('');
  const [potSize, setPotSize] = useState<PotSize>(40);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [plantCount, setPlantCount] = useState<number | null>(null);
  const capacity = germinationCapacity(state);
  const isReady = (g: Germ) => !g.dead && g.height >= BALANCE.germination.plantableHeight;
  const deadGerms = state.germs.filter((g) => g.dead);
  const ready = state.germs.filter(isReady);
  const tallest = Math.max(0, ...state.germs.filter((g) => !g.dead).map((g) => g.height));
  const selectedVariety = owned.includes(variety) ? variety : owned[0];
  const germs = useMemo(() => [...state.germs].sort((a, b) => Number(a.dead) - Number(b.dead) || b.height - a.height), [state.germs]);
  const shown = germs.slice(0, GERMS_PER_PAGE * (page + 1));
  // Ne garde que les germes encore présents et prêts (après une plantation, une actualisation…).
  const selected = ready.filter((g) => picked.has(g.id));
  const freeRoom = Math.max(0, HOUSINGS[state.housing].plantCapacity - growingPlants(state).length);
  // Par défaut : autant que la place libre le permet. On plante toujours les plus grands de la sélection.
  const count = Math.max(1, Math.min(plantCount ?? Math.min(selected.length, freeRoom || selected.length), selected.length));
  const toPlant = [...selected].sort((a, b) => b.height - a.height || b.devIndex - a.devIndex).slice(0, count).map((g) => g.id);
  const select = (ids: number[]) => {
    setPicked(new Set(ids));
    setPlantCount(null);
  };
  // Stable et fonctionnel : les lignes mémorisées (GermRow) gardent la fonction d'un rendu précédent.
  const toggle = useCallback((id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPlantCount(null);
  }, []);

  return (
    <>
      <Card title="Germination" right={<Muted>{state.germs.length}/{capacity} germes</Muted>}>
        {state.germs.length > 0 && (
          <>
            <Muted>
              {ready.length} prêt(s) à planter · le plus grand fait {fmt1(floor1(tallest))} cm · prêt à {BALANCE.germination.plantableHeight} cm
            </Muted>
            <ProgressBar value={tallest / BALANCE.germination.plantableHeight} />
          </>
        )}
        {capacity === 0 ? (
          <Muted>Achète un kit de germination en boutique pour commencer.</Muted>
        ) : owned.length === 0 ? (
          <Muted>Aucune graine en stock : passe à la boutique.</Muted>
        ) : (
          <>
            <Chips options={owned.map((v) => ({ value: v, label: `${varietyName(v)} (${state.inventory.seeds[v]})` }))} value={selectedVariety ?? variety} onChange={setVariety} />
            <Row>
              <Field value={sowCount} onChangeText={setSowCount} keyboardType="number-pad" placeholder="Nombre" />
              <Button
                label="Faire germer"
                disabled={busy || !selectedVariety}
                onPress={() => selectedVariety && act({ type: 'sow', variety: selectedVariety, count: intOr(sowCount, 1) }, 'Graines mises à germer')}
              />
            </Row>
          </>
        )}
        {deadGerms.length > 0 && (
          <Button
            label={`Jeter les germes morts (${deadGerms.length})`}
            variant="danger"
            compact
            disabled={busy}
            onPress={() => act({ type: 'discardGerms', germIds: deadGerms.map((g) => g.id) }, 'Germes morts jetés')}
          />
        )}
        {state.germs.length > 0 && (
          <Button label="Jeter tous les germes" variant="secondary" compact disabled={busy} onPress={() => act({ type: 'discardGerms', germIds: state.germs.map((g) => g.id) })} />
        )}
      </Card>
      {germs.length > 0 && (
        <DeferredList active={active}>
          <Card
            title="Germes"
            right={
              ready.length > 0 ? (
                <Button
                  label={selected.length === ready.length ? 'Tout désélectionner' : 'Sélectionner le max'}
                  compact
                  variant="secondary"
                  onPress={() => select(selected.length === ready.length ? [] : ready.map((g) => g.id))}
                />
              ) : undefined
            }
          >
            {selected.length > 0 && (
              <View style={styles.selectionBar}>
                <Muted>
                  {selected.length} sélectionné(s) · place libre : {freeRoom} plant(s). Les plus grands sont plantés en premier.
                </Muted>
                <Stepper value={count} onChange={setPlantCount} max={selected.length} presets={[]} />
                <Chips options={POT_SIZES.map((size) => ({ value: size, label: `Pot ${size} cm (${state.inventory.pots[size]})` }))} value={potSize} onChange={setPotSize} />
                <Button
                  label={`Planter les ${count} plus grand${count > 1 ? 's' : ''} en pot ${potSize} cm`}
                  disabled={busy}
                  onPress={async () => {
                    if (await act({ type: 'plantGerms', germIds: toPlant, potSize }, 'Plantés ! Pense à les arroser.')) select([]);
                  }}
                />
                <Muted>Un plant fraîchement planté doit être arrosé avant la prochaine actualisation.</Muted>
              </View>
            )}
            {ready.length > 0 && selected.length === 0 && <Muted>Touche les germes prêts pour les sélectionner.</Muted>}
            {shown.map((germ) => (
              <GermRow key={germ.id} germ={germ} cramped={isCramped(germ, state.lastTickAt)} selected={picked.has(germ.id)} onToggle={toggle} />
            ))}
            {shown.length < germs.length && (
              <Row>
                <ActivityIndicator color={colors.accent} />
                <Muted>
                  {shown.length} / {germs.length} germes affichés · descends pour voir la suite
                </Muted>
              </Row>
            )}
          </Card>
        </DeferredList>
      )}
    </>
  );
}

/** Germes affichés par page : la liste se complète au fil du défilement (on peut en avoir des centaines). */
const GERMS_PER_PAGE = 30;

const GermRow = memo(
  function GermRow({ germ, cramped, selected, onToggle }: { germ: Germ; cramped: boolean; selected: boolean; onToggle: (id: number) => void }) {
    const g = BALANCE.germination;
    const progress = germ.height / g.plantableHeight;
    const ready = !germ.dead && progress >= 1;
    const tag = germ.dead ? '💀 mort, faute de place dans le kit' : cramped ? '⚠️ à l’étroit : plante-le vite !' : ready ? '✅ prêt à planter' : null;
    return (
      <PlantListItem
        art={<PlantArt stage={germ.dead ? 'deadGerm' : 'germ'} grow={progress} size={40} />}
        name={varietyName(germ.variety)}
        detail={`${fmt1(floor1(germ.height))} cm`}
        progress={germ.dead ? undefined : progress}
        tone={cramped ? 'warning' : 'accent'}
        tags={[tag]}
        selected={ready && selected}
        onPress={ready ? () => onToggle(germ.id) : undefined}
      />
    );
  },
  (prev, next) =>
    prev.selected === next.selected &&
    prev.germ.id === next.germ.id &&
    prev.germ.dead === next.germ.dead &&
    prev.cramped === next.cramped &&
    floor1(prev.germ.height) === floor1(next.germ.height),
);

/** Germe vivant dans ses dernières heures avant de mourir faute de place. */
function isCramped(germ: Germ, at: number): boolean {
  return !germ.dead && germHoursLeft(germ, at) <= BALANCE.germination.crampedWarningHours;
}

/**
 * Taille tronquée au millimètre : un germe à 9,96 cm affiche 9,9 (il n'est pas encore prêt),
 * et passe à 10,0 exactement quand il le devient.
 */
function floor1(cm: number): number {
  return Math.floor(cm * 10) / 10;
}

/** Ligne de la liste des plants : illustration, variété, taille, avancement dans le stade. */
function PlantListItem({
  art,
  name,
  detail,
  progress,
  tone = 'accent',
  tags = [],
  selected,
  onPress,
}: {
  art: ReactNode;
  name: string;
  detail: string;
  progress?: number;
  tone?: 'accent' | 'warning' | 'danger' | 'info';
  tags?: (string | null | false)[];
  /** Défini = ligne sélectionnable (case à cocher). */
  selected?: boolean;
  onPress?: () => void;
}) {
  const shown = tags.filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.plant, selected && styles.plantSelected, pressed && { opacity: 0.75 }]}
      accessibilityRole={selected !== undefined ? 'checkbox' : undefined}
      accessibilityState={selected !== undefined ? { checked: selected } : undefined}
    >
      {selected !== undefined && <View style={[styles.check, selected && styles.checkOn, !onPress && { opacity: 0.25 }]}>{selected && <Text style={styles.checkMark}>✓</Text>}</View>}
      <View style={styles.art}>{art}</View>
      <View style={styles.plantBody}>
        <Row>
          <Text style={styles.plantName} numberOfLines={1}>
            {name}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.plantSize}>{detail}</Text>
        </Row>
        {progress !== undefined && <ProgressBar value={progress} tone={tone} />}
        {shown.length > 0 && <Text style={styles.muted}>{shown.join(' · ')}</Text>}
      </View>
    </Pressable>
  );
}

function RoomCard({ state, room, active }: { state: GameState; room: Room; active: boolean }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const plants = state.plants.filter((p) => p.stage === room);
  const dead = state.plants.filter((p) => p.stage === 'dead' && p.diedIn === room);
  const stage = BALANCE.stages[room];
  const light = state.lightHours[room];
  const equip = equipmentFactor(state);
  const lightOk = lightFactor(state, room);
  const males = plants.filter((p) => p.sex === 'male').length;
  const overdosed = plants.filter((p) => p.overdosed);
  const minAutonomy = Math.min(...plants.filter((p) => !p.frozen).map(autonomyHours));
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  // Sélection = plants encore dans la salle ; sans sélection, les actions portent sur toute la salle.
  const selection = plants.filter((p) => picked.has(p.id));
  const targets = selection.length > 0 ? selection : plants;
  const selector = selection.length > 0 ? selection.map((p) => p.id) : { room };
  const suffix = selection.length > 0 ? ` (${selection.length})` : '';
  const toTreat = targets.filter((p) => !isProtected(p)).length;
  const anyFrozen = targets.some((p) => p.frozen);
  const unprotected = plants.filter((p) => !isProtected(p)).length;
  // Mise à jour fonctionnelle : les lignes mémorisées (PlantRow) gardent un onPress d'un rendu précédent.
  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <Card title={`${ROOM_LABEL[room]} (${plants.length})`} right={<Muted>max {stage.waterMaxCl} cl / {stage.fertMaxMl} ml</Muted>}>
        <Row>
          <Muted>Éclairage {light} h/j (idéal {stage.targetLightHours} h)</Muted>
          <View style={{ flex: 1 }} />
          <Button label="−" compact variant="secondary" disabled={busy || light <= 0} onPress={() => act({ type: 'setLight', room, hours: light - 1 })} />
          <Button label="+" compact variant="secondary" disabled={busy || light >= 24} onPress={() => act({ type: 'setLight', room, hours: light + 1 })} />
        </Row>
        {plants.length === 0 ? (
          <Muted>Aucun plant.</Muted>
        ) : (
          <>
            {equip < 1 && <Text style={styles.warning}>⚠️ Matériel insuffisant : pousse à {Math.round(equip * 100)} %. Achète lampes, radiateurs, ventilateurs.</Text>}
            {lightOk < 1 && <Text style={styles.warning}>⚠️ Éclairage mal réglé : pousse à {Math.round(lightOk * 100)} %.</Text>}
            {Number.isFinite(minAutonomy) && (
              <Text style={minAutonomy < 4 ? styles.alert : styles.muted}>
                💧 Autonomie du plant le plus assoiffé : {formatDuration(minAutonomy * HOUR_MS)}
              </Text>
            )}
            {unprotected > 0 && (
              <Text style={styles.muted}>
                {UNPROTECTED_ICON} {unprotected} plant(s) non protégé(s) contre les pucerons.
              </Text>
            )}
            <Muted>{selection.length > 0 ? `${selection.length} plant(s) sélectionné(s) : les actions ne portent que sur eux.` : 'Actions sur toute la salle. Touche des plants pour n’agir que sur eux.'}</Muted>
            <Row wrap>
              <Button label={`Arroser + engrais${suffix}`} disabled={busy} onPress={() => act({ type: 'fillToMax', selector }, 'Arrosé !')} />
              <Button
                label={`Traiter${suffix}`}
                variant="secondary"
                disabled={busy || toTreat === 0}
                onPress={() => act({ type: 'treat', selector }, `${toTreat} plant(s) protégé(s) des pucerons`)}
              />
              <Button
                label={`${anyFrozen ? 'Dégeler' : 'Geler'}${suffix}`}
                variant="secondary"
                disabled={busy}
                onPress={() => act({ type: 'setFrozen', selector, frozen: !anyFrozen })}
              />
              {room === 'flo' && males > 0 && (
                <Button label={`Jeter les mâles (${males})`} variant="danger" disabled={busy} onPress={() => act({ type: 'discardMales' }, 'Mâles jetés')} />
              )}
              {overdosed.length > 0 && (
                <Button label={`Rempoter (${overdosed.length})`} variant="danger" disabled={busy} onPress={() => act({ type: 'repot', plantIds: overdosed.map((p) => p.id) }, 'Rempotés : arrose-les vite !')} />
              )}
            </Row>
          </>
        )}
      </Card>
      {plants.length + dead.length > 0 && (
        <DeferredList active={active}>
          <Card
            title="Plants"
            right={
              plants.length > 0 && (
                <Button
                  label={selection.length === plants.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  compact
                  variant="secondary"
                  onPress={() => setPicked(selection.length === plants.length ? new Set() : new Set(plants.map((p) => p.id)))}
                />
              )
            }
          >
            {[...plants].sort((a, b) => b.height - a.height).map((plant) => (
              <PlantRow key={plant.id} plant={plant} selected={picked.has(plant.id)} onPress={() => toggle(plant.id)} />
            ))}
            {dead.map((plant) => (
              <PlantListItem
                key={plant.id}
                art={<PlantArt stage="dead" size={50} />}
                name={varietyName(plant.variety)}
                detail={`${fmt(plant.height)} cm`}
                tags={[`💀 mort (${deathLabel(plant.deathCause)})`]}
              />
            ))}
            {dead.length > 0 && (
              <Button
                label={`Retirer les morts (${dead.length})`}
                variant="secondary"
                compact
                disabled={busy}
                onPress={() => act({ type: 'discardPlants', plantIds: dead.map((p) => p.id) }, 'Plants morts retirés')}
              />
            )}
          </Card>
        </DeferredList>
      )}
    </>
  );
}

/** Ce qui est affiché d'un plant : la ligne n'est redessinée que si ça change (salles jusqu'à 200 plants). */
function plantRowKey(plant: Plant): string {
  return [plant.id, plant.height.toFixed(0), plant.waterCl.toFixed(1), plant.fertMl.toFixed(1), plant.sex, plant.frozen, plant.overdosed, plant.infested, plant.pollinationHours > 0, isProtected(plant), Number.isFinite(autonomyHours(plant)) && autonomyHours(plant) < LOW_AUTONOMY_HOURS].join('|');
}

const PlantRow = memo(
  PlantRowView,
  (prev, next) => prev.selected === next.selected && plantRowKey(prev.plant) === plantRowKey(next.plant),
);

function PlantRowView({ plant, selected, onPress }: { plant: Plant; selected: boolean; onPress: () => void }) {
  const room = plant.stage as Room;
  const stage = BALANCE.stages[room];
  const start = room === 'veg' ? BALANCE.germination.plantableHeight : BALANCE.stages.veg.endHeight;
  const progress = (plant.height - start) / (stage.endHeight - start);
  const thirsty = !plant.frozen && autonomyHours(plant) < LOW_AUTONOMY_HOURS;
  return (
    <PlantListItem
      art={
        <View>
          <PlantArt stage={room} grow={progress} size={room === 'veg' ? 50 : 62} />
          {!isProtected(plant) && (
            <Text style={styles.unprotected} accessibilityLabel="Non protégé contre les pucerons">
              {UNPROTECTED_ICON}
            </Text>
          )}
        </View>
      }
      selected={selected}
      onPress={onPress}
      name={varietyName(plant.variety)}
      detail={`${fmt(plant.height)} cm`}
      progress={progress}
      tone={plant.overdosed ? 'danger' : thirsty ? 'warning' : 'accent'}
      tags={[
        `💧${fmt1(plant.waterCl)} cl · 🧪${fmt1(plant.fertMl)} ml`,
        plant.stage === 'flo' && (plant.sex === 'male' ? '♂ mâle' : '♀ femelle'),
        plant.frozen && '❄️ gelé',
        plant.overdosed && '☠️ surdosé',
        plant.infested && '🐛 pucerons !',
        plant.pollinationHours > 0 && plant.sex === 'female' && '🌼 pollinisée',
      ]}
    />
  );
}

function Drying({ state, active }: { state: GameState; active: boolean }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const drying = state.plants.filter((p) => p.stage === 'drying');
  const dry = state.plants.filter((p) => p.stage === 'dry');
  if (drying.length + dry.length === 0) {
    return (
      <Card title="Séchage">
        <Muted>Rien ne sèche. Les plants y arrivent tout seuls à la fin de la floraison.</Muted>
      </Card>
    );
  }
  const readyGrams = dry.reduce((sum, p) => sum + p.harvestGrams, 0);
  const readySeeds = dry.reduce((sum, p) => sum + p.harvestSeeds, 0);
  const nextDry = Math.min(...drying.map((p) => p.dryingHoursLeft));

  return (
    <>
      <Card title="Séchage">
        {drying.length > 0 && (
          <Muted>
            {drying.length} plant(s) en séchage · premier prêt dans ~{nextDry} h
          </Muted>
        )}
        {dry.length > 0 && (
          <Button
            label={`Récolter ${fmt(readyGrams)} g${readySeeds ? ` + ${readySeeds} graines` : ''}`}
            disabled={busy}
            onPress={() => act({ type: 'harvest' }, `Récolte : ${fmt(readyGrams)} g dans ta bourse`)}
          />
        )}
      </Card>
      <DeferredList active={active}>
        <Card>
          {[...dry, ...drying].map((plant) => (
            <PlantListItem
              key={plant.id}
              art={<PlantArt stage="drying" size={56} />}
              name={varietyName(plant.variety)}
              detail={`${fmt(plant.harvestGrams)} g`}
              progress={plant.stage === 'dry' ? 1 : 1 - plant.dryingHoursLeft / BALANCE.drying.maxHours}
              tags={[
                plant.stage === 'dry' ? '✅ sec, prêt à récolter' : `⏳ encore ~${plant.dryingHoursLeft} h`,
                plant.harvestSeeds > 0 && `🌰 ${plant.harvestSeeds} graines`,
              ]}
            />
          ))}
        </Card>
      </DeferredList>
    </>
  );
}

const styles = StyleSheet.create({
  alert: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  warning: { color: colors.warning, fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 13 },
  plant: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs, borderRadius: 10 },
  plantSelected: { backgroundColor: colors.surfaceRaised },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.accentText, fontSize: 13, fontWeight: '900' },
  admin: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  unprotected: { position: 'absolute', top: -2, right: -6, fontSize: 15 },
  selectionBar: { gap: spacing.sm, padding: spacing.md, borderRadius: 10, backgroundColor: colors.background },
  panel: { gap: spacing.md },
  hidden: { display: 'none' },
  bubbles: { position: 'absolute', left: 0, right: 0, bottom: spacing.md, pointerEvents: 'box-none' },
  art: { minWidth: 40, alignItems: 'center', justifyContent: 'flex-end' },
  plantBody: { flex: 1, gap: 4 },
  plantName: { color: colors.text, fontWeight: '600', fontSize: 15, flexShrink: 1 },
  plantSize: { color: colors.text, fontWeight: '700', fontSize: 14, fontVariant: ['tabular-nums'] },
});
