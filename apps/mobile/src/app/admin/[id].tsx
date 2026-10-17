import {
  advance,
  BALANCE,
  EQUIPMENT,
  EQUIPMENT_IDS,
  equipmentCapacity,
  germinationCapacity,
  growingPlants,
  HOUSINGS,
  isProtected,
  JOBS,
  marketPeriod,
  PLACES,
  policeIndexMax,
  POT_SIZES,
  VARIETY_IDS,
  type GameState,
  type Plant,
} from '@weedapp/engine';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { deathLabel, fmt, fmt1, formatTime, grams, logText, varietyName, wl } from '@/game/labels';
import { useNow } from '@/game/store';
import { supabase } from '@/lib/supabase';
import { Button, Card, Muted, Screen } from '@/ui/components';
import { colors, spacing } from '@/ui/theme';
import { ago, type AdminPlayerRow } from './index';

const STAGE_LABEL: Record<Plant['stage'], string> = { veg: 'Végé', flo: 'Flo', drying: 'Séchage', dry: 'Sec', dead: 'Mort' };

/** Fiche admin d'un joueur : sa partie projetée à l'heure actuelle, section par section. Lecture seule. */
export default function AdminPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useSession((s) => s.profile?.role);
  const now = useNow();
  const [row, setRow] = useState<AdminPlayerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!supabase || !id) return;
    void supabase
      .from('player_states')
      .select('user_id, state, updated_at, profiles(pseudo, role, created_at)')
      .eq('user_id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRow(data as unknown as AdminPlayerRow | null);
      });
  }, [id]);

  // La partie n'est enregistrée qu'aux actions du joueur : on rejoue les heures écoulées, comme le fera le serveur.
  const projected = useMemo(() => (row ? advance(row.state, now) : null), [row, now]);

  if (role !== 'admin') {
    return (
      <Screen>
        <Card>
          <Muted>Réservé aux admins.</Muted>
        </Card>
      </Screen>
    );
  }
  if (error) return <Screen><Card><Text style={{ color: colors.danger }}>{error}</Text></Card></Screen>;
  if (!row || !projected) return <Screen><Card><Muted>Chargement…</Muted></Card></Screen>;

  const s = projected.state;
  const pseudo = row.profiles?.pseudo ?? '?';

  return (
    <Screen>
      <Stack.Screen options={{ title: pseudo }} />
      <Profile row={row} state={s} ticks={projected.ticks} />
      <Economy state={s} />
      <Stock state={s} now={now} />
      <Inventory state={s} />
      <Culture state={s} />
      <Sales state={s} />
      <Journal state={s} />
      <Card title="Données brutes">
        <Muted>L'état tel qu'enregistré en base (avant rattrapage des heures écoulées).</Muted>
        <Button label={showRaw ? 'Masquer' : 'Afficher le JSON'} compact variant="secondary" onPress={() => setShowRaw(!showRaw)} />
        {showRaw && (
          <Text style={styles.raw} selectable>
            {JSON.stringify(row.state, null, 1)}
          </Text>
        )}
      </Card>
    </Screen>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{children}</Text>
    </View>
  );
}

function Profile({ row, state, ticks }: { row: AdminPlayerRow; state: GameState; ticks: number }) {
  return (
    <Card title="Profil">
      <Line label="Rôle">{row.profiles?.role ?? '?'}</Line>
      <Line label="Inscrit le">{row.profiles ? new Date(row.profiles.created_at).toLocaleDateString('fr-FR') : '?'}</Line>
      <Line label="Dernière action">
        {formatTime(new Date(row.updated_at).getTime())} ({ago(row.updated_at)})
      </Line>
      <Line label="Heures à rattraper">{ticks} (rejouées ici, comme le fera le serveur)</Line>
      <Line label="Identifiant">{row.user_id}</Line>
      <Line label="Habitation">
        {HOUSINGS[state.housing].name} ({HOUSINGS[state.housing].plantCapacity} plants)
      </Line>
    </Card>
  );
}

function Economy({ state }: { state: GameState }) {
  return (
    <Card title="Économie">
      <Line label="Bourse">{wl(state.money)}</Line>
      <Line label="Livret">{wl(state.bankBalance)}</Line>
      <Line label="Métier">{JOBS[state.job].name}</Line>
      <Line label="Gardes du corps">{state.guards}</Line>
      <Line label="Indice police">
        {fmt(state.policeIndex)} / {fmt(policeIndexMax(state))}
        {state.raidPending ? ' · 🚨 descente imminente' : ''}
      </Line>
      <Line label="Attaques aujourd'hui">
        {state.thefts.count} / {BALANCE.theft.attacksPerDay}
      </Line>
      <Line label="Conso. de la semaine">
        {fmt(state.meters.waterCl)} cl d'eau · {fmt1(state.meters.kwh)} kWh
      </Line>
    </Card>
  );
}

function Stock({ state, now }: { state: GameState; now: number }) {
  const owned = VARIETY_IDS.filter((v) => state.stock[v] > 0);
  const sold = state.marketSold.period === marketPeriod(now) ? state.marketSold.grams : {};
  const soldIds = VARIETY_IDS.filter((v) => (sold[v] ?? 0) > 0);
  return (
    <Card title="Beuh">
      {owned.length === 0 && <Muted>Aucun stock.</Muted>}
      {owned.map((v) => (
        <Line key={v} label={varietyName(v)}>
          {grams(state.stock[v])}
        </Line>
      ))}
      {soldIds.length > 0 && (
        <>
          <Muted>Vendu pendant la période de prix (saturation) :</Muted>
          {soldIds.map((v) => (
            <Line key={v} label={varietyName(v)}>
              {grams(sold[v] ?? 0)}
            </Line>
          ))}
        </>
      )}
    </Card>
  );
}

