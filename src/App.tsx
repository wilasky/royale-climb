import { useState, useMemo, useCallback, useRef } from "react";
import { RelicBadge } from "./relicIcons";

/* ============================================================
   ROYALE CLIMB — Roguelike de cartas con combos de póker
   Un solo archivo. React + TS + Tailwind core. Pixel-art CSS puro.
   ============================================================ */

/* ---------------- Tipos ---------------- */
type Suit = "spades" | "hearts" | "diamonds" | "clubs";
type Rarity = "common" | "rare" | "epic" | "legendary";
type Screen = "menu" | "play" | "reward" | "shop" | "defeat" | "win";

interface Card {
  id: string;
  suit: Suit;
  rank: number; // 2..14 (11=J,12=Q,13=K,14=A)
  bonusChips: number;
  glass: boolean;
  steel: boolean;
  gold: boolean;
}

interface Relic {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
}

interface HandResult {
  name: string;
  baseChips: number;
  baseMult: number;
}

/* ---------------- Constantes ---------------- */
const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const SUIT_GLYPH: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
const SUIT_COLOR: Record<Suit, string> = {
  spades: "text-slate-100",
  clubs: "text-slate-100",
  hearts: "text-rose-400",
  diamonds: "text-amber-300",
};
const RANK_LABEL: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const rankLabel = (r: number) => RANK_LABEL[r] ?? String(r);

const RARITY_RING: Record<Rarity, string> = {
  common: "ring-slate-500",
  rare: "ring-sky-400",
  epic: "ring-fuchsia-400",
  legendary: "ring-amber-300",
};
const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-slate-300",
  rare: "text-sky-300",
  epic: "text-fuchsia-300",
  legendary: "text-amber-300",
};
const RARITY_ACCENT: Record<Rarity, string> = {
  common: "border-slate-400 text-slate-300",
  rare: "border-sky-400 text-sky-300",
  epic: "border-fuchsia-400 text-fuchsia-300",
  legendary: "border-amber-300 text-amber-300",
};
const RARITY_GLOW: Record<Rarity, string> = {
  common: "",
  rare: "shadow-[0_0_12px_-2px_rgba(56,189,248,0.6)]",
  epic: "shadow-[0_0_14px_-2px_rgba(232,121,249,0.7)]",
  legendary: "shadow-[0_0_18px_-1px_rgba(252,211,77,0.8)]",
};

/* ---------------- Sprites de palos (pixel-art con sombreado) ----------------
   Cada palo se dibuja a 16x16 con 4 tonos: contorno, sombra, base, brillo.
   Devuelve un grid de celdas. Reutilizable a cualquier escala. */
type PixGrid = number[][]; // 0=vacío 1=contorno 2=sombra 3=base 4=brillo

