import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

export type ArtStage = 'germ' | 'veg' | 'flo' | 'drying' | 'dead' | 'deadGerm';

const LEAF = '#5DBB63';
const LEAF_DARK = '#3E8E47';
const STEM = '#4A7A3A';
const POT = '#C46A3C';
const POT_RIM = '#A4532C';
const SOIL = '#5B3A24';
const BUD = '#9BD07A';
const PISTIL = '#E8913A';
const DRY_LEAF = '#9C9A4E';
const DRY_BUD = '#B5A55A';
const DRY_PISTIL = '#A0602A';
const DEAD = '#6E6A5C';

/**
 * Dessin accumulé en un tracé par couleur : react-native-svg crée un élément natif par forme,
 * et une salle peut afficher des centaines de plants. Une feuille = 5 ellipses, une tête = 6 cercles :
 * on les fusionne au lieu d'en faire des dizaines d'éléments par plant.
 */
class Drawing {
  /** Calques dans l'ordre de dessin ; une couleur de remplissage prend la place de sa première apparition. */
  readonly layers: ({ kind: 'fill'; color: string } | { kind: 'stroke'; color: string; width: number; d: string })[] = [];
  readonly fills = new Map<string, string>();

  fill(color: string, d: string): void {
    if (!this.fills.has(color)) this.layers.push({ kind: 'fill', color });
    this.fills.set(color, (this.fills.get(color) ?? '') + d);
  }

  stroke(color: string, width: number, d: string): void {
    this.layers.push({ kind: 'stroke', color, width, d });
  }

  /** Ellipse centrée en (cx, cy), axe `rx` tourné de `deg` degrés. */
  ellipse(color: string, cx: number, cy: number, rx: number, ry: number, deg = 0): void {
    const a = (deg * Math.PI) / 180;
    const dx = rx * Math.cos(a);
    const dy = rx * Math.sin(a);
    const arc = `A${n(rx)} ${n(ry)} ${n(deg)} 0 1`;
    this.fill(color, `M${n(cx - dx)} ${n(cy - dy)}${arc} ${n(cx + dx)} ${n(cy + dy)}${arc} ${n(cx - dx)} ${n(cy - dy)}Z`);
  }

  /** Feuille de cannabis stylisée : folioles en éventail autour de (x, y), orientée selon `angle`. */
  leaf(color: string, x: number, y: number, size: number, angle: number): void {
    for (const { rot, len } of LEAFLETS) {
      const total = angle + rot;
      const [ox, oy] = rotate(0, (-size * len) / 2, total);
      this.ellipse(color, x + ox, y + oy, size * 0.13, (size * len) / 2, total);
    }
  }

  /** Tête de floraison : grappe de calices avec quelques pistils (`flip` = tête en bas). */
  bud(x: number, y: number, r: number, color = BUD, pistil = PISTIL, flip = false): void {
    const s = flip ? -1 : 1;
    this.ellipse(color, x, y, r * 0.8, r * 1.2);
    this.ellipse(color, x - s * r * 0.4, y + s * r * 0.3, r * 0.55, r * 0.55);
    this.ellipse(color, x + s * r * 0.4, y + s * r * 0.3, r * 0.55, r * 0.55);
    this.ellipse(pistil, x - s * r * 0.2, y - s * r * 0.4, r * 0.14, r * 0.14);
    this.ellipse(pistil, x + s * r * 0.3, y, r * 0.14, r * 0.14);
    this.ellipse(pistil, x - s * r * 0.3, y + s * r * 0.5, r * 0.14, r * 0.14);
  }

  pot(): void {
    this.fill(POT, 'M15 40L33 40L31 47L17 47Z');
    this.fill(POT_RIM, 'M15 38H33A1 1 0 0 1 34 39V40A1 1 0 0 1 33 41H15A1 1 0 0 1 14 40V39A1 1 0 0 1 15 38Z');
  }
}

const LEAFLETS = [
  { rot: -70, len: 0.5 },
  { rot: -35, len: 0.8 },
  { rot: 0, len: 1 },
  { rot: 35, len: 0.8 },
  { rot: 70, len: 0.5 },
];