function Inventory({ state }: { state: GameState }) {
  const inv = state.inventory;
  const seeds = VARIETY_IDS.filter((v) => inv.seeds[v] > 0);
  const equipment = EQUIPMENT_IDS.filter((e) => inv.equipment[e] > 0);
  const capacity = equipmentCapacity(state);
  // Seuls les plants en végé et en flo ont besoin du matériel.
  const growing = growingPlants(state).length;
  return (
    <Card title="Inventaire">
      <Line label="Graines">{seeds.length === 0 ? 'aucune' : seeds.map((v) => `${varietyName(v)} ×${inv.seeds[v]}`).join(', ')}</Line>
      <Line label="Pots">{POT_SIZES.map((p) => `${p} cm ×${inv.pots[p]}`).join(', ')}</Line>
      <Line label="Terreau">{fmt(inv.soilL)} L</Line>
      <Line label="Engrais">
        végé {fmt(inv.fertVegMl)} ml · flo {fmt(inv.fertFloMl)} ml
      </Line>
      <Line label="Insecticide">{fmt(inv.insecticideMl)} ml</Line>
      <Line label="Kits de germination">{inv.germKits}</Line>
      <Line label="Matériel">{equipment.length === 0 ? 'aucun' : equipment.map((e) => `${EQUIPMENT[e].name} ×${inv.equipment[e]}`).join(', ')}</Line>
      <Line label="Couverture">
        lampes {capacity.lamp} · radiateurs {capacity.heater} · ventilos {capacity.fan} · {growing} plant{growing > 1 ? 's' : ''} en pousse
      </Line>
    </Card>
  );
}

function Culture({ state }: { state: GameState }) {
  const germs = state.germs;
  const ready = germs.filter((g) => !g.dead && g.height >= BALANCE.germination.plantableHeight).length;
  const deadGerms = germs.filter((g) => g.dead).length;
  const plants = [...state.plants].sort((a, b) => a.stage.localeCompare(b.stage) || b.height - a.height);
  return (
    <Card title="Culture">
      <Line label="Éclairage">
        végé {state.lightHours.veg} h · flo {state.lightHours.flo} h
      </Line>
      <Line label="Germes">
        {germs.length} / {germinationCapacity(state)} · {ready} prêt(s) · {deadGerms} mort(s)
      </Line>
      <Line label="Plants">
        {(['veg', 'flo', 'drying', 'dry', 'dead'] as const)
          .map((stage) => `${STAGE_LABEL[stage]} ${state.plants.filter((p) => p.stage === stage).length}`)
          .join(' · ')}
      </Line>
      {plants.map((p) => (
        <View key={p.id} style={styles.plant}>
          <Text style={styles.plantTitle}>
            #{p.id} {varietyName(p.variety)} · {STAGE_LABEL[p.stage]} · {fmt(p.height)} cm
          </Text>
          <Text style={styles.plantDetail}>
            {plantDetail(p)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

function plantDetail(p: Plant): string {
  const parts: string[] = [];
  if (p.stage === 'veg' || p.stage === 'flo') {
    parts.push(`💧${fmt1(p.waterCl)} cl`, `🧪${fmt1(p.fertMl)} ml`, `pot ${p.potSize}`, `indice ${fmt1(p.devIndex)}`);
    parts.push(isProtected(p) ? 'protégé' : '🐜 non protégé');
    if (p.stage === 'flo') parts.push(p.sex === 'male' ? '♂' : '♀');
    if (p.frozen) parts.push('❄️ gelé');
    if (p.overdosed) parts.push(`☠️ surdosé ${p.overdoseHours} h`);
    if (p.infested) parts.push('🐛 pucerons');
    if (p.pollinationHours > 0) parts.push(`🌼 pollinisé ${p.pollinationHours} h`);
    if (p.growthHours > 0) parts.push(`conditions ${Math.round((p.conditionSum / p.growthHours) * 100)} %`);
  } else if (p.stage === 'drying' || p.stage === 'dry') {
    parts.push(`${grams(p.harvestGrams)}`, `${p.harvestSeeds} graines`);
    if (p.stage === 'drying') parts.push(`encore ${p.dryingHoursLeft} h`);
  } else {
    parts.push(`mort (${deathLabel(p.deathCause)})`, p.diedIn ? `en ${STAGE_LABEL[p.diedIn]}` : '');
  }
  return parts.filter(Boolean).join(' · ');
}

function Sales({ state }: { state: GameState }) {
  if (state.sales.length === 0) return null;
  return (
    <Card title="Ventes en cours">
      {state.sales.map((sale) => (
        <Line key={sale.placeId} label={PLACES[sale.placeId].name}>
          {varietyName(sale.variety)} · {grams(sale.gramsSold)} / {grams(sale.gramsSold + sale.gramsLeft)} · {wl(sale.earned)}
        </Line>
      ))}
    </Card>
  );
}

function Journal({ state }: { state: GameState }) {
  return (
    <Card title={`Journal (${state.log.length})`}>
      {state.log.length === 0 && <Muted>Rien pour l'instant.</Muted>}
      {state.log.map((entry, i) => (
        <View key={i} style={styles.logLine}>
          <Text style={styles.logTime}>{formatTime(entry.at)}</Text>
          <Text style={styles.logText}>{logText(entry)}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 },
  label: { color: colors.textMuted, fontSize: 13, flexShrink: 0 },
  value: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  plant: { paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 2 },
  plantTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  plantDetail: { color: colors.textMuted, fontSize: 12 },
  logLine: { paddingVertical: 3, gap: 1 },
  logTime: { color: colors.textMuted, fontSize: 11 },
  logText: { color: colors.text, fontSize: 13 },
  raw: { color: colors.textMuted, fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
});