const SPADE_16: PixGrid = [
  [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,4,3,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,4,3,3,2,1,0,0,0,0,0],
  [0,0,0,0,1,4,3,3,3,2,2,1,0,0,0,0],
  [0,0,0,1,4,3,3,3,3,2,2,2,1,0,0,0],
  [0,0,1,4,3,3,3,3,3,2,2,2,2,1,0,0],
  [0,1,4,3,3,3,3,3,3,3,2,2,2,2,1,0],
  [1,4,3,3,3,3,3,3,3,3,3,2,2,2,2,1],
  [1,4,3,3,3,3,3,3,3,3,3,3,2,2,2,1],
  [1,2,4,3,3,3,3,3,3,3,3,2,2,2,1,1],
  [0,1,2,2,3,3,3,1,1,3,3,2,2,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,0,0,1,4,3,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,4,3,3,2,1,0,0,0,0,0],
  [0,0,0,0,1,4,3,3,3,2,2,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
];
const HEART_16: PixGrid = [
  [0,0,1,1,1,0,0,0,0,0,1,1,1,0,0,0],
  [0,1,4,3,3,1,0,0,0,1,4,3,3,1,0,0],
  [1,4,3,3,3,3,1,0,1,4,3,3,3,2,1,0],
  [1,4,3,3,3,3,3,1,4,3,3,3,3,2,1,0],
  [1,4,3,3,3,3,3,3,3,3,3,3,2,2,1,0],
  [1,4,3,3,3,3,3,3,3,3,3,2,2,2,1,0],
  [1,2,3,3,3,3,3,3,3,3,3,2,2,2,1,0],
  [0,1,2,3,3,3,3,3,3,3,3,2,2,1,0,0],
  [0,1,2,2,3,3,3,3,3,3,2,2,2,1,0,0],
  [0,0,1,2,2,3,3,3,3,2,2,2,1,0,0,0],
  [0,0,0,1,2,2,3,3,2,2,2,1,0,0,0,0],
  [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,2,2,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,2,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];
const DIAMOND_16: PixGrid = [
  [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,4,3,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,4,3,3,2,1,0,0,0,0,0],
  [0,0,0,0,1,4,3,3,3,2,2,1,0,0,0,0],
  [0,0,0,1,4,3,3,3,3,3,2,2,1,0,0,0],
  [0,0,1,4,3,3,3,3,3,3,3,2,2,1,0,0],
  [0,1,4,3,3,3,3,3,3,3,3,3,2,2,1,0],
  [1,4,3,3,3,3,3,3,3,3,3,3,3,2,2,1],
  [1,2,3,3,3,3,3,3,3,3,3,3,3,2,2,1],
  [0,1,2,3,3,3,3,3,3,3,3,3,2,2,1,0],
  [0,0,1,2,3,3,3,3,3,3,3,2,2,1,0,0],
  [0,0,0,1,2,3,3,3,3,3,2,2,1,0,0,0],
  [0,0,0,0,1,2,3,3,3,2,2,1,0,0,0,0],
  [0,0,0,0,0,1,2,3,2,2,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
];
const CLUB_16: PixGrid = [
  [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,1,4,3,3,3,2,1,0,0,0,0,0],
  [0,0,0,1,4,3,3,3,3,2,2,1,0,0,0,0],
  [0,0,0,1,4,3,3,3,3,2,2,1,0,0,0,0],
  [0,0,0,1,2,3,3,3,3,2,2,1,0,0,0,0],
  [0,1,1,1,1,2,3,3,2,1,1,1,1,0,0,0],
  [1,4,3,3,1,2,3,3,2,1,3,3,2,1,0,0],
  [1,4,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
  [1,4,3,3,3,3,3,3,3,3,3,3,2,1,0,0],
  [1,2,3,3,3,3,3,3,3,3,3,2,2,1,0,0],
  [0,1,2,2,3,3,3,1,1,3,3,2,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,4,3,2,1,0,0,0,0,0,0],
  [0,0,0,0,1,4,3,3,3,2,1,0,0,0,0,0],
  [0,0,0,1,4,3,3,3,3,2,2,1,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
];
const SUIT_SPRITE: Record<Suit, PixGrid> = {
  spades: SPADE_16,
  hearts: HEART_16,
  diamonds: DIAMOND_16,
  clubs: CLUB_16,
};

/* paleta por palo: [contorno, sombra, base, brillo] */
const SUIT_PALETTE: Record<Suit, [string, string, string, string]> = {
  spades: ["#0b0f1a", "#334155", "#64748b", "#cbd5e1"],
  clubs: ["#0b0f1a", "#334155", "#64748b", "#cbd5e1"],
  hearts: ["#3f0a16", "#9f1239", "#e11d48", "#fda4af"],
  diamonds: ["#3a2406", "#b45309", "#f59e0b", "#fde68a"],
};

function PixSprite({
  grid,
  px,
  palette,
}: {
  grid: PixGrid;
  px: number;
  palette: [string, string, string, string];
}) {
  const w = grid[0].length;
  const h = grid.length;
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${w}, ${px}px)`,
        gridTemplateRows: `repeat(${h}, ${px}px)`,
        imageRendering: "pixelated",
      }}
    >
      {grid.flatMap((row, y) =>
        row.map((cell, x) => (
          <div
            key={`${x}-${y}`}
            style={{
              width: px,
              height: px,
              background:
                cell === 0 ? "transparent" : palette[cell - 1],
            }}
          />
        ))
      )}
    </div>
  );
}

function PixelSuit({ suit, px }: { suit: Suit; px: number }) {
  return (
    <PixSprite
      grid={SUIT_SPRITE[suit]}
      px={px}
      palette={SUIT_PALETTE[suit]}
    />
  );
}

/* ---------------- Sprite de figura (J/Q/K) ----------------
   Un retrato base 16x20 que se tinta con la paleta del palo.
   La corona cambia ligeramente por rango via overlay. */
const FACE_16x20: PixGrid = [
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,4,4,4,4,1,0,0,0,0,0],
  [0,0,0,0,1,4,1,4,4,1,4,1,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0],
  [0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
  [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
  [0,0,0,1,3,4,3,3,3,3,4,3,1,0,0,0],
  [0,0,0,1,3,1,3,3,3,3,1,3,1,0,0,0],
  [0,0,0,1,3,3,3,1,1,3,3,3,1,0,0,0],
  [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
  [0,0,0,1,2,3,1,1,1,1,3,2,1,0,0,0],
  [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
  [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
  [0,0,1,1,4,4,2,2,2,2,4,4,1,1,0,0],
  [0,1,4,4,4,4,4,2,2,4,4,4,4,4,1,0],
  [1,4,4,4,4,4,4,4,4,4,4,4,4,4,4,1],
  [1,4,4,4,1,4,4,4,4,4,4,1,4,4,4,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

/* paleta de figura: contorno oscuro, ropa(sombra), piel(base), oro(brillo) */
function facePalette(suit: Suit): [string, string, string, string] {
  const isRed = suit === "hearts" || suit === "diamonds";
  return [
    "#1a1206",
    isRed ? "#9f1239" : "#1e3a5f", // ropa
    "#f0c89a", // piel
    "#fbbf24", // oro corona/detalle
  ];
}

/* ---------------- Reverso de carta ---------------- */
function CardBack({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="relative overflow-hidden border-[3px] border-slate-950"
      style={{ width: w, height: h }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fbbf2433 0 4px, transparent 4px 8px), repeating-linear-gradient(-45deg, #818cf833 0 4px, transparent 4px 8px)",
        }}
      />
      <div className="absolute inset-1.5 border-2 border-amber-400/40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-amber-300/70" style={{ fontSize: w * 0.4 }}>
          ♛
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sistema de partículas ---------------- */
interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  dr: number;
  color: string;
  size: number;
  glyph: string;
}

let particleCounter = 0;

function makeBurst(x: number, y: number, count: number, big: boolean): Particle[] {
  const colors = ["#fbbf24", "#fb7185", "#38bdf8", "#34d399", "#e879f9", "#e2e8f0"];
  const glyphs = ["♠", "♥", "♦", "♣", "★", "✦"];
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = (big ? 80 : 50) + Math.random() * (big ? 90 : 55);
    out.push({
      id: particleCounter++,
      x,
      y,
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist - 24,
      dr: (Math.random() - 0.5) * 480,
      color: colors[(Math.random() * colors.length) | 0],
      size: (big ? 7 : 5) + Math.random() * (big ? 7 : 5),
      glyph: glyphs[(Math.random() * glyphs.length) | 0],
    });
  }
  return out;
}

function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute font-black"
          style={
            {
              left: p.x,
              top: p.y,
              fontSize: p.size,
              color: p.color,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--dr": `${p.dr}deg`,
              animation: "rcparticle 0.9s ease-out forwards",
              textShadow: "0 0 6px currentColor",
            } as React.CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}

/* ---------------- RNG con semilla (mulberry32) ---------------- */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const shuffle = <T,>(rng: Rng, arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

let cardCounter = 0;
const newCard = (suit: Suit, rank: number): Card => ({
  id: `c${cardCounter++}`,
  suit,
  rank,
  bonusChips: 0,
  glass: false,
  steel: false,
  gold: false,
});

function buildStartingDeck(): Card[] {
  cardCounter = 0;
  const deck: Card[] = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push(newCard(s, r));
  return deck;
}

/* ---------------- Evaluación de combinaciones ---------------- */
function evaluateHand(cards: Card[]): HandResult {
  if (cards.length === 0) return { name: "—", baseChips: 0, baseMult: 0 };
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const counts: Record<number, number> = {};
  ranks.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const countVals = Object.values(counts).sort((a, b) => b - a);
  const uniqueRanks = Object.keys(counts).length;

  const isFlush = cards.length === 5 && suits.every((s) => s === suits[0]);
  const reds = cards.filter(
    (c) => c.suit === "hearts" || c.suit === "diamonds"
  ).length;
  const isSpectrum =
    cards.length === 5 && (reds === 5 || reds === 0) && !isFlush;

  let isStraight = false;
  if (cards.length === 5 && uniqueRanks === 5) {
    const lo = ranks[0];
    isStraight = ranks.every((r, i) => r === lo + i);
    if (!isStraight) {
      const alt = [...ranks];
      if (alt[4] === 14) {
        const low = [2, 3, 4, 5, 14].sort((a, b) => a - b);
        isStraight = JSON.stringify(alt) === JSON.stringify(low);
      }
    }
  }

  if (isStraight && isFlush)
    return { name: "Escalera de color", baseChips: 100, baseMult: 8 };
  if (countVals[0] === 4) return { name: "Póker", baseChips: 60, baseMult: 7 };
  if (countVals[0] === 3 && countVals[1] === 2)
    return { name: "Full", baseChips: 40, baseMult: 4 };
  if (isFlush) return { name: "Color", baseChips: 35, baseMult: 4 };
  if (isStraight) return { name: "Escalera", baseChips: 30, baseMult: 4 };
  if (isSpectrum) return { name: "Espectro", baseChips: 45, baseMult: 5 };
  if (countVals[0] === 3) return { name: "Trío", baseChips: 30, baseMult: 3 };
  if (countVals[0] === 2 && countVals[1] === 2)
    return { name: "Doble pareja", baseChips: 20, baseMult: 2 };
  if (countVals[0] === 2) return { name: "Pareja", baseChips: 10, baseMult: 2 };
  return { name: "Carta alta", baseChips: 5, baseMult: 1 };
}

const chipValueOfRank = (r: number): number => {
  if (r === 14) return 11;
  if (r >= 11) return 10;
  return r;
};

/* ---------------- Catálogo de modificadores ---------------- */
const RELIC_POOL: Relic[] = [
  { id: "pair_mult", name: "Eco Gemelo", desc: "Las Parejas otorgan +6 Mult.", rarity: "common", icon: "👯" },
  { id: "flush_chips", name: "Marea Cromática", desc: "El Color otorga +60 fichas.", rarity: "common", icon: "🌊" },
  { id: "straight_mult", name: "Senda Recta", desc: "Las Escaleras otorgan +5 Mult.", rarity: "common", icon: "🪜" },
  { id: "spades_chip", name: "Filo Negro", desc: "Cada ♠ jugada da +12 fichas.", rarity: "common", icon: "♠" },
  { id: "hearts_mult", name: "Pulso Carmesí", desc: "Cada ♥ jugada da +1 Mult.", rarity: "common", icon: "♥" },
  { id: "diamonds_money", name: "Veta Dorada", desc: "Cada ♦ jugada da +1$.", rarity: "common", icon: "♦" },
  { id: "clubs_chip", name: "Garrote Pesado", desc: "Cada ♣ jugada da +10 fichas.", rarity: "common", icon: "♣" },
  { id: "first_hand_mult", name: "Salida en Falso", desc: "La 1ª mano de cada ronda: x3 Mult.", rarity: "rare", icon: "🚀" },
  { id: "low_card_chip", name: "Plebe Útil", desc: "Cartas 2-6 jugadas dan +18 fichas.", rarity: "rare", icon: "🔢" },
  { id: "face_mult", name: "Corte Noble", desc: "Cada figura (J/Q/K) da +2 Mult.", rarity: "rare", icon: "👑" },
  { id: "discard_refund", name: "Reciclaje", desc: "Cada descarte sin usar al fin de ronda: +2$.", rarity: "rare", icon: "♻️" },
  { id: "no_discard_mult", name: "Mano Firme", desc: "Si no descartas en la ronda: x2 Mult en cada mano.", rarity: "rare", icon: "✊" },
  { id: "ace_chip", name: "As bajo la Manga", desc: "Cada As jugado da +25 fichas.", rarity: "rare", icon: "🅰️" },
  { id: "pair_chain", name: "Cadena Doble", desc: "Doble pareja otorga +4 Mult y +30 fichas.", rarity: "rare", icon: "⛓️" },
  { id: "scaling_round", name: "Bola de Nieve", desc: "+0.5 Mult permanente cada ronda superada.", rarity: "epic", icon: "❄️" },
  { id: "interest", name: "Banca Privada", desc: "Al fin de ronda ganas 1$ por cada 5$ que tengas (máx 6$).", rarity: "epic", icon: "🏦" },
  { id: "glass_master", name: "Maestro del Vidrio", desc: "Cartas de cristal: x4 en vez de x2 y nunca se rompen.", rarity: "epic", icon: "🔮" },
  { id: "small_hand", name: "Minimalista", desc: "Jugar 1-2 cartas: +50 fichas y +4 Mult.", rarity: "epic", icon: "🤏" },
  { id: "spectrum_boost", name: "Prisma Roto", desc: "Espectro otorga x3 Mult adicional.", rarity: "epic", icon: "🌈" },
  { id: "even_odd", name: "Equilibrio Par", desc: "Si todas las cartas jugadas son pares: x4 Mult.", rarity: "epic", icon: "⚖️" },
  { id: "blood_pact", name: "Pacto de Sangre", desc: "x2.5 Mult global, pero -1 mano por ronda.", rarity: "legendary", icon: "🩸" },
  { id: "overflow", name: "Desbordamiento", desc: "Si superas el objetivo x2, ganas +8$.", rarity: "legendary", icon: "💥" },
  { id: "the_collector", name: "El Coleccionista", desc: "+3 Mult por cada modificador que poseas.", rarity: "legendary", icon: "🗃️" },
  { id: "final_hand", name: "Última Palabra", desc: "Tu última mano de la ronda: x4 Mult.", rarity: "legendary", icon: "🎯" },
];

/* ---------------- Cartas especiales para tienda ---------------- */
type SpecialCardKind = "glass" | "steel" | "gold" | "bonus" | "suitconv";
interface ShopSpecial {
  kind: SpecialCardKind;
  name: string;
  desc: string;
  price: number;
  rarity: Rarity;
  icon: string;
}
const SPECIAL_DEFS: ShopSpecial[] = [
  { kind: "bonus", name: "Tinta Brillante", desc: "Da +30 fichas planas a una carta.", price: 4, rarity: "common", icon: "✨" },
  { kind: "glass", name: "Cristal Frágil", desc: "Carta x2 puntos, 25% de romperse al jugarla.", price: 5, rarity: "rare", icon: "🔮" },
  { kind: "steel", name: "Núcleo de Acero", desc: "Mientras esté en mano sin jugar: +1.5 Mult.", price: 6, rarity: "rare", icon: "⚙️" },
  { kind: "gold", name: "Lámina de Oro", desc: "Si está en mano al fin de ronda: +3$.", price: 5, rarity: "rare", icon: "🪙" },
  { kind: "suitconv", name: "Tintura de Palo", desc: "Convierte el palo de una carta al que elijas.", price: 4, rarity: "common", icon: "🎨" },
];

/* ---------------- Estado del juego ---------------- */
interface GameState {
  seed: number;
  round: number;
  ante: number;
  money: number;
  deck: Card[];
  drawPile: Card[];
  hand: Card[];
  discardPile: Card[];
  relics: Relic[];
  handsLeft: number;
  discardsLeft: number;
  handsPerRound: number;
  discardsPerRound: number;
  handSize: number;
  scoreThisRound: number;
  target: number;
  discardsUsedThisRound: number;
  permaMult: number;
  history: { hand: string; score: number; round: number }[];
  endless: boolean;
  stats: { handsPlayed: number; bestHand: number; totalScore: number };
}

/* ---------------- Lógica de puntuación ---------------- */
interface ScoreBreakdown {
  handName: string;
  chips: number;
  mult: number;
  total: number;
  lines: string[];
}

function scorePlay(
  played: Card[],
  heldInHand: Card[],
  gs: GameState,
  isFirstHand: boolean,
  isLastHand: boolean
): ScoreBreakdown {
  const hr = evaluateHand(played);
  const has = (id: string) => gs.relics.some((r) => r.id === id);
  let chips = hr.baseChips;
  let mult = hr.baseMult;
  const lines: string[] = [
    `${hr.name}: ${hr.baseChips} fichas × ${hr.baseMult}`,
  ];

  for (const c of played) {
    let v = chipValueOfRank(c.rank) + c.bonusChips;
    if (c.glass) v *= has("glass_master") ? 4 : 2;
    chips += v;
  }

  const spadeN = played.filter((c) => c.suit === "spades").length;
  const heartN = played.filter((c) => c.suit === "hearts").length;
  const clubN = played.filter((c) => c.suit === "clubs").length;

  if (has("spades_chip") && spadeN) {
    chips += spadeN * 12;
    lines.push(`Filo Negro: +${spadeN * 12} fichas`);
  }
  if (has("clubs_chip") && clubN) {
    chips += clubN * 10;
    lines.push(`Garrote Pesado: +${clubN * 10} fichas`);
  }
  if (has("hearts_mult") && heartN) {
    mult += heartN;
    lines.push(`Pulso Carmesí: +${heartN} Mult`);
  }

  if (has("pair_mult") && hr.name === "Pareja") {
    mult += 6;
    lines.push("Eco Gemelo: +6 Mult");
  }
  if (has("flush_chips") && hr.name === "Color") {
    chips += 60;
    lines.push("Marea Cromática: +60 fichas");
  }
  if (
    has("straight_mult") &&
    (hr.name === "Escalera" || hr.name === "Escalera de color")
  ) {
    mult += 5;
    lines.push("Senda Recta: +5 Mult");
  }
  if (has("pair_chain") && hr.name === "Doble pareja") {
    mult += 4;
    chips += 30;
    lines.push("Cadena Doble: +30 fichas, +4 Mult");
  }
  if (has("spectrum_boost") && hr.name === "Espectro") {
    mult *= 3;
    lines.push("Prisma Roto: ×3 Mult");
  }

  const lowN = played.filter((c) => c.rank >= 2 && c.rank <= 6).length;
  if (has("low_card_chip") && lowN) {
    chips += lowN * 18;
    lines.push(`Plebe Útil: +${lowN * 18} fichas`);
  }
  const faceN = played.filter((c) => c.rank >= 11 && c.rank <= 13).length;
  if (has("face_mult") && faceN) {
    mult += faceN * 2;
    lines.push(`Corte Noble: +${faceN * 2} Mult`);
  }
  const aceN = played.filter((c) => c.rank === 14).length;
  if (has("ace_chip") && aceN) {
    chips += aceN * 25;
    lines.push(`As bajo la Manga: +${aceN * 25} fichas`);
  }

  const steelN = heldInHand.filter((c) => c.steel).length;
  if (steelN) {
    mult += steelN * 1.5;
    lines.push(`Núcleo de Acero ×${steelN}: +${steelN * 1.5} Mult`);
  }

  if (has("small_hand") && played.length <= 2) {
    chips += 50;
    mult += 4;
    lines.push("Minimalista: +50 fichas, +4 Mult");
  }
  if (has("even_odd") && played.every((c) => c.rank % 2 === 0)) {
    mult *= 4;
    lines.push("Equilibrio Par: ×4 Mult");
  }
  if (has("first_hand_mult") && isFirstHand) {
    mult *= 3;
    lines.push("Salida en Falso: ×3 Mult");
  }
  if (has("final_hand") && isLastHand) {
    mult *= 4;
    lines.push("Última Palabra: ×4 Mult");
  }
  if (has("no_discard_mult") && gs.discardsUsedThisRound === 0) {
    mult *= 2;
    lines.push("Mano Firme: ×2 Mult");
  }

  if (has("the_collector")) {
    mult += gs.relics.length * 3;
    lines.push(`El Coleccionista: +${gs.relics.length * 3} Mult`);
  }
  if (has("blood_pact")) {
    mult *= 2.5;
    lines.push("Pacto de Sangre: ×2.5 Mult");
  }
  if (gs.permaMult > 0) {
    mult += gs.permaMult;
    lines.push(`Bola de Nieve: +${gs.permaMult.toFixed(1)} Mult`);
  }

  mult = Math.max(0, mult);
  const total = Math.round(chips * mult);
  return {
    handName: hr.name,
    chips: Math.round(chips),
    mult: Math.round(mult * 10) / 10,
    total,
    lines,
  };
}

const targetForRound = (round: number): number =>
  Math.round(200 * Math.pow(1.55, round - 1));

/* ============================================================
   COMPONENTES UI
   ============================================================ */

/* ---------------- Carta de juego con sprites currados ---------------- */
function PlayingCard({
  card,
  selected,
  onClick,
  disabled,
  small,
  scoring,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  scoring?: boolean;
}) {
  const w = small ? 56 : 76;
  const h = small ? 80 : 108;
  const isFace = card.rank >= 11 && card.rank <= 13;
  const isAce = card.rank === 14;
  const suitPal = SUIT_PALETTE[card.suit];
  const cornerHex =
    card.suit === "hearts"
      ? "#e11d48"
      : card.suit === "diamonds"
      ? "#d97706"
      : "#1e293b";

  const bodyBg = card.glass
    ? "linear-gradient(135deg, #cffafe 0%, #a5f3fc 45%, #e0f2fe 100%)"
    : card.steel
    ? "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 50%, #cbd5e1 100%)"
    : card.gold
    ? "linear-gradient(135deg, #fef3c7 0%, #fcd34d 50%, #fffbeb 100%)"
    : "linear-gradient(160deg, #fafafa 0%, #f1f5f9 60%, #e2e8f0 100%)";

  const cornerPx = small ? 1 : 1.4;
  const centerPx = small ? 2 : 3;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: w,
        height: h,
        background: bodyBg,
        border: `3px solid ${selected ? "#fcd34d" : "#0b0f1a"}`,
        boxShadow: selected
          ? "0 0 0 2px #0b0f1a, 0 7px 0 0 #92400e, 0 0 20px -2px rgba(252,211,77,0.85)"
          : "0 4px 0 0 #1e293b, 0 5px 6px -2px rgba(0,0,0,0.5)",
      }}
      className={[
        "relative shrink-0 overflow-hidden transition-all duration-150",
        selected ? "-translate-y-4 z-20" : "hover:-translate-y-2 hover:z-10 z-0",
        scoring ? "animate-[rcscorepop_0.5s_ease-out] z-30" : "",
        disabled ? "opacity-60 cursor-default" : "cursor-pointer",
      ].join(" ")}
    >
      {/* marca de seleccionada */}
      {selected && (
        <div className="absolute -top-3 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-sm border-2 border-slate-950 bg-amber-300 px-1.5 text-[9px] font-black uppercase tracking-wide text-slate-950">
          elegida
        </div>
      )}

      {/* textura sutil */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #00000022 0 1px, transparent 1px 3px)",
        }}
      />
      {/* marco interior decorativo */}
      <div
        className="absolute inset-1 border"
        style={{ borderColor: cornerHex + "55" }}
      />

      {/* esquina superior izquierda */}
      <div className="absolute top-0.5 left-1 z-10 flex flex-col items-center leading-none">
        <span
          className={`font-black ${small ? "text-[11px]" : "text-sm"}`}
          style={{ fontFamily: "ui-monospace, monospace", color: cornerHex }}
        >
          {rankLabel(card.rank)}
        </span>
        <div className="mt-0.5">
          <PixSprite
            grid={SUIT_SPRITE[card.suit]}
            px={cornerPx}
            palette={suitPal}
          />
        </div>
      </div>

      {/* esquina inferior derecha (rotada) */}
      <div className="absolute bottom-0.5 right-1 z-10 flex rotate-180 flex-col items-center leading-none">
        <span
          className={`font-black ${small ? "text-[11px]" : "text-sm"}`}
          style={{ fontFamily: "ui-monospace, monospace", color: cornerHex }}
        >
          {rankLabel(card.rank)}
        </span>
        <div className="mt-0.5">
          <PixSprite
            grid={SUIT_SPRITE[card.suit]}
            px={cornerPx}
            palette={suitPal}
          />
        </div>
      </div>

      {/* contenido central */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={scoring ? "animate-[rcspin_0.5s_ease-out]" : ""}>
          {isFace ? (
            <div className="relative flex items-center justify-center">
              <div
                className="absolute -inset-1 rounded-sm border"
                style={{ borderColor: cornerHex + "66" }}
              />
              <PixSprite
                grid={FACE_16x20}
                px={small ? 1.7 : 2.3}
                palette={facePalette(card.suit)}
              />
            </div>
          ) : isAce ? (
            <div className="relative flex items-center justify-center">
              <div
                className="absolute h-[2px] w-10 rotate-45"
                style={{ background: cornerHex + "44" }}
              />
              <div
                className="absolute h-[2px] w-10 -rotate-45"
                style={{ background: cornerHex + "44" }}
              />
              <PixSprite
                grid={SUIT_SPRITE[card.suit]}
                px={small ? 2.6 : 3.6}
                palette={suitPal}
              />
            </div>
          ) : (
            <PixSprite
              grid={SUIT_SPRITE[card.suit]}
              px={centerPx}
              palette={suitPal}
            />
          )}
        </div>
      </div>

      {/* badge de material especial */}
      {(card.glass || card.steel || card.gold) && (
        <div className="absolute bottom-0.5 left-1 z-10 text-[9px] font-black uppercase tracking-tight">
          {card.glass && <span className="text-cyan-700">vidrio</span>}
          {card.steel && <span className="text-slate-700">acero</span>}
          {card.gold && <span className="text-amber-700">oro</span>}
        </div>
      )}

      {/* brillo diagonal */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-50" />

      {/* etiqueta de bonus de fichas */}
      {card.bonusChips > 0 && (
        <div className="absolute -top-2 -right-2 z-30 border-2 border-slate-950 bg-sky-500 px-1 text-[10px] font-black leading-tight text-slate-950 shadow-[2px_2px_0_0_#000]">
          +{card.bonusChips}
        </div>
      )}
    </button>
  );
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-52 -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-200 shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

function RelicChip({ relic }: { relic: Relic }) {
  return (
    <Tooltip text={relic.desc}>
      <div
        className={`flex items-center gap-1.5 rounded-lg border bg-[#12101c]/90 py-1 pl-1 pr-2 ring-1 ${RARITY_RING[relic.rarity]} ${RARITY_GLOW[relic.rarity]}`}
      >
        <RelicBadge id={relic.id} size={22} ringClass={RARITY_ACCENT[relic.rarity]} />
        <span className={`text-xs font-semibold ${RARITY_TEXT[relic.rarity]}`}>
          {relic.name}
        </span>
      </div>
    </Tooltip>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rc-stat">
      <div className="rc-stat__label">{label}</div>
      <div className={`rc-stat__value text-lg ${accent ?? "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

/* ---------------- Pantalla: Menú ---------------- */
function MenuScreen({
  onStart,
  lastSeed,
}: {
  onStart: (seed: number, endless: boolean) => void;
  lastSeed: number | null;
}) {
  const [seedInput, setSeedInput] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-7 px-4 text-center">
      <div className="space-y-3">
        <p className="rc-eyebrow">Roguelike de cartas</p>
        <h1 className="rc-title text-6xl sm:text-7xl">ROYALE CLIMB</h1>
        <p className="text-sm text-slate-400">
          Construye combos · escala el ante · sin límite
        </p>
        <div className="mx-auto flex w-fit gap-2 pt-3">
          {SUITS.map((s, i) => (
            <div
              key={s}
              className="rc-panel rc-panel__corners p-1.5"
              style={{
                animation: `rcsway ${2.6 + i * 0.3}s ease-in-out infinite`,
              }}
            >
              <PixelSuit suit={s} px={2.2} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          onClick={() => onStart((Math.random() * 1e9) | 0, false)}
          className="rc-btn rc-btn-primary px-6 py-4 text-lg"
        >
          ▶  Nueva partida
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="rc-btn rc-btn-ghost px-6 py-3"
        >
          ?  Cómo se juega
        </button>
        <button
          onClick={() => onStart((Math.random() * 1e9) | 0, true)}
          className="rc-btn rc-btn-ghost--magenta px-6 py-3"
        >
          ∞  Modo Endless
        </button>

        <div className="mt-2 flex gap-2">
          <input
            value={seedInput}
            onChange={(e) =>
              setSeedInput(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="Semilla (opcional)"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
          />
          <button
            onClick={() =>
              onStart(
                seedInput ? parseInt(seedInput, 10) : (Math.random() * 1e9) | 0,
                false
              )
            }
            className="rc-btn rc-btn-flat px-4 py-2 text-sm"
          >
            Jugar
          </button>
        </div>
        {lastSeed !== null && (
          <p className="text-xs text-slate-500">Última semilla: {lastSeed}</p>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

/* ---------------- Modal de ayuda ---------------- */
function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,7,20,0.92)] p-4 backdrop-blur-sm">
      <div className="rc-panel rc-panel__corners max-h-[88vh] w-full max-w-xl overflow-auto p-6 text-left">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="rc-title text-2xl">Cómo se juega</h3>
          <button
            onClick={onClose}
            className="rc-btn rc-btn-flat px-3 py-1 text-sm"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <p className="mb-1 font-bold text-sky-300">El objetivo</p>
            <p>
              Cada ronda tienes un objetivo de puntos. Lo alcanzas jugando
              manos de cartas que forman combinaciones. Si te quedas sin manos
              antes de llegar al objetivo, pierdes.
            </p>
          </div>

          <div>
            <p className="mb-1 font-bold text-sky-300">Tu turno</p>
            <p>
              Tienes 8 cartas en mano. <b>Toca cartas para seleccionarlas</b>{" "}
              (se levantan y se ponen con borde dorado). Puedes elegir entre 1
              y 5 cartas. Luego:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <b className="text-emerald-300">Jugar mano</b> — puntúas las
                cartas seleccionadas. Tienes 4 por ronda.
              </li>
              <li>
                <b className="text-rose-300">Descartar</b> — tiras las
                seleccionadas y robas nuevas, sin puntuar. Tienes 3 por ronda.
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-1 font-bold text-sky-300">La puntuación</p>
            <p>
              Cada jugada da <b className="text-sky-300">fichas</b> ×{" "}
              <b className="text-rose-300">multiplicador</b>. La combinación
              que formes marca los valores base; cada carta suma fichas según
              su número. Mejores combos = más de ambos.
            </p>
          </div>

          <div>
            <p className="mb-1 font-bold text-sky-300">Combinaciones</p>
            <p className="text-xs leading-relaxed">
              Pareja · Doble pareja · Trío · Escalera (5 seguidas) · Color (5
              del mismo palo) · Full · Póker (4 iguales) · Escalera de color ·
              y la especial: <b className="text-fuchsia-300">Espectro</b> — 5
              cartas todas rojas o todas negras (sin ser color).
            </p>
          </div>

          <div>
            <p className="mb-1 font-bold text-sky-300">Entre rondas</p>
            <p>
              Al superar una ronda eliges un <b>modificador</b> que cambia tu
              forma de puntuar para el resto de la partida. Cada 3 rondas se
              abre la <b className="text-amber-300">tienda</b>: compra
              modificadores, mejora cartas concretas o vende cartas para
              afinar tu baraja.
            </p>
          </div>

          <div>
            <p className="mb-1 font-bold text-sky-300">La estrategia</p>
            <p>
              No se trata de jugar la carta más alta. Descarta para buscar
              sinergias, deja cartas clave en mano (acero y oro funcionan sin
              jugarse), y construye una baraja en torno a los modificadores que
              te van saliendo.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rc-btn rc-btn-primary mt-5 w-full py-3"
        >
          ¡Entendido!
        </button>
      </div>
    </div>
  );
}

/* ---------------- Pantalla: Partida ---------------- */
function PlayScreen({
  gs,
  setGs,
  onWinRound,
  onDefeat,
  spawnParticles,
}: {
  gs: GameState;
  setGs: (g: GameState) => void;
  onWinRound: (g: GameState) => void;
  onDefeat: (g: GameState) => void;
  spawnParticles: (x: number, y: number, n: number, big: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [lastScore, setLastScore] = useState<ScoreBreakdown | null>(null);
  const [floatScore, setFloatScore] = useState<number | null>(null);
  const [bigScore, setBigScore] = useState<number | null>(null);
  const [shake, setShake] = useState<"" | "small" | "big">("");
  const [scoringIds, setScoringIds] = useState<string[]>([]);
  const handRef = useRef<HTMLDivElement>(null);
  const rng = useRef(makeRng(gs.seed + gs.round * 7919));

  const preview = useMemo(() => {
    const cards = gs.hand.filter((c) => selected.includes(c.id));
    return evaluateHand(cards);
  }, [selected, gs.hand]);

  const toggle = (id: string) => {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 5) return s;
      return [...s, id];
    });
  };

  const sortHand = (mode: "rank" | "suit") => {
    const h = [...gs.hand];
    if (mode === "rank")
      h.sort((a, b) => b.rank - a.rank || a.suit.localeCompare(b.suit));
    else h.sort((a, b) => a.suit.localeCompare(b.suit) || b.rank - a.rank);
    setGs({ ...gs, hand: h });
  };

  const drawTo = (g: GameState): GameState => {
    let draw = [...g.drawPile];
    let disc = [...g.discardPile];
    const hand = [...g.hand];
    while (hand.length < g.handSize) {
      if (draw.length === 0) {
        if (disc.length === 0) break;
        draw = shuffle(rng.current, disc);
        disc = [];
      }
      hand.push(draw.shift()!);
    }
    return { ...g, drawPile: draw, discardPile: disc, hand };
  };

  const isFirstHand = gs.handsLeft === gs.handsPerRound;
  const isLastHand = gs.handsLeft === 1;

  const playHand = () => {
    if (selected.length === 0 || gs.handsLeft <= 0) return;
    const played = gs.hand.filter((c) => selected.includes(c.id));
    const held = gs.hand.filter((c) => !selected.includes(c.id));
    const bd = scorePlay(played, held, gs, isFirstHand, isLastHand);

    const diamN = played.filter((c) => c.suit === "diamonds").length;
    const hasDiamMoney = gs.relics.some((r) => r.id === "diamonds_money");
    const moneyGain = hasDiamMoney ? diamN : 0;

    const glassMaster = gs.relics.some((r) => r.id === "glass_master");
    const brokenIds = new Set<string>();
    if (!glassMaster) {
      for (const c of played) {
        if (c.glass && rng.current() < 0.25) brokenIds.add(c.id);
      }
    }

    const newDeck = gs.deck.filter((c) => !brokenIds.has(c.id));
    const newDiscard = [
      ...gs.discardPile,
      ...played.filter((c) => !brokenIds.has(c.id)),
    ];

    let g: GameState = {
      ...gs,
      deck: newDeck,
      hand: held,
      discardPile: newDiscard,
      handsLeft: gs.handsLeft - 1,
      scoreThisRound: gs.scoreThisRound + bd.total,
      money: gs.money + moneyGain,
      history: [
        { hand: bd.handName, score: bd.total, round: gs.round },
        ...gs.history,
      ].slice(0, 40),
      stats: {
        handsPlayed: gs.stats.handsPlayed + 1,
        bestHand: Math.max(gs.stats.bestHand, bd.total),
        totalScore: gs.stats.totalScore + bd.total,
      },
    };

    setLastScore(bd);
    setFloatScore(bd.total);
    setTimeout(() => setFloatScore(null), 1100);

    const playedIds = played
      .filter((c) => !brokenIds.has(c.id))
      .map((c) => c.id);
    playedIds.forEach((id, i) => {
      setTimeout(() => setScoringIds((s) => [...s, id]), i * 110);
      setTimeout(
        () => setScoringIds((s) => s.filter((x) => x !== id)),
        i * 110 + 500
      );
    });

    const big = bd.total >= gs.target * 0.55 || bd.total >= 1200;
    setShake(big ? "big" : "small");
    setTimeout(() => setShake(""), big ? 480 : 320);

    const rect = handRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setTimeout(
        () => spawnParticles(cx, cy, big ? 14 : 8, big),
        playedIds.length * 110
      );
    }
    if (big) {
      setTimeout(() => {
        setBigScore(bd.total);
        setTimeout(() => setBigScore(null), 1300);
      }, playedIds.length * 110);
    }
    setSelected([]);

    if (g.scoreThisRound >= g.target) {
      let endMoney = g.money;
      const has = (id: string) => g.relics.some((r) => r.id === id);
      let cashOut = 3 + g.handsLeft;
      if (has("discard_refund")) cashOut += g.discardsLeft * 2;
      if (has("interest")) cashOut += Math.min(6, Math.floor(endMoney / 5));
      const goldHeld = g.hand.filter((c) => c.gold).length;
      cashOut += goldHeld * 3;
      if (has("overflow") && g.scoreThisRound >= g.target * 2) cashOut += 8;
      g = { ...g, money: endMoney + cashOut };
      if (has("scaling_round")) g = { ...g, permaMult: g.permaMult + 0.5 };
      setGs(g);
      setTimeout(() => onWinRound(g), 700);
      return;
    }

    if (g.handsLeft <= 0) {
      setGs(g);
      setTimeout(() => onDefeat(g), 700);
      return;
    }

    g = drawTo(g);
    setGs(g);
  };

  const discard = () => {
    if (selected.length === 0 || gs.discardsLeft <= 0) return;
    const discarded = gs.hand.filter((c) => selected.includes(c.id));
    const held = gs.hand.filter((c) => !selected.includes(c.id));
    let g: GameState = {
      ...gs,
      hand: held,
      discardPile: [...gs.discardPile, ...discarded],
      discardsLeft: gs.discardsLeft - 1,
      discardsUsedThisRound: gs.discardsUsedThisRound + 1,
    };
    g = drawTo(g);
    setSelected([]);
    setGs(g);
  };

  const progress = Math.min(100, (gs.scoreThisRound / gs.target) * 100);

  return (
    <div className="mx-auto max-w-4xl px-3 pb-6">
      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatBox label="Ronda" value={`${gs.round}`} accent="text-amber-300" />
        <StatBox label="Ante" value={`${gs.ante}`} accent="text-fuchsia-300" />
        <StatBox
          label="Dinero"
          value={`$${gs.money}`}
          accent="text-emerald-300"
        />
        <StatBox
          label="Manos"
          value={`${gs.handsLeft}`}
          accent="text-sky-300"
        />
        <StatBox
          label="Descartes"
          value={`${gs.discardsLeft}`}
          accent="text-rose-300"
        />
        <StatBox
          label="Mazo"
          value={`${gs.drawPile.length}/${gs.deck.length}`}
        />
      </div>

      <div className="rc-panel mb-3 p-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="rc-eyebrow" style={{ fontSize: "0.62rem" }}>
            Objetivo de ronda
          </span>
          <span className="font-mono text-sm">
            <span
              className={
                gs.scoreThisRound >= gs.target
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            >
              {gs.scoreThisRound.toLocaleString()}
            </span>
            <span className="text-slate-500">
              {" "}
              / {gs.target.toLocaleString()}
            </span>
          </span>
        </div>
        <div className="rc-bar">
          <div className="rc-bar__fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {gs.relics.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {gs.relics.map((r) => (
            <RelicChip key={r.id} relic={r} />
          ))}
        </div>
      )}

      <div
        className={`rc-panel rc-panel__corners relative mb-3 flex min-h-[5rem] items-center justify-between overflow-hidden p-4 ${
          shake === "big"
            ? "animate-[rcshakebig_0.48s]"
            : shake === "small"
            ? "animate-[rcshake_0.32s]"
            : ""
        }`}
      >
        <div className="relative z-10">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {selected.length > 0
              ? "Combinación detectada"
              : "Toca cartas para elegirlas"}
          </div>
          <div className="text-2xl font-black text-slate-100">
            {selected.length > 0 ? preview.name : "—"}
          </div>
          {selected.length > 0 && (
            <div className="font-mono text-sm">
              <span className="text-sky-300">{preview.baseChips} fichas</span>
              <span className="text-slate-500"> × </span>
              <span className="text-rose-300">{preview.baseMult} mult</span>
            </div>
          )}
        </div>
        <div className="relative z-10 text-right">
          {lastScore && (
            <>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Última jugada
              </div>
              <div className="text-3xl font-black text-amber-300">
                +{lastScore.total.toLocaleString()}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {lastScore.chips} × {lastScore.mult}
              </div>
            </>
          )}
          {floatScore !== null && (
            <div className="pointer-events-none absolute -top-6 right-0 animate-[rcfloat_1.1s_ease-out] text-2xl font-black text-emerald-300">
              +{floatScore.toLocaleString()}
            </div>
          )}
        </div>
        {bigScore !== null && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 animate-[rcbigscore_1.3s_ease-out] text-center">
            <div className="text-5xl font-black text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.9)] sm:text-6xl">
              +{bigScore.toLocaleString()}
            </div>
            <div className="text-sm font-black uppercase tracking-widest text-fuchsia-300">
              ¡Combazo!
            </div>
          </div>
        )}
      </div>

      {lastScore && lastScore.lines.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
          {lastScore.lines.map((l, i) => (
            <span
              key={i}
              className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-slate-300"
            >
              {l}
            </span>
          ))}
        </div>
      )}

      {/* mano */}
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Tu mano · {gs.hand.length} cartas
        </span>
        <span className="text-[11px] text-slate-500">
          Toca para elegir (máx 5) · {selected.length}/5
        </span>
      </div>
      <div className="mb-3 flex items-stretch gap-2">
        {/* mazo (montón de reversos) */}
        <div className="rc-well hidden shrink-0 flex-col items-center justify-center gap-1 px-2 py-3 sm:flex">
          <div className="relative" style={{ width: 44, height: 64 }}>
            {gs.drawPile.length > 2 && (
              <div className="absolute left-1.5 top-1.5">
                <CardBack w={40} h={58} />
              </div>
            )}
            {gs.drawPile.length > 1 && (
              <div className="absolute left-0.5 top-0.5">
                <CardBack w={40} h={58} />
              </div>
            )}
            {gs.drawPile.length > 0 ? (
              <CardBack w={40} h={58} />
            ) : (
              <div className="flex h-[58px] w-10 items-center justify-center rounded border-2 border-dashed border-slate-700 text-slate-700">
                ∅
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            Mazo {gs.drawPile.length}
          </span>
        </div>

        {/* cartas en mano */}
        <div
          ref={handRef}
          className="rc-well flex min-h-[7.5rem] flex-1 items-center gap-1.5 overflow-x-auto px-3 py-5 sm:justify-center sm:gap-2"
        >
          {gs.hand.map((c) => (
            <PlayingCard
              key={c.id}
              card={c}
              selected={selected.includes(c.id)}
              scoring={scoringIds.includes(c.id)}
              onClick={() => toggle(c.id)}
            />
          ))}
          {gs.hand.length === 0 && (
            <span className="mx-auto text-sm text-slate-600">
              Sin cartas en mano
            </span>
          )}
        </div>

        {/* pila de descarte */}
        <div className="rc-well hidden shrink-0 flex-col items-center justify-center gap-1 px-2 py-3 sm:flex">
          <div
            className="flex items-center justify-center rounded border-2 border-dashed border-slate-700"
            style={{ width: 40, height: 58 }}
          >
            <span className="text-lg text-slate-600">↓</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            Pozo {gs.discardPile.length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={playHand}
          disabled={selected.length === 0 || gs.handsLeft <= 0}
          className="rc-btn rc-btn-primary px-6 py-3"
        >
          ▶ Jugar mano ({selected.length})
        </button>
        <button
          onClick={discard}
          disabled={selected.length === 0 || gs.discardsLeft <= 0}
          className="rc-btn rc-btn-ghost--magenta px-5 py-3"
        >
          ✕ Descartar ({gs.discardsLeft})
        </button>
        <button
          onClick={() => setSelected([])}
          className="rc-btn rc-btn-flat px-4 py-3 text-sm"
        >
          Limpiar
        </button>
        <div className="mx-1 h-8 w-px bg-white/10" />
        <button
          onClick={() => sortHand("rank")}
          className="rc-btn rc-btn-flat px-3 py-3 text-sm"
        >
          Ordenar: valor
        </button>
        <button
          onClick={() => sortHand("suit")}
          className="rc-btn rc-btn-flat px-3 py-3 text-sm"
        >
          Ordenar: palo
        </button>
      </div>

      {gs.history.length > 0 && (
        <div className="rc-panel mt-4 p-3">
          <div className="rc-eyebrow mb-1.5" style={{ fontSize: "0.6rem" }}>
            Historial de jugadas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {gs.history.slice(0, 12).map((h, i) => (
              <span
                key={i}
                className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-300"
              >
                R{h.round} · {h.hand}{" "}
                <span className="font-mono text-amber-300">
                  +{h.score.toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Pantalla: Recompensa ---------------- */
function RewardScreen({
  gs,
  rng,
  onChoose,
  onSkip,
}: {
  gs: GameState;
  rng: Rng;
  onChoose: (relic: Relic) => void;
  onSkip: () => void;
}) {
  const offers = useMemo(() => {
    const owned = new Set(gs.relics.map((r) => r.id));
    const avail = RELIC_POOL.filter((r) => !owned.has(r.id));
    return shuffle(rng, avail).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-center">
      <p className="rc-eyebrow mb-2">Ronda {gs.round} superada</p>
      <h2 className="rc-title mb-1 text-3xl">ELIGE TU MODIFICADOR</h2>
      <p className="mb-6 text-sm text-slate-400">
        Cada elección define tu estrategia para el resto de la partida.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {offers.map((r) => (
          <button
            key={r.id}
            onClick={() => onChoose(r)}
            className={`rc-panel rc-panel__corners group relative flex flex-col items-center gap-2 overflow-hidden p-5 ring-1 transition-transform hover:scale-[1.04] active:scale-95 ${RARITY_RING[r.rarity]} ${RARITY_GLOW[r.rarity]}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 opacity-[0.14] ${RARITY_TEXT[r.rarity]}`}
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, currentColor, transparent 65%)",
              }}
            />
            <div className="relative transition-transform group-hover:scale-110">
              <RelicBadge id={r.id} size={56} ringClass={RARITY_ACCENT[r.rarity]} />
            </div>
            <span
              className={`relative text-xs font-black uppercase tracking-wider ${RARITY_TEXT[r.rarity]}`}
            >
              {r.rarity}
            </span>
            <span className="relative text-lg font-bold text-slate-100">{r.name}</span>
            <span className="text-xs text-slate-400">{r.desc}</span>
          </button>
        ))}
        {offers.length === 0 && (
          <p className="col-span-3 text-slate-500">
            Tienes todos los modificadores disponibles. ¡Impresionante!
          </p>
        )}
      </div>
      <button
        onClick={onSkip}
        className="rc-btn rc-btn-flat mt-6 px-5 py-2 text-sm"
      >
        Saltar (+4$)
      </button>
    </div>
  );
}

/* ---------------- Pantalla: Tienda ---------------- */
function ShopScreen({
  gs,
  rng,
  onBuyRelic,
  onApplySpecial,
  onSellCard,
  onContinue,
}: {
  gs: GameState;
  rng: Rng;
  onBuyRelic: (r: Relic, price: number) => void;
  onApplySpecial: (sp: ShopSpecial, cardId: string, suit?: Suit) => void;
  onSellCard: (cardId: string) => void;
  onContinue: () => void;
}) {
  const [pendingSpecial, setPendingSpecial] = useState<ShopSpecial | null>(
    null
  );
  const [convSuit, setConvSuit] = useState<Suit>("spades");
  const [showSell, setShowSell] = useState(false);
  const [boughtRelics, setBoughtRelics] = useState<string[]>([]);
  const [usedSpecials, setUsedSpecials] = useState<number[]>([]);

  const stock = useMemo(() => {
    const owned = new Set(gs.relics.map((r) => r.id));
    const relics = shuffle(
      rng,
      RELIC_POOL.filter((r) => !owned.has(r.id))
    ).slice(0, 2);
    const priceOf = (rar: Rarity) =>
      rar === "legendary"
        ? 14
        : rar === "epic"
        ? 10
        : rar === "rare"
        ? 7
        : 5;
    const specials = shuffle(rng, SPECIAL_DEFS).slice(0, 3);
    return {
      relics: relics.map((r) => ({ relic: r, price: priceOf(r.rarity) })),
      specials,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-7 flex items-baseline justify-between">
        <div>
          <p className="rc-eyebrow mb-1">Ronda {gs.round} · parada</p>
          <h2 className="rc-title text-3xl sm:text-4xl">TIENDA</h2>
        </div>
        <span className="rc-btn rc-btn-gold rc-panel__corners px-4 py-2 text-lg">
          ${gs.money}
        </span>
      </div>

      <h3 className="rc-eyebrow mb-2">Modificadores</h3>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {stock.relics.map(({ relic, price }) => {
          const bought = boughtRelics.includes(relic.id);
          const afford = gs.money >= price;
          return (
            <div
              key={relic.id}
              className={`rc-panel rc-panel__corners relative flex items-center gap-3 overflow-hidden p-4 ring-1 ${RARITY_RING[relic.rarity]} ${RARITY_GLOW[relic.rarity]} ${
                bought ? "opacity-40" : ""
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-0 opacity-[0.12] ${RARITY_TEXT[relic.rarity]}`}
                style={{
                  background:
                    "radial-gradient(circle at 0% 0%, currentColor, transparent 60%)",
                }}
              />
              <RelicBadge id={relic.id} size={44} ringClass={RARITY_ACCENT[relic.rarity]} />
              <div className="relative min-w-0 flex-1">
                <div
                  className={`text-sm font-bold ${RARITY_TEXT[relic.rarity]}`}
                >
                  {relic.name}
                </div>
                <div className="text-xs text-slate-400">{relic.desc}</div>
              </div>
              <button
                disabled={bought || !afford}
                onClick={() => {
                  onBuyRelic(relic, price);
                  setBoughtRelics((b) => [...b, relic.id]);
                }}
                className="rc-btn rc-btn-primary relative shrink-0 px-3 py-2 text-sm"
              >
                {bought ? "✓" : `${price}`}
              </button>
            </div>
          );
        })}
        {stock.relics.length === 0 && (
          <p className="text-sm text-slate-500">
            Sin modificadores nuevos en stock.
          </p>
        )}
      </div>

      <h3 className="rc-eyebrow mb-2">Mejoras de carta</h3>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {stock.specials.map((sp, i) => {
          const used = usedSpecials.includes(i);
          const afford = gs.money >= sp.price;
          return (
            <div
              key={i}
              className={`rc-panel rc-panel--magenta rc-panel__corners relative flex flex-col items-center gap-2 overflow-hidden p-4 text-center ${
                used ? "opacity-40" : ""
              }`}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.12] text-fuchsia-300"
                style={{
                  background:
                    "radial-gradient(circle at 50% 0%, currentColor, transparent 65%)",
                }}
              />
              <RelicBadge id={sp.kind} size={40} ringClass={RARITY_ACCENT[sp.rarity]} />
              <span
                className={`relative text-sm font-bold ${RARITY_TEXT[sp.rarity]}`}
              >
                {sp.name}
              </span>
              <p className="relative flex-1 text-xs text-slate-400">{sp.desc}</p>
              <button
                disabled={used || !afford}
                onClick={() => setPendingSpecial(sp)}
                className="rc-btn rc-btn-ghost--magenta relative w-full px-3 py-2 text-sm"
              >
                {used ? "Usado" : `$${sp.price}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mb-8">
        <button
          onClick={() => setShowSell((s) => !s)}
          className="rc-btn rc-btn-ghost--magenta mb-2 px-4 py-2 text-sm"
        >
          {showSell
            ? "▲ Ocultar baraja"
            : "▼ Vender cartas (+2$ c/u)"}
        </button>
        {showSell && (
          <div className="rc-panel flex flex-wrap gap-2 p-3">
            {gs.deck.length <= 20 ? (
              <p className="text-xs text-rose-300">
                No puedes bajar de 20 cartas en la baraja.
              </p>
            ) : (
              gs.deck
                .slice()
                .sort(
                  (a, b) =>
                    a.suit.localeCompare(b.suit) || a.rank - b.rank
                )
                .map((c) => (
                  <div key={c.id} className="flex flex-col items-center gap-1">
                    <PlayingCard
                      card={c}
                      small
                      onClick={() => onSellCard(c.id)}
                    />
                    <span className="text-[10px] text-emerald-300">
                      vender +2$
                    </span>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      <button
        onClick={onContinue}
        className="rc-btn rc-btn-primary w-full py-4 text-lg"
      >
        Continuar a la siguiente ronda →
      </button>

      {pendingSpecial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,7,20,0.92)] p-4 backdrop-blur-sm">
          <div className="rc-panel rc-panel__corners max-h-[85vh] w-full max-w-2xl overflow-auto p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <RelicBadge
                id={pendingSpecial.kind}
                size={34}
                ringClass={RARITY_ACCENT[pendingSpecial.rarity]}
              />
              <h4 className="rc-title flex-1 text-lg">
                {pendingSpecial.name}
              </h4>
              <button
                onClick={() => setPendingSpecial(null)}
                className="rc-btn rc-btn-flat px-3 py-1 text-sm"
              >
                Cancelar
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-400">
              {pendingSpecial.desc} — elige la carta:
            </p>
            {pendingSpecial.kind === "suitconv" && (
              <div className="mb-3 flex gap-2">
                {SUITS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setConvSuit(s)}
                    className={`rc-btn px-3 py-2 text-lg ${
                      convSuit === s
                        ? "rc-btn-ghost--magenta"
                        : "rc-btn-flat"
                    } ${SUIT_COLOR[s]}`}
                  >
                    {SUIT_GLYPH[s]}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {gs.deck
                .slice()
                .sort(
                  (a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank
                )
                .map((c) => (
                  <PlayingCard
                    key={c.id}
                    card={c}
                    small
                    onClick={() => {
                      onApplySpecial(
                        pendingSpecial,
                        c.id,
                        pendingSpecial.kind === "suitconv"
                          ? convSuit
                          : undefined
                      );
                      setUsedSpecials((u) => [
                        ...u,
                        stock.specials.indexOf(pendingSpecial),
                      ]);
                      setPendingSpecial(null);
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Pantalla: Derrota ---------------- */
function DefeatScreen({
  gs,
  onMenu,
  onRetry,
}: {
  gs: GameState;
  onMenu: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
      <h2
        className="rc-title text-5xl"
        style={{
          textShadow:
            "0 0 6px rgba(255,46,161,0.9), 0 0 22px rgba(255,46,161,0.5)",
        }}
      >
        DERROTA
      </h2>
      <p className="text-slate-400">
        Caíste en la ronda {gs.round}. Te faltaron{" "}
        <span className="text-rose-300">
          {(gs.target - gs.scoreThisRound).toLocaleString()}
        </span>{" "}
        puntos.
      </p>
      <div className="grid w-full grid-cols-2 gap-2">
        <StatBox
          label="Ronda alcanzada"
          value={`${gs.round}`}
          accent="text-amber-300"
        />
        <StatBox label="Ante" value={`${gs.ante}`} accent="text-fuchsia-300" />
        <StatBox
          label="Mejor jugada"
          value={gs.stats.bestHand.toLocaleString()}
          accent="text-emerald-300"
        />
        <StatBox
          label="Puntos totales"
          value={gs.stats.totalScore.toLocaleString()}
          accent="text-sky-300"
        />
        <StatBox label="Manos jugadas" value={`${gs.stats.handsPlayed}`} />
        <StatBox label="Modificadores" value={`${gs.relics.length}`} />
      </div>
      <p className="text-xs text-slate-500">Semilla: {gs.seed}</p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="rc-btn rc-btn-primary px-6 py-3"
        >
          ↻ Misma semilla
        </button>
        <button
          onClick={onMenu}
          className="rc-btn rc-btn-flat px-6 py-3"
        >
          Menú principal
        </button>
      </div>
    </div>
  );
}

/* ---------------- Pantalla: Hito / récord ---------------- */
function WinScreen({
  gs,
  onContinueEndless,
  onMenu,
}: {
  gs: GameState;
  onContinueEndless: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffe94d"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-16 w-16 animate-[rcpulse_2s_infinite]"
        style={{ filter: "drop-shadow(0 0 10px rgba(255,233,77,0.8))" }}
      >
        <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
        <path d="M7 5H4a3 3 0 0 0 3 5" />
        <path d="M17 5h3a3 3 0 0 1-3 5" />
        <path d="M12 14v3" />
        <path d="M8 20h8" />
        <path d="M9.5 17h5l1 3h-7Z" />
      </svg>
      <h2 className="rc-title text-4xl">¡ANTE {gs.ante} COMPLETADO!</h2>
      <p className="text-slate-400">
        Has superado {gs.round} rondas.{" "}
        {gs.endless
          ? "El modo Endless continúa..."
          : "¡Sigue escalando!"}
      </p>
      <div className="grid w-full grid-cols-2 gap-2">
        <StatBox label="Rondas" value={`${gs.round}`} accent="text-amber-300" />
        <StatBox
          label="Dinero"
          value={`$${gs.money}`}
          accent="text-emerald-300"
        />
        <StatBox
          label="Mejor jugada"
          value={gs.stats.bestHand.toLocaleString()}
          accent="text-rose-300"
        />
        <StatBox
          label="Puntos totales"
          value={gs.stats.totalScore.toLocaleString()}
          accent="text-sky-300"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onContinueEndless}
          className="rc-btn rc-btn-primary px-6 py-3"
        >
          ∞ Seguir escalando
        </button>
        <button
          onClick={onMenu}
          className="rc-btn rc-btn-flat px-6 py-3"
        >
          Menú principal
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   APP PRINCIPAL
   ============================================================ */
export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [gs, setGs] = useState<GameState | null>(null);
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const rewardRng = useRef<Rng>(makeRng(1));
  const shopRng = useRef<Rng>(makeRng(1));

  const spawnParticles = useCallback(
    (x: number, y: number, n: number, big: boolean) => {
      const burst = makeBurst(x, y, n, big);
      setParticles((p) => [...p, ...burst]);
      const ids = new Set(burst.map((b) => b.id));
      setTimeout(
        () => setParticles((p) => p.filter((q) => !ids.has(q.id))),
        950
      );
    },
    []
  );

  const startRound = useCallback(
    (base: GameState, round: number): GameState => {
      const rng = makeRng(base.seed + round * 104729);
      const drawPile = shuffle(rng, base.deck);
      let g: GameState = {
        ...base,
        round,
        ante: Math.ceil(round / 3),
        drawPile,
        hand: [],
        discardPile: [],
        handsLeft: base.handsPerRound,
        discardsLeft: base.discardsPerRound,
        scoreThisRound: 0,
        target: targetForRound(round),
        discardsUsedThisRound: 0,
      };
      if (g.relics.some((r) => r.id === "blood_pact"))
        g = { ...g, handsLeft: Math.max(1, g.handsLeft - 1) };
      const hand: Card[] = [];
      const dp = [...g.drawPile];
      while (hand.length < g.handSize && dp.length) hand.push(dp.shift()!);
      return { ...g, hand, drawPile: dp };
    },
    []
  );

  const newGame = (seed: number, endless: boolean) => {
    setLastSeed(seed);
    const deck = buildStartingDeck();
    const base: GameState = {
      seed,
      round: 1,
      ante: 1,
      money: 4,
      deck,
      drawPile: [],
      hand: [],
      discardPile: [],
      relics: [],
      handsLeft: 4,
      discardsLeft: 3,
      handsPerRound: 4,
      discardsPerRound: 3,
      handSize: 8,
      scoreThisRound: 0,
      target: targetForRound(1),
      discardsUsedThisRound: 0,
      permaMult: 0,
      history: [],
      endless,
      stats: { handsPlayed: 0, bestHand: 0, totalScore: 0 },
    };
    rewardRng.current = makeRng(seed + 555);
    shopRng.current = makeRng(seed + 999);
    setParticles([]);
    setGs(startRound(base, 1));
    setScreen("play");
  };

  const handleWinRound = (g: GameState) => {
    setGs(g);
    setScreen("reward");
  };

  const proceedAfterReward = (g: GameState) => {
    setGs(g);
    if (g.round % 3 === 0) {
      shopRng.current = makeRng(g.seed + g.round * 31337);
      setScreen("shop");
    } else {
      setGs(startRound(g, g.round + 1));
      setScreen("play");
    }
  };

  const handleReward = (relic: Relic) => {
    if (!gs) return;
    proceedAfterReward({ ...gs, relics: [...gs.relics, relic] });
  };
  const handleSkipReward = () => {
    if (!gs) return;
    proceedAfterReward({ ...gs, money: gs.money + 4 });
  };

  const handleContinueFromShop = () => {
    if (!gs) return;
    if (gs.round % 3 === 0) {
      setScreen("win");
      return;
    }
    setGs(startRound(gs, gs.round + 1));
    setScreen("play");
  };

  const handleBuyRelic = (r: Relic, price: number) => {
    if (!gs || gs.money < price) return;
    setGs({ ...gs, money: gs.money - price, relics: [...gs.relics, r] });
  };

  const handleApplySpecial = (
    sp: ShopSpecial,
    cardId: string,
    suit?: Suit
  ) => {
    if (!gs || gs.money < sp.price) return;
    const deck = gs.deck.map((c) => {
      if (c.id !== cardId) return c;
      const nc = { ...c };
      if (sp.kind === "bonus") nc.bonusChips += 30;
      if (sp.kind === "glass") nc.glass = true;
      if (sp.kind === "steel") nc.steel = true;
      if (sp.kind === "gold") nc.gold = true;
      if (sp.kind === "suitconv" && suit) nc.suit = suit;
      return nc;
    });
    setGs({ ...gs, money: gs.money - sp.price, deck });
  };

  const handleSellCard = (cardId: string) => {
    if (!gs || gs.deck.length <= 20) return;
    setGs({
      ...gs,
      money: gs.money + 2,
      deck: gs.deck.filter((c) => c.id !== cardId),
    });
  };

  const handleContinueEndless = () => {
    if (!gs) return;
    setGs(startRound({ ...gs, endless: true }, gs.round + 1));
    setScreen("play");
  };

  return (
    <div className="rc-arena relative min-h-screen w-full text-slate-100 antialiased">
      <style>{`
        @keyframes rcfloat {
          0% { opacity: 0; transform: translateY(0) scale(0.8); }
          20% { opacity: 1; transform: translateY(-10px) scale(1.1); }
          100% { opacity: 0; transform: translateY(-50px) scale(1); }
        }
        @keyframes rcshake {
          0%,100% { transform: translateX(0) translateY(0); }
          25% { transform: translateX(-4px) translateY(1px); }
          50% { transform: translateX(3px) translateY(-1px); }
          75% { transform: translateX(-2px); }
        }
        @keyframes rcshakebig {
          0%,100% { transform: translateX(0) translateY(0); }
          15% { transform: translateX(-6px) translateY(2px); }
          35% { transform: translateX(5px) translateY(-2px); }
          55% { transform: translateX(-4px) translateY(1px); }
          75% { transform: translateX(3px); }
          90% { transform: translateX(-2px); }
        }
        @keyframes rcpulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes rcsway {
          0%,100% { transform: translateY(0) rotate(-0.5deg); }
          50% { transform: translateY(-2px) rotate(0.5deg); }
        }
        @keyframes rcscorepop {
          0% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-22px) scale(1.18); filter: brightness(1.6); }
          100% { transform: translateY(0) scale(1); filter: brightness(1); }
        }
        @keyframes rcspin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.4); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes rcparticle {
          0% { opacity: 1; transform: translate(0,0) scale(1) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3) rotate(var(--dr)); }
        }
        @keyframes rcbigscore {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.2) rotate(-12deg); }
          25% { opacity: 1; transform: translate(-50%,-50%) scale(1.3) rotate(4deg); }
          70% { opacity: 1; transform: translate(-50%,-50%) scale(1) rotate(-2deg); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(1.1) rotate(0deg); }
        }
      `}</style>

      <div className="rc-arena__glow" />
      <div className="rc-arena__floor" />
      <div className="rc-arena__scanlines" />
      <ParticleLayer particles={particles} />

      <div className="relative z-10 mx-auto w-full max-w-5xl py-4 sm:py-6">
        {screen !== "menu" && (
          <div className="mb-2 flex items-center justify-between px-3">
            <button
              onClick={() => setScreen("menu")}
              className="rc-eyebrow transition-colors hover:text-white"
              style={{ fontSize: "0.62rem" }}
            >
              ‹ ROYALE CLIMB
            </button>
            {gs && (
              <span className="font-mono text-[11px] text-slate-600">
                semilla {gs.seed} {gs.endless ? "· ∞" : ""}
              </span>
            )}
          </div>
        )}

        {screen === "menu" && (
          <MenuScreen onStart={newGame} lastSeed={lastSeed} />
        )}

        {screen === "play" && gs && (
          <PlayScreen
            gs={gs}
            setGs={setGs}
            spawnParticles={spawnParticles}
            onWinRound={handleWinRound}
            onDefeat={(g) => {
              setGs(g);
              setScreen("defeat");
            }}
          />
        )}

        {screen === "reward" && gs && (
          <RewardScreen
            gs={gs}
            rng={rewardRng.current}
            onChoose={handleReward}
            onSkip={handleSkipReward}
          />
        )}

        {screen === "shop" && gs && (
          <ShopScreen
            gs={gs}
            rng={shopRng.current}
            onBuyRelic={handleBuyRelic}
            onApplySpecial={handleApplySpecial}
            onSellCard={handleSellCard}
            onContinue={handleContinueFromShop}
          />
        )}

        {screen === "defeat" && gs && (
          <DefeatScreen
            gs={gs}
            onMenu={() => setScreen("menu")}
            onRetry={() => newGame(gs.seed, gs.endless)}
          />
        )}

        {screen === "win" && gs && (
          <WinScreen
            gs={gs}
            onContinueEndless={handleContinueEndless}
            onMenu={() => setScreen("menu")}
          />
        )}
      </div>
    </div>
  );
}
