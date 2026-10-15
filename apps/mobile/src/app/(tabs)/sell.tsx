import {
  BALANCE,
  bribeCost,
  gameClock,
  HOUR_MS,
  isPlaceOpen,
  marketPrice,
  nextRepriceAt,
  playerPrice,
  saturationFactor,
  soldThisPeriod,
  PLACE_IDS,
  PLACES,
  policeIndexMax,
  VARIETY_IDS,
  type GameState,
  type PlaceId,
  type VarietyId,
} from '@weedapp/engine';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fmt, fmt1, formatDuration, grams, varietyName, wl } from '@/game/labels';
import { useGame, useGameState, useNow } from '@/game/store';
import { PLACE_ICON } from '@/game/icons';
import { Body, Button, Card, Chips, Field, Muted, ProgressBar, Row, Screen, Stat, Tile, TileGrid } from '@/ui/components';
import { Sheet } from '@/ui/Sheet';
import { colors, spacing } from '@/ui/theme';

export default function SellScreen() {
  const state = useGameState();
  const now = useNow();
  if (!state) return null;
  return (
    <Screen>
      <Police state={state} />
      <Prices state={state} now={now} />
      <ActiveSales state={state} />
      <Places state={state} now={now} />
    </Screen>
  );
}

function Police({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const max = policeIndexMax(state);
  const cost = bribeCost(state);
  const ratio = state.policeIndex / max;
  return (
    <Card title="Indice police" right={<Text style={[styles.index, ratio > 0.8 && { color: colors.danger }]}>{fmt(state.policeIndex)} / {fmt(max)}</Text>}>
      <ProgressBar value={ratio} tone={ratio > 0.8 ? 'danger' : ratio > 0.5 ? 'warning' : 'info'} />
      <Muted>
        Au-delà du maximum, les stups débarquent à l'actualisation suivante : amende de {BALANCE.police.raidFinePerIndex} × l'indice, saisie de tout ce qui est
        en vente et perte de ton métier. Sans vente en cours, l'indice baisse chaque heure.
      </Muted>
      {state.raidPending && <Text style={styles.alert}>🚨 Descente imminente !</Text>}
      <Button
        label={`Voir le commissaire corrompu (${wl(cost)})`}
        variant={state.raidPending ? 'danger' : 'secondary'}
        disabled={busy || state.policeIndex <= 0 || state.money < cost}
        onPress={() => act({ type: 'bribe' }, 'Indice remis à zéro. Discrétion assurée.')}
      />
    </Card>
  );
}

/**
 * Prix de revente de la période (Wl/g), comparés à la période précédente, et prix réellement payé
 * au joueur quand il a déjà beaucoup vendu d'une variété (saturation).
 */
function Prices({ state, now }: { state: GameState; now: number }) {
  const previous = now - BALANCE.market.repricePeriodHours * HOUR_MS;
  const { gramsPerTenPercent, floor } = BALANCE.market.saturation;
  return (
    <Card title="Prix de revente">
      <Muted>
        Plus tu vends une même variété, plus ton prix baisse : −10 % tous les {fmt(gramsPerTenPercent)} g, jusqu'à −{Math.round((1 - floor) * 100)} %. Ça repart à
        zéro quand les prix changent.
      </Muted>
      {VARIETY_IDS.map((v) => {
        const price = marketPrice(v, now);
        const before = marketPrice(v, previous);
        const factor = saturationFactor(soldThisPeriod(state, v, now));
        const trend = price > before ? { icon: '▲', color: colors.accent } : price < before ? { icon: '▼', color: colors.danger } : null;
        return (
          <Row key={v}>
            <Body>{varietyName(v)}</Body>
            <View style={{ flex: 1 }} />
            {factor < 1 && (
              <Text style={styles.saturated}>
                {fmt1(price * factor)} pour toi · −{Math.round((1 - factor) * 100)} %
              </Text>
            )}
            {trend && <Text style={[styles.trend, { color: trend.color }]}>{trend.icon}</Text>}
            <Text style={styles.price}>{price} Wl/g</Text>
          </Row>
        );
      })}
    </Card>
  );
}

function ActiveSales({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  if (state.sales.length === 0) return null;
  return (
    <Card title="Ventes en cours">
      {state.sales.map((sale) => {
        const total = sale.gramsLeft + sale.gramsSold;
        return (
          <View key={sale.placeId} style={{ gap: spacing.xs }}>
            <Row>
              <Body bold>{PLACES[sale.placeId].name}</Body>
              <View style={{ flex: 1 }} />
              <Muted>
                {varietyName(sale.variety)} · {grams(sale.gramsSold)}/{grams(total)} · {wl(sale.earned)}
              </Muted>
            </Row>
            <ProgressBar value={sale.gramsSold / total} />
            <Button label="Retirer la vente" compact variant="secondary" disabled={busy} onPress={() => act({ type: 'stopSale', placeId: sale.placeId }, 'Vente retirée')} />
          </View>
        );
      })}
    </Card>
  );
}

function Places({ state, now }: { state: GameState; now: number }) {
  const [selected, setSelected] = useState<PlaceId | null>(null);
  const clock = gameClock(now);
  const place = selected ? PLACES[selected] : null;
  return (
    <>
      <Body bold>Lieux de vente</Body>
      <TileGrid>
        {PLACE_IDS.map((id) => {
          const open = isPlaceOpen(PLACES[id], clock);
          const running = state.sales.some((s) => s.placeId === id);
          return (
            <Tile
              key={id}
              icon={PLACE_ICON[id]}
              title={PLACES[id].name}
              subtitle={PLACES[id].hoursLabel}
              badge={running ? 'en vente' : open ? 'ouvert' : 'fermé'}
              badgeTone={running ? 'warning' : open ? 'accent' : 'muted'}
              dimmed={!open && !running}
              onPress={() => setSelected(id)}
            />
          );
        })}
      </TileGrid>
      <Sheet visible={!!place} onClose={() => setSelected(null)} title={place?.name ?? ''} icon={selected ? PLACE_ICON[selected] : undefined}>
        {selected && <PlaceDetail key={selected} state={state} placeId={selected} now={now} onDone={() => setSelected(null)} />}
      </Sheet>
    </>
  );
}

function PlaceDetail({ state, placeId, now, onDone }: { state: GameState; placeId: PlaceId; now: number; onDone: () => void }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const place = PLACES[placeId];
  const open = isPlaceOpen(place, gameClock(now));
  const sale = state.sales.find((s) => s.placeId === placeId);
  return (
    <>
      <Row wrap>
        <Stat label="Horaires" value={place.hoursLabel} />
      </Row>
      <Row>
        <Stat label="Risque" value={`${place.riskPercent} %`} tone={place.riskPercent >= 0.85 ? 'warning' : undefined} />
        <Stat label="Rente" value={`${place.rentPercent} %`} tone="accent" />
        <Stat label="Débit" value={`${place.capacityPerHour} g/h`} />
      </Row>
      {sale ? (
        <View style={{ gap: spacing.sm }}>
          <Body bold>Vente en cours</Body>
          <Muted>
            {varietyName(sale.variety)} · {grams(sale.gramsSold)}/{grams(sale.gramsLeft + sale.gramsSold)} vendus · {wl(sale.earned)} ramassés
          </Muted>
          <ProgressBar value={sale.gramsSold / (sale.gramsLeft + sale.gramsSold)} />
          <Button
            label="Retirer la vente"
            variant="secondary"
            disabled={busy}
            onPress={async () => {
              if (await act({ type: 'stopSale', placeId }, 'Vente retirée')) onDone();
            }}
          />
        </View>
      ) : open ? (
        <SaleForm state={state} placeId={placeId} now={now} onDone={onDone} />
      ) : (
        <Muted>Fermé pour l'instant. Reviens pendant les horaires d'ouverture ({place.hoursLabel}).</Muted>
      )}
    </>
  );
}

function SaleForm({ state, placeId, now, onDone }: { state: GameState; placeId: PlaceId; now: number; onDone: () => void }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const owned = VARIETY_IDS.filter((v) => state.stock[v] > 0);
  const [variety, setVariety] = useState<VarietyId | undefined>(owned[0]);
  const [amount, setAmount] = useState(String(owned[0] ? state.stock[owned[0]] : 0));
  if (!variety || owned.length === 0) return <Muted>Ta bourse est vide.</Muted>;

  const place = PLACES[placeId];
  const g = Math.max(0, Number.parseInt(amount, 10) || 0);
  const hours = Math.ceil(g / place.capacityPerHour);
  // Estimation au prix saturé actuel (il baisse encore un peu à mesure que la vente avance).
  const earnings = Math.round((g * playerPrice(state, variety, now) * place.rentPercent) / 100);
  const indexGain = g * place.riskPercent * BALANCE.police.indexPerGramRisk;

  return (
    <View style={styles.form}>
      <Chips
        options={owned.map((v) => ({ value: v, label: `${varietyName(v)} (${fmt(state.stock[v])} g)` }))}
        value={variety}
        onChange={(v) => {
          setVariety(v);
          setAmount(String(state.stock[v]));
        }}
      />
      <Field label="Grammes" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Muted>
        ≈ {wl(earnings)} en {hours} h d'ouverture · indice +{fmt(indexGain)} (max {fmt(policeIndexMax(state))})
      </Muted>
      <Button
        label="Lancer la vente"
        disabled={busy || g <= 0}
        onPress={async () => {
          if (await act({ type: 'startSale', placeId, variety, grams: g }, 'Vente lancée')) onDone();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  index: { color: colors.text, fontWeight: '800', fontSize: 16 },
  price: { color: colors.text, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'right' },
  trend: { fontSize: 11 },
  saturated: { color: colors.warning, fontSize: 12 },
  alert: { color: colors.danger, fontWeight: '700' },
  form: { gap: spacing.sm },
});
