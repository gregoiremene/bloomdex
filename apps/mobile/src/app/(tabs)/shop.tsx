import {
  CONSUMABLES,
  EQUIPMENT,
  EQUIPMENT_IDS,
  equipmentCapacity,
  growingPlants,
  marketPrice,
  POT_SIZES,
  POTS,
  SEEDS_PER_PACK,
  shopItemPrice,
  VARIETIES,
  VARIETY_IDS,
  type EquipmentKind,
  type GameState,
  type ShopItem,
} from '@weedapp/engine';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SHOP_ICON } from '@/game/icons';
import { fmt, wl } from '@/game/labels';
import { useGame, useGameState, useNow } from '@/game/store';
import { Body, Button, Card, Chips, Muted, Row, Screen, Stepper, Tile, TileGrid } from '@/ui/components';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing } from '@/ui/theme';

interface Option {
  key: string;
  /** Libellé court de la pastille de sous-type. */
  chip: string;
  name: string;
  detail: string;
  item: ShopItem;
}

interface Category {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeTone?: 'accent' | 'warning' | 'danger' | 'muted';
  hint?: string;
  options: Option[];
}

const EQUIPMENT_LABEL: Record<EquipmentKind, { title: string; icon: string }> = {
  lamp: { title: 'Lampes', icon: SHOP_ICON.lamp },
  heater: { title: 'Radiateurs', icon: SHOP_ICON.heater },
  fan: { title: 'Ventilateurs', icon: SHOP_ICON.fan },
};

function categories(state: GameState, now: number): Category[] {
  const inv = state.inventory;
  const capacity = equipmentCapacity(state);
  const growing = growingPlants(state).length;
  const consumable = (id: keyof typeof CONSUMABLES, chip: string, detail: string): Option => ({
    key: id,
    chip,
    name: CONSUMABLES[id].name,
    detail,
    item: { kind: 'consumable', id },
  });
  const equipment = (kind: EquipmentKind): Category => ({
    key: kind,
    ...EQUIPMENT_LABEL[kind],
    subtitle: `Couvre ${capacity[kind]} plant(s)`,
    badge: growing > 0 ? `${capacity[kind]}/${growing}` : undefined,
    badgeTone: capacity[kind] < growing ? 'danger' : 'accent',
    hint: 'Il faut assez de lampes, radiateurs et ventilateurs pour couvrir tous les plants en pousse (végé + flo).',
    options: EQUIPMENT_IDS.filter((id) => EQUIPMENT[id].kind === kind).map((id) => ({
      key: id,
      chip: kind === 'lamp' ? EQUIPMENT[id].name.replace('Lampe ', '') : `${EQUIPMENT[id].capacity} plants`,
      name: EQUIPMENT[id].name,
      detail: `Couvre ${EQUIPMENT[id].capacity} plants · ${EQUIPMENT[id].watts} W · possédé : ${inv.equipment[id]}`,
      item: { kind: 'equipment', id },
    })),
  });
  const totalSeeds = VARIETY_IDS.reduce((sum, v) => sum + inv.seeds[v], 0);
  const totalPots = POT_SIZES.reduce((sum, size) => sum + inv.pots[size], 0);

  return [
    {
      key: 'seeds',
      icon: SHOP_ICON.seeds,
      title: 'Graines',
      subtitle: `${totalSeeds} en stock`,
      hint: `Paquets de ${SEEDS_PER_PACK}. Toutes les variétés poussent pareil : seuls le prix des graines et la revente changent.`,
      options: VARIETY_IDS.map((v) => ({
        key: v,
        chip: VARIETIES[v].name,
        name: `${VARIETIES[v].name} (paquet de ${SEEDS_PER_PACK})`,
        detail: `Revente actuelle : ${marketPrice(v, now)} Wl/g · en stock : ${inv.seeds[v]}`,
        item: { kind: 'seeds', variety: v },
      })),
    },
    { key: 'soil', icon: SHOP_ICON.soil, title: 'Terreau', subtitle: `${fmt(inv.soilL)} L`, options: [consumable('soil', 'Sac 15 L', `En stock : ${fmt(inv.soilL)} L`)] },
    {
      key: 'fertilizer',
      icon: SHOP_ICON.fertilizer,
      title: 'Engrais',
      subtitle: `Végé ${fmt(inv.fertVegMl)} ml · Flo ${fmt(inv.fertFloMl)} ml`,
      options: [
        consumable('fertVeg', 'Végétation', `En stock : ${fmt(inv.fertVegMl)} ml`),
        consumable('fertFlo', 'Floraison', `En stock : ${fmt(inv.fertFloMl)} ml`),
      ],
    },
    {
      key: 'insecticide',
      icon: SHOP_ICON.insecticide,
      title: 'Insecticide',
      subtitle: `${fmt(inv.insecticideMl)} ml`,
      options: [consumable('insecticide', 'Flacon 50 ml', `En stock : ${fmt(inv.insecticideMl)} ml`)],
    },
    {
      key: 'germKit',
      icon: SHOP_ICON.germKit,
      title: 'Kit de germination',
      subtitle: `${inv.germKits} kit(s)`,
      hint: 'Chaque kit permet de faire germer 15 graines à la fois.',
      options: [consumable('germKit', 'Kit', `Possédés : ${inv.germKits}`)],
    },
    {
      key: 'pot',
      icon: SHOP_ICON.pot,
      title: 'Pots',
      subtitle: `${totalPots} en stock`,
      hint: 'Un plus grand pot demande plus de terreau mais donne une meilleure récolte.',
      options: POT_SIZES.map((size) => ({
        key: `pot${size}`,
        chip: `${size} cm`,
        name: `Pot ${size} cm`,
        detail: `${POTS[size].soilLiters} L de terreau à la plantation · en stock : ${inv.pots[size]}`,
        item: { kind: 'pot', size },
      })),
    },
    equipment('lamp'),
    equipment('heater'),
    equipment('fan'),
  ];
}