function rotate(x: number, y: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

/** Arrondi à 2 décimales : tracés plus courts, rendu identique. */
function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function drawGerm(d: Drawing, grow: number): void {
  const h = 6 + grow * 8;
  d.ellipse(SOIL, 24, 44, 13, 4);
  d.stroke(STEM, 1.6, `M24 43Q22 ${n(43 - h / 2)} 24 ${n(43 - h)}`);
  d.ellipse(LEAF, 20.5, 43 - h, 3.6, 2, -25);
  d.ellipse(LEAF, 27.5, 43 - h, 3.6, 2, 25);
}

/** Germe fané, tige couchée. */
function drawDeadGerm(d: Drawing): void {
  d.ellipse(SOIL, 24, 44, 13, 4);
  d.stroke(DEAD, 1.6, 'M24 43Q24 36 31 35');
  d.ellipse(DEAD, 32, 37, 3.4, 1.8, 60);
  d.ellipse(DEAD, 30, 38.5, 3.4, 1.8, 110);
}

function drawVeg(d: Drawing, grow: number): void {
  const top = 26 - grow * 10;
  const leaf = 7 + grow * 3;
  d.pot();
  d.stroke(STEM, 1.8, `M24 39L24 ${n(top)}`);
  d.leaf(LEAF_DARK, 24, 35, leaf, -75);
  d.leaf(LEAF_DARK, 24, 35, leaf, 75);
  if (grow > 0.4) {
    d.leaf(LEAF, 24, (35 + top) / 2, leaf * 0.9, -60);
    d.leaf(LEAF, 24, (35 + top) / 2, leaf * 0.9, 60);
  }
  d.leaf(LEAF, 24, top + 1, leaf * 0.8, 0);
}

function drawFlo(d: Drawing, grow: number): void {
  const top = 9 - grow * 4;
  const bud = 2.4 + grow * 1.6;
  d.pot();
  d.stroke(STEM, 2, `M24 39L24 ${n(top + 3)}`);
  d.leaf(LEAF_DARK, 24, 35, 11, -80);
  d.leaf(LEAF_DARK, 24, 35, 11, 80);
  d.leaf(LEAF, 24, 26, 10, -65);
  d.leaf(LEAF, 24, 26, 10, 65);
  d.leaf(LEAF, 24, 18, 8, -55);
  d.leaf(LEAF, 24, 18, 8, 55);
  d.bud(16, 25, bud * 0.8);
  d.bud(32, 25, bud * 0.8);
  d.bud(24, top + 3, bud);
}

/** Plant suspendu tête en bas à une ficelle. */
function drawDrying(d: Drawing): void {
  d.stroke('#8A7A62', 1.2, 'M4 5L44 5');
  d.stroke('#7A6A3A', 1.8, 'M24 5L24 36');
  d.leaf(DRY_LEAF, 24, 12, 9, -110);
  d.leaf(DRY_LEAF, 24, 12, 9, 110);
  d.leaf(DRY_LEAF, 24, 22, 8, -125);
  d.leaf(DRY_LEAF, 24, 22, 8, 125);
  d.bud(18, 18, 2.6, DRY_BUD, DRY_PISTIL);
  d.bud(30, 18, 2.6, DRY_BUD, DRY_PISTIL);
  d.bud(24, 38, 3.6, DRY_BUD, DRY_PISTIL, true);
}

function drawDead(d: Drawing): void {
  d.pot();
  d.stroke(DEAD, 1.8, 'M24 39Q24 28 31 24');
  d.leaf(DEAD, 24, 34, 8, -130);
  d.leaf(DEAD, 24, 34, 8, 130);
  d.leaf(DEAD, 31, 24, 7, 150);
}

const DRAW: Record<ArtStage, (d: Drawing, grow: number) => void> = {
  germ: drawGerm,
  veg: drawVeg,
  flo: drawFlo,
  drying: drawDrying,
  dead: drawDead,
  deadGerm: drawDeadGerm,
};

/** Paliers d'avancement : au-delà, la différence ne se voit pas et le dessin n'est pas recalculé. */
const GROW_STEPS = 20;

/**
 * Illustration d'un plant selon son stade. `grow` (0 → 1) = avancement dans le stade :
 * le plant grandit à l'intérieur de son cadre, qui lui-même grandit d'un stade à l'autre.
 */
export function PlantArt({ stage, grow = 0, size = 56 }: { stage: ArtStage; grow?: number; size?: number }) {
  return <PlantArtSvg stage={stage} step={Math.round(Math.max(0, Math.min(1, grow)) * GROW_STEPS)} size={size} />;
}

const PlantArtSvg = memo(function PlantArtSvg({ stage, step, size }: { stage: ArtStage; step: number; size: number }) {
  const d = new Drawing();
  DRAW[stage](d, step / GROW_STEPS);
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {d.layers.map((layer, i) =>
        layer.kind === 'fill' ? (
          <Path key={i} d={d.fills.get(layer.color)} fill={layer.color} />
        ) : (
          <Path key={i} d={layer.d} stroke={layer.color} strokeWidth={layer.width} fill="none" strokeLinecap="round" />
        ),
      )}
    </Svg>
  );
});