export default function ShopScreen() {
  const state = useGameState();
  const now = useNow();
  const [open, setOpen] = useState<string | null>(null);
  if (!state) return null;

  const list = categories(state, now);
  const current = list.find((c) => c.key === open);

  return (
    <Screen>
      <Card>
        <Row>
          <Muted>Bourse</Muted>
          <View style={{ flex: 1 }} />
          <Text style={styles.money}>{wl(state.money)}</Text>
        </Row>
      </Card>
      <TileGrid>
        {list.map((c) => (
          <Tile key={c.key} icon={c.icon} title={c.title} subtitle={c.subtitle} badge={c.badge} badgeTone={c.badgeTone} onPress={() => setOpen(c.key)} />
        ))}
      </TileGrid>
      <Sheet visible={!!current} onClose={() => setOpen(null)} title={current?.title ?? ''} icon={current?.icon}>
        {current && <BuyForm key={current.key} state={state} category={current} onDone={() => setOpen(null)} />}
      </Sheet>
    </Screen>
  );
}

function BuyForm({ state, category, onDone }: { state: GameState; category: Category; onDone: () => void }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const [selected, setSelected] = useState(category.options[0]!.key);
  const [quantity, setQuantity] = useState(1);
  const option = category.options.find((o) => o.key === selected) ?? category.options[0]!;
  const unit = shopItemPrice(option.item);
  const total = unit * quantity;
  const affordable = Math.floor(state.money / unit);

  return (
    <>
      {category.hint && <Muted>{category.hint}</Muted>}
      {category.options.length > 1 && <Chips options={category.options.map((o) => ({ value: o.key, label: o.chip }))} value={option.key} onChange={setSelected} />}
      <View style={styles.detail}>
        <Row>
          <Body bold>{option.name}</Body>
          <View style={{ flex: 1 }} />
          <Text style={styles.unit}>{wl(unit)}</Text>
        </Row>
        <Muted>{option.detail}</Muted>
      </View>
      <Muted>Quantité</Muted>
      <Stepper value={quantity} onChange={setQuantity} max={Math.max(1, Math.min(9999, affordable))} />
      <Row>
        <Muted>Bourse : {wl(state.money)}</Muted>
        <View style={{ flex: 1 }} />
        <Text style={[styles.total, total > state.money && { color: colors.danger }]}>Total {wl(total)}</Text>
      </Row>
      <Button
        label={total > state.money ? 'Pas assez de weedlars' : `Acheter ×${quantity}`}
        disabled={busy || total > state.money}
        loading={busy}
        onPress={async () => {
          if (await act({ type: 'buy', item: option.item, quantity }, `Acheté : ${option.name} ×${quantity}`)) onDone();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  money: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  detail: { gap: 4, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.background },
  unit: { color: colors.text, fontWeight: '700', fontSize: 15 },
  total: { color: colors.text, fontWeight: '800', fontSize: 17 },
});
