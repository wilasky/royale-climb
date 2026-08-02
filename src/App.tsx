import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { RelicBadge, RelicCardArt } from "./relicIcons";
import type {
  Suit,
  Rarity,
  Screen,
  Card,
  Relic,
  ShopSpecial,
  SpecialCardKind,
  GameState,
  ScoreBreakdown,
} from "./game/types";
import { makeRng, shuffle } from "./game/rng";
import type { Rng } from "./game/rng";
import { glassRisk, diamondMoneyPreview } from "./game/scoring";
import {
  targetForRound,
  anteOfRound,
  resolveRoundReward,
  resolveAfterShop,
  beginEndlessContinuation,
  isBossRound,
} from "./game/progression";
import {
  selectBossForAnte,
  initBossState,
  scoreWithBoss,
  advanceBossState,
  getBossById,
  describeBossState,
} from "./game/bosses";
import {
  loadProfile,
  saveProfile,
  recordRunStart,
  recordCoronation,
  recordRunEnd,
  markLastCoronationEndless,
  defaultProfile,
  buildPlayerStats,
  exportProfileJson,
  importProfileJson,
} from "./game/profile";
import type { PlayerProfile } from "./game/profile";
import { buildCoronationRecord } from "./game/coronation";
import {
  getUnlockedBossIds,
  getUnlockedOathIds,
  getUnlockedVariantIds,
  offerLegacies,
  claimLegacy,
  getLegacyById,
  LEGACY_POOL,
} from "./game/legacies";
import {
  getOathById,
  shouldShowBossTelegraph,
  OATH_I_VEIL_OF_THE_THRONE,
} from "./game/oaths";
import { applyStartVariant, VARIANT_EMPTY_POCKETS } from "./game/variants";
import {
  RUN_SAVE_VERSION,
  isSaveableScreen,
  emptyRunProgressCounters,
  loadRunSave,
  saveRunSave,
  deleteRunSave,
} from "./game/runSave";
import type {
  RunSave,
  RunProgressCounters,
  PendingRewardSave,
  PendingShopSave,
  PendingRelicReplaceSave,
  PendingLegacySave,
  WinStep,
  LoadRunSaveResult,
} from "./game/runSave";
import { phaseForRound } from "./game/progression";
import { REWARD_WEIGHTS, SHOP_WEIGHTS, STARTING_MONEY, HANDS_PER_ROUND, DISCARDS_PER_ROUND, HAND_SIZE, REWARD_OFFER_COUNT, SHOP_RELIC_COUNT, SHOP_SPECIAL_COUNT, MAX_ACTIVE_RELICS, DECLINE_RELIC_COMPENSATION, REWARD_REROLL_COSTS, REWARD_REROLL_MAX, SHOP_REROLL_COSTS, SHOP_REROLL_MAX, BANISH_MAX, BANISH_COSTS, SYNERGY_MIN_AFFINITY } from "./game/config";
import { pickRelicOffer } from "./game/offers";
import { rerollCost, canReroll } from "./game/rerolls";
import { canBanish, banishCost, applyBanish } from "./game/banish";
import { dominantArchetypes, computeBuildIdentity } from "./game/buildIdentity";
import type { AffinityStrength } from "./game/buildIdentity";
import { ARCHETYPE_LABELS } from "./game/archetypes";
import { logRelicOfferDebug } from "./game/debug";
import { hasRelicCapacity, replaceRelic } from "./game/relics";
import { roundClearBaseReward, computeInterest, relicPrice } from "./game/economy";
import { relicSummary } from "./game/relicSummaries";

/* ============================================================
   ROYALE CLIMB — Roguelike de cartas con combos de póker
   Un solo archivo. React + TS + Tailwind core. Pixel-art CSS puro.
   Lógica de juego pura extraída a src/game/* (ver docs/CHANGELOG_GAMEPLAY.md).
   ============================================================ */

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
  { id: "interest", name: "Banca Privada", desc: "Al fin de ronda ganas 1$ por cada 6$ que tengas (máx 4$).", rarity: "epic", icon: "🏦" },
  { id: "glass_master", name: "Maestro del Vidrio", desc: "Cartas de cristal: x4 en vez de x2 y nunca se rompen.", rarity: "epic", icon: "🔮" },
  { id: "small_hand", name: "Minimalista", desc: "Jugar 1-2 cartas: +50 fichas y +4 Mult.", rarity: "epic", icon: "🤏" },
  { id: "spectrum_boost", name: "Prisma Roto", desc: "Espectro otorga x3 Mult adicional.", rarity: "epic", icon: "🌈" },
  { id: "even_odd", name: "Equilibrio Par", desc: "Si todas las cartas jugadas son pares (el As no cuenta): x3 Mult.", rarity: "epic", icon: "⚖️" },
  { id: "blood_pact", name: "Pacto de Sangre", desc: "x2.5 Mult global, pero -1 mano por ronda.", rarity: "legendary", icon: "🩸" },
  { id: "overflow", name: "Desbordamiento", desc: "Si superas el objetivo x2, ganas +8$.", rarity: "legendary", icon: "💥" },
  { id: "the_collector", name: "El Coleccionista", desc: "+2 Mult por cada modificador que poseas.", rarity: "legendary", icon: "🗃️" },
  { id: "final_hand", name: "Última Palabra", desc: "Tu última mano de la ronda: x4 Mult.", rarity: "legendary", icon: "🎯" },
];

/* ---------------- Cartas especiales para tienda ---------------- */
const SPECIAL_DEFS: ShopSpecial[] = [
  { kind: "bonus", name: "Tinta Brillante", desc: "Da +30 fichas planas a una carta.", price: 4, rarity: "common", icon: "✨" },
  { kind: "glass", name: "Cristal Frágil", desc: "Carta x2 puntos, 25% de romperse al jugarla.", price: 6, rarity: "rare", icon: "🔮" },
  { kind: "steel", name: "Núcleo de Acero", desc: "Mientras esté en mano sin jugar: +1.5 Mult.", price: 7, rarity: "rare", icon: "⚙️" },
  { kind: "gold", name: "Lámina de Oro", desc: "Si está en mano al fin de ronda: +3$.", price: 5, rarity: "rare", icon: "🪙" },
  { kind: "suitconv", name: "Tintura de Palo", desc: "Convierte el palo de una carta al que elijas.", price: 4, rarity: "common", icon: "🎨" },
];

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

/* ---------------- Panel de afinidad de build (Iteración 2G, sección 1) ---------------- */
const STRENGTH_DOTS: Record<AffinityStrength, number> = {
  none: 0,
  weak: 1,
  moderate: 2,
  strong: 3,
};
const STRENGTH_LABEL: Record<AffinityStrength, string> = {
  none: "sin afinidad",
  weak: "débil",
  moderate: "media",
  strong: "fuerte",
};

/**
 * Máximo 2 arquetipos, nunca GENERAL, sin pesos ni porcentajes internos
 * — reutiliza computeBuildIdentity (Iteración 2C) tal cual, no
 * recalcula afinidades por su cuenta (docs/GAME_FEEL_2G.md, sección 1).
 */
function BuildAffinityPanel({ relics }: { relics: Relic[] }) {
  const { affinities } = computeBuildIdentity(relics);
  const shown = affinities.filter((a) => a.archetype !== "GENERAL").slice(0, 2);
  if (shown.length === 0) return null;
  return (
    <div className="rc-panel mb-3 p-3">
      <div className="rc-eyebrow mb-1.5" style={{ fontSize: "0.6rem" }}>
        Build
      </div>
      <div className="flex flex-col gap-1">
        {shown.map((a) => (
          <div
            key={a.archetype}
            className="flex items-center justify-between gap-2"
            aria-label={`${ARCHETYPE_LABELS[a.archetype]}: afinidad ${STRENGTH_LABEL[a.strength]}`}
          >
            <span className="text-xs text-slate-300">
              {ARCHETYPE_LABELS[a.archetype]}
            </span>
            <span aria-hidden="true" className="font-mono text-sm tracking-widest text-amber-300">
              {"●".repeat(STRENGTH_DOTS[a.strength])}
              <span className="text-slate-700">
                {"●".repeat(3 - STRENGTH_DOTS[a.strength])}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Panel de modificadores activos (Iteración 2G, sección 2) ---------------- */
function ModifierRow({ relic }: { relic: Relic }) {
  const summary = relicSummary(relic.id);
  return (
    <Tooltip text={relic.desc}>
      <div
        className={`flex w-full items-center gap-2 rounded-lg border bg-[#12101c]/90 px-2 py-1.5 text-left ring-1 ${RARITY_RING[relic.rarity]} ${RARITY_GLOW[relic.rarity]}`}
      >
        <RelicBadge id={relic.id} size={26} ringClass={RARITY_ACCENT[relic.rarity]} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-xs font-semibold ${RARITY_TEXT[relic.rarity]}`}>
            {relic.name}
          </div>
          {summary && (
            <div className="truncate text-[10px] text-slate-500">
              {summary.condition} <span className="text-slate-600">→</span>{" "}
              {summary.effect}
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

function ModifiersPanel({ relics }: { relics: Relic[] }) {
  return (
    <div className="rc-panel mb-3 p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="rc-eyebrow" style={{ fontSize: "0.6rem" }}>
          Modificadores
        </span>
        <span className="rc-num text-xs text-slate-400">
          {relics.length}/{MAX_ACTIVE_RELICS}
        </span>
      </div>
      {relics.length === 0 ? (
        <p className="text-xs text-slate-600">Ninguno todavía.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {relics.map((r) => (
            <ModifierRow key={r.id} relic={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Pantalla: Menú ---------------- */
function MenuScreen({
  onStart,
  lastSeed,
  unlockedOathIds,
  unlockedVariantIds,
  runSaveState,
  onContinue,
  onDeleteCorruptSave,
  profile,
  onImportProfile,
}: {
  onStart: (
    seed: number,
    endless: boolean,
    oathId: string | null,
    variantId: string | null
  ) => void;
  lastSeed: number | null;
  unlockedOathIds: ReadonlySet<string>;
  unlockedVariantIds: ReadonlySet<string>;
  /** Save de run activa detectado al cargar — sección 3 (docs/PERSISTENCE_2F.md). */
  runSaveState: LoadRunSaveResult;
  onContinue: () => void;
  onDeleteCorruptSave: () => void;
  /** Export/import manual de perfil — sección 11. */
  profile: PlayerProfile;
  onImportProfile: (profile: PlayerProfile) => void;
}) {
  const [seedInput, setSeedInput] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [oathOn, setOathOn] = useState(false);
  const [variantOn, setVariantOn] = useState(false);
  const [corruptDismissed, setCorruptDismissed] = useState(false);
  const [showProfileTools, setShowProfileTools] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImportProfile, setPendingImportProfile] =
    useState<PlayerProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Pulsar "Nueva partida"/"Endless"/"Jugar" con una run guardada exige
  // confirmación antes de reemplazarla (sección 3) — `pendingStart`
  // guarda la acción real hasta que el jugador confirma o cancela.
  const [pendingStart, setPendingStart] = useState<(() => void) | null>(null);
  const oathUnlocked = unlockedOathIds.has(OATH_I_VEIL_OF_THE_THRONE);
  const chosenOathId = oathOn && oathUnlocked ? OATH_I_VEIL_OF_THE_THRONE : null;
  const variantUnlocked = unlockedVariantIds.has(VARIANT_EMPTY_POCKETS);
  const chosenVariantId =
    variantOn && variantUnlocked ? VARIANT_EMPTY_POCKETS : null;
  const hasActiveSave = runSaveState.status === "valid";
  const activeSave = runSaveState.status === "valid" ? runSaveState.save : null;

  const requestStart = (action: () => void) => {
    if (hasActiveSave) setPendingStart(() => action);
    else action();
  };

  // Exportar perfil como archivo JSON — sección 11. Sin servidor, sin
  // cloud sync: descarga local vía Blob, igual que cualquier "backup"
  // de una app de escritorio.
  const handleExportProfile = () => {
    const json = exportProfileJson(profile);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "royale-climb-perfil.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar: lee el archivo, VALIDA (importProfileJson nunca ejecuta
  // el contenido, solo lo parsea como datos) y deja el resultado en
  // pendingImportProfile para pedir confirmación antes de sobrescribir
  // — nunca se aplica directamente aquí.
  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importProfileJson(String(reader.result ?? ""));
      if (result.status === "error") {
        setImportError(result.message);
        setPendingImportProfile(null);
      } else {
        setImportError(null);
        setPendingImportProfile(result.profile);
      }
    };
    reader.readAsText(file);
  };

  // Save corrupto (sección 6): se muestra en vez del menú normal hasta
  // que el jugador elige explícitamente qué hacer. No modifica
  // PlayerProfile en ningún caso.
  if (runSaveState.status === "corrupt" && !corruptDismissed) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="rc-eyebrow text-rose-300">Partida guardada</p>
        <h2 className="rc-title text-2xl">
          La partida guardada no puede recuperarse.
        </h2>
        <div className="flex gap-3">
          <button
            onClick={onDeleteCorruptSave}
            className="rc-btn rc-btn-flat px-5 py-3"
          >
            Eliminar partida guardada
          </button>
          <button
            onClick={() => setCorruptDismissed(true)}
            className="rc-btn rc-btn-ghost px-5 py-3"
          >
            Volver al menú
          </button>
        </div>
      </div>
    );
  }

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
        {/* Continuar run activa — sección 3 (docs/PERSISTENCE_2F.md).
            Componente provisional, sin rediseño de menú. */}
        {activeSave && (
          <div className="rc-panel rc-panel__corners p-3 text-left">
            <p className="rc-eyebrow mb-1 text-cyan-300">Partida en curso</p>
            <p className="mb-2 text-xs text-slate-400">
              Ronda {activeSave.gameState.round} · Ante {activeSave.gameState.ante} ·{" "}
              ${activeSave.gameState.money} · {activeSave.gameState.relics.length}/
              {MAX_ACTIVE_RELICS} modificadores
              <br />
              semilla {activeSave.gameState.seed} ·{" "}
              {new Date(activeSave.savedAt).toLocaleString()}
            </p>
            <button
              onClick={onContinue}
              className="rc-btn rc-btn-primary w-full py-3 text-base"
            >
              ▶ CONTINUAR
            </button>
          </div>
        )}
        <button
          onClick={() =>
            requestStart(() =>
              onStart((Math.random() * 1e9) | 0, false, chosenOathId, chosenVariantId)
            )
          }
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
          onClick={() =>
            requestStart(() =>
              onStart((Math.random() * 1e9) | 0, true, chosenOathId, chosenVariantId)
            )
          }
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
              requestStart(() =>
                onStart(
                  seedInput ? parseInt(seedInput, 10) : (Math.random() * 1e9) | 0,
                  false,
                  chosenOathId,
                  chosenVariantId
                )
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

        {/* Selectores mínimos de Juramento/Variante — Iteración 2E,
            secciones 6-7. Solo visibles una vez desbloqueado el Legado
            correspondiente; componentes provisionales, sin rediseño
            visual. */}
        {oathUnlocked && (
          <label className="mt-1 flex items-center gap-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/[0.06] px-3 py-2 text-left text-xs text-slate-300">
            <input
              type="checkbox"
              checked={oathOn}
              onChange={(e) => setOathOn(e.target.checked)}
              className="accent-fuchsia-400"
            />
            <span>
              <strong className="text-fuchsia-300">Juramento: El Velo del Trono</strong>
              {" — "}no verás el próximo boss del ante hasta llegar a su ronda.
            </span>
          </label>
        )}
        {variantUnlocked && (
          <label className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/[0.06] px-3 py-2 text-left text-xs text-slate-300">
            <input
              type="checkbox"
              checked={variantOn}
              onChange={(e) => setVariantOn(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>
              <strong className="text-cyan-300">Variante: Bolsillos Vacíos</strong>
              {" — "}2$ iniciales en vez de 4$, con un descarte extra por ronda.
            </span>
          </label>
        )}

        {/* Export/import manual de perfil — sección 11 (docs/PERSISTENCE_2F.md).
            Sin servidor, sin cloud sync: backup local y punto. */}
        <button
          onClick={() => setShowProfileTools((s) => !s)}
          className="mt-2 text-xs text-slate-500 underline decoration-dotted hover:text-slate-300"
        >
          {showProfileTools ? "▲ Ocultar perfil" : "▼ Copia de seguridad del perfil"}
        </button>
        {showProfileTools && (
          <div className="rc-panel flex flex-col gap-2 p-3 text-left text-xs text-slate-400">
            <p>
              Exporta tu progresión a un archivo, o impórtala en otro
              navegador/dispositivo.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExportProfile}
                className="rc-btn rc-btn-flat px-3 py-2 text-xs"
              >
                Exportar perfil
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rc-btn rc-btn-flat px-3 py-2 text-xs"
              >
                Importar perfil
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileChosen}
                className="hidden"
              />
            </div>
            {importError && (
              <p className="text-rose-300">{importError}</p>
            )}
          </div>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {pendingStart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,7,20,0.92)] p-4 backdrop-blur-sm">
          <div className="rc-panel rc-panel__corners w-full max-w-sm p-5 text-center">
            <p className="mb-4 text-sm text-slate-300">
              Tienes una partida guardada en curso. Empezar una nueva la
              eliminará. ¿Seguro?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  const action = pendingStart;
                  setPendingStart(null);
                  action();
                }}
                className="rc-btn rc-btn-primary px-4 py-2 text-sm"
              >
                Sí, empezar de nuevo
              </button>
              <button
                onClick={() => setPendingStart(null)}
                className="rc-btn rc-btn-flat px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImportProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,7,20,0.92)] p-4 backdrop-blur-sm">
          <div className="rc-panel rc-panel__corners w-full max-w-sm p-5 text-center">
            <p className="mb-2 text-sm text-slate-300">
              Vas a reemplazar tu perfil actual ({profile.runsWon} coronaciones,{" "}
              {profile.runsStarted} runs) por el importado (
              {pendingImportProfile.runsWon} coronaciones,{" "}
              {pendingImportProfile.runsStarted} runs).
            </p>
            <p className="mb-4 text-xs text-rose-300">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  onImportProfile(pendingImportProfile);
                  setPendingImportProfile(null);
                }}
                className="rc-btn rc-btn-primary px-4 py-2 text-sm"
              >
                Sí, importar
              </button>
              <button
                onClick={() => setPendingImportProfile(null)}
                className="rc-btn rc-btn-flat px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
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
  unlockedBossIds,
  onDiscard,
  onRunEnding,
}: {
  gs: GameState;
  setGs: (g: GameState) => void;
  onWinRound: (g: GameState) => void;
  onDefeat: (g: GameState) => void;
  spawnParticles: (x: number, y: number, n: number, big: boolean) => void;
  unlockedBossIds: ReadonlySet<string>;
  /** Estadísticas de perfil (docs/PERSISTENCE_2F.md, sección 10) — se cuenta un descarte real. */
  onDiscard: () => void;
  /** Se llama en el instante exacto en que se detecta la derrota, antes de la animación (docs/PERSISTENCE_2F.md, sección 8). */
  onRunEnding: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [lastScore, setLastScore] = useState<ScoreBreakdown | null>(null);
  const [floatScore, setFloatScore] = useState<number | null>(null);
  const [bigScore, setBigScore] = useState<number | null>(null);
  const [shake, setShake] = useState<"" | "small" | "big">("");
  const [scoringIds, setScoringIds] = useState<string[]>([]);
  const handRef = useRef<HTMLDivElement>(null);
  const rng = useRef(makeRng(gs.seed + gs.round * 7919));

  const isFirstHand = gs.handsLeft === gs.handsPerRound;
  const isLastHand = gs.handsLeft === 1;

  // Previsualización real (docs/GAME_AUDIT.md P0-3): usa exactamente
  // scoreWithBoss, la misma función que playHand() usa para puntuar de
  // verdad, con los mismos argumentos. scoreWithBoss ya envuelve
  // scorePlay aplicando el boss activo si lo hay (docs/BOSS_DESIGN_2D.md)
  // — así la preview refleja también las reglas de boss, no solo la
  // puntuación base. No consume RNG ni muta nada -
  // glassRisk/diamondMoneyPreview son puramente informativos.
  const preview = useMemo(() => {
    const played = gs.hand.filter((c) => selected.includes(c.id));
    if (played.length === 0) return null;
    const held = gs.hand.filter((c) => !selected.includes(c.id));
    const breakdown = scoreWithBoss(played, held, gs, isFirstHand, isLastHand);
    const glass = glassRisk(played, gs.relics);
    const moneyGain = diamondMoneyPreview(played, gs.relics);
    return { breakdown, glass, moneyGain };
  }, [selected, gs, isFirstHand, isLastHand]);

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

  const playHand = () => {
    if (selected.length === 0 || gs.handsLeft <= 0) return;
    const played = gs.hand.filter((c) => selected.includes(c.id));
    const held = gs.hand.filter((c) => !selected.includes(c.id));
    const bd = scoreWithBoss(played, held, gs, isFirstHand, isLastHand);
    const moneyGain = diamondMoneyPreview(played, gs.relics);

    // Misma probabilidad que se muestra en la previsualización
    // (glassRisk) - aquí sí se consume RNG, porque esto es la
    // ejecución real, no la previsualización.
    const { immune, breakChancePercent } = glassRisk(played, gs.relics);
    const brokenIds = new Set<string>();
    if (!immune) {
      for (const c of played) {
        if (c.glass && rng.current() < breakChancePercent / 100) {
          brokenIds.add(c.id);
        }
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
      bossState: advanceBossState(gs, played, held, bd, isFirstHand, isLastHand),
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
      let cashOut = roundClearBaseReward(g.handsLeft);
      if (has("discard_refund")) cashOut += g.discardsLeft * 2;
      if (has("interest")) cashOut += computeInterest(endMoney);
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
      // Derrota (docs/PERSISTENCE_2F.md): se borra el save AQUÍ, en el
      // mismo instante en que se detecta, no cuando termina la
      // animación de 700ms. Si no, un refresco durante esos 700ms
      // restauraría una run con 0 manos restantes de la que no se
      // podría salir (playHand no hace nada con handsLeft<=0) — borrar
      // ya mismo hace que ese refresco caiga en el menú normal, sin
      // save que continuar, en vez de dejar al jugador atascado.
      onRunEnding();
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
    onDiscard();
  };

  const progress = Math.min(100, (gs.scoreThisRound / gs.target) * 100);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 pb-6 lg:flex-row lg:items-start">
      {/* Panel persistente de build/modificadores (Iteración 2G, docs/GAME_FEEL_2G.md,
          secciones 1-2): reutiliza computeBuildIdentity (2C) tal cual, nunca duplica
          el cálculo de afinidad. order-2 en todos los tamaños: en pantallas
          estrechas queda debajo del área de juego (cartas primero, sección 10
          del encargo — prioridad de información), en pantallas anchas se
          convierte en columna lateral fija a la derecha (lg:flex-row). */}
      <div className="order-2 flex flex-col gap-3 lg:w-64 lg:shrink-0">
        <BuildAffinityPanel relics={gs.relics} />
        <ModifiersPanel relics={gs.relics} />
      </div>
      <div className="order-1 min-w-0 flex-1">
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

      {/* Panel de boss activo / telegraph del próximo boss del ante —
          Iteración 2D, sección 7-8. Sin bosses en Endless. */}
      {!gs.endless &&
        (gs.activeBossId ? (
          (() => {
            const boss = getBossById(gs.activeBossId!);
            if (!boss) return null;
            const stateDesc = describeBossState(gs);
            return (
              <div className="rc-panel rc-panel__corners mb-3 border border-rose-500/40 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rc-eyebrow text-rose-300"
                    style={{ fontSize: "0.62rem" }}
                  >
                    BOSS
                  </span>
                  <span className="text-sm font-semibold text-rose-200">
                    {boss.name}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{boss.description}</p>
                {stateDesc && (
                  <p className="mt-1 text-xs text-rose-300/80">{stateDesc}</p>
                )}
              </div>
            );
          })()
        ) : !shouldShowBossTelegraph(gs.oathId) ? (
          <div className="rc-panel mb-3 p-3 opacity-80">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="rc-eyebrow text-fuchsia-400"
                style={{ fontSize: "0.62rem" }}
              >
                Juramento activo
              </span>
              <span className="text-sm font-semibold text-slate-200">
                {getOathById(gs.oathId)?.name}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              No verás el próximo boss del ante hasta llegar a su ronda.
            </p>
          </div>
        ) : (
          (() => {
            const upcoming = selectBossForAnte(
              gs.seed,
              gs.ante as 1 | 2 | 3,
              unlockedBossIds
            );
            if (!upcoming) return null;
            return (
              <div className="rc-panel mb-3 p-3 opacity-80">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rc-eyebrow text-slate-400"
                    style={{ fontSize: "0.62rem" }}
                  >
                    Próximo boss del ante
                  </span>
                  <span className="text-sm font-semibold text-slate-200">
                    {upcoming.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {upcoming.shortDescription}
                </p>
              </div>
            );
          })()
        ))}

      <div className="rc-panel mb-3 p-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="rc-eyebrow" style={{ fontSize: "0.62rem" }}>
            Objetivo de ronda
          </span>
          <span className="rc-num text-xs">
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
            {preview ? "Combinación detectada" : "Toca cartas para elegirlas"}
          </div>
          <div className="text-2xl font-black text-slate-100">
            {preview ? preview.breakdown.handName : "—"}
          </div>
          {preview && (
            <>
              <div className="font-mono text-sm">
                <span className="text-sky-300">
                  {preview.breakdown.chips} fichas
                </span>
                <span className="text-slate-500"> × </span>
                <span className="text-rose-300">
                  {preview.breakdown.mult} mult
                </span>
                <span className="text-slate-500"> = </span>
                <span className="font-bold text-amber-300">
                  {preview.breakdown.total.toLocaleString()}
                </span>
              </div>
              {preview.breakdown.lines.length > 1 && (
                <div className="mt-1 flex max-w-md flex-wrap gap-1">
                  {preview.breakdown.lines.slice(1).map((l, i) => (
                    <span
                      key={i}
                      className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-300"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
              {preview.glass.count > 0 && (
                <div className="mt-1 text-[10px] text-cyan-300">
                  {preview.glass.immune
                    ? `${preview.glass.count} carta(s) de cristal — no se romperán (Maestro del Vidrio)`
                    : `Riesgo: ${preview.glass.count} carta(s) de cristal, ${preview.glass.breakChancePercent}% de romperse cada una al jugar`}
                </div>
              )}
              {preview.moneyGain > 0 && (
                <div className="mt-0.5 text-[10px] text-emerald-300">
                  +{preview.moneyGain}$ al jugar (Veta Dorada)
                </div>
              )}
            </>
          )}
        </div>
        <div className="relative z-10 text-right">
          {lastScore && (
            <>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Última jugada
              </div>
              <div className="rc-num text-xl text-amber-300">
                +{lastScore.total.toLocaleString()}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {lastScore.chips} × {lastScore.mult}
              </div>
            </>
          )}
          {floatScore !== null && (
            <div className="rc-num pointer-events-none absolute -top-6 right-0 animate-[rcfloat_1.1s_ease-out] text-base text-emerald-300">
              +{floatScore.toLocaleString()}
            </div>
          )}
        </div>
        {bigScore !== null && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 animate-[rcbigscore_1.3s_ease-out] text-center">
            <div className="rc-num text-3xl text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.9)] sm:text-4xl">
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
    </div>
  );
}

/* ---------------- Pantalla: Recompensa ---------------- */
function RewardScreen({
  gs,
  rng,
  onChoose,
  onSkip,
  onRerollSpend,
  onBanish,
  initialOffers,
  initialRerollCount,
  onOfferChange,
}: {
  gs: GameState;
  rng: Rng;
  onChoose: (relic: Relic) => void;
  onSkip: () => void;
  onRerollSpend: (cost: number) => void;
  onBanish: (relicId: string) => void;
  /** Al restaurar un save con esta pantalla pendiente (docs/PERSISTENCE_2F.md). */
  initialOffers?: Relic[];
  initialRerollCount?: number;
  onOfferChange: (offers: Relic[], rerollCount: number) => void;
}) {
  const excludeIds = () =>
    new Set([...gs.relics.map((r) => r.id), ...gs.banishedRelicIds]);

  const [offers, setOffers] = useState<Relic[]>(() => {
    if (initialOffers) return initialOffers;
    const weights = REWARD_WEIGHTS[phaseForRound(gs.round)];
    const initial = pickRelicOffer(
      rng,
      RELIC_POOL,
      excludeIds(),
      REWARD_OFFER_COUNT,
      weights,
      gs.relics
    );
    logRelicOfferDebug(gs, { context: "reward", offers: initial, rerollsUsed: 0 });
    return initial;
  });
  const [rerollCount, setRerollCount] = useState(initialRerollCount ?? 0);

  // Reporta la oferta actual a App.tsx para el autosave — solo en el
  // montaje inicial; los cambios posteriores (reroll, destierro) se
  // reportan explícitamente en sus propios handlers, con el valor ya
  // calculado (evita depender de un `offers`/`rerollCount` que
  // todavía no se ha re-renderizado).
  useEffect(() => {
    onOfferChange(offers, rerollCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rerollAllowed = canReroll(
    rerollCount,
    REWARD_REROLL_MAX,
    gs.money,
    REWARD_REROLL_COSTS
  );
  const nextRerollCost = rerollCost(REWARD_REROLL_COSTS, rerollCount);

  const handleReroll = () => {
    if (!rerollAllowed) return;
    onRerollSpend(nextRerollCost);
    const weights = REWARD_WEIGHTS[phaseForRound(gs.round)];
    const previousIds = new Set(offers.map((r) => r.id));
    const rerolled = pickRelicOffer(
      rng,
      RELIC_POOL,
      excludeIds(),
      REWARD_OFFER_COUNT,
      weights,
      gs.relics,
      previousIds
    );
    logRelicOfferDebug(gs, {
      context: "reward-reroll",
      offers: rerolled,
      rerollsUsed: rerollCount + 1,
    });
    setOffers(rerolled);
    setRerollCount((c) => c + 1);
    onOfferChange(rerolled, rerollCount + 1);
  };

  const handleBanishOffer = (relicId: string) => {
    onBanish(relicId);
    const next = offers.filter((r) => r.id !== relicId);
    setOffers(next);
    onOfferChange(next, rerollCount);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-center">
      <p className="rc-eyebrow mb-2">Ronda {gs.round} superada</p>
      <h2 className="rc-title mb-1 text-3xl">ELIGE TU MODIFICADOR</h2>
      <p className="mb-2 text-sm text-slate-400">
        Cada elección define tu estrategia para el resto de la partida.
      </p>
      <p className="mb-6 text-xs text-slate-500">
        Modificadores: {gs.relics.length}/{MAX_ACTIVE_RELICS}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {offers.map((r) => (
          <div
            key={r.id}
            className={`rc-panel rc-panel__corners group relative flex flex-col items-center gap-2 overflow-hidden p-5 ring-1 ${RARITY_RING[r.rarity]} ${RARITY_GLOW[r.rarity]}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 opacity-[0.14] ${RARITY_TEXT[r.rarity]}`}
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, currentColor, transparent 65%)",
              }}
            />
            <button
              onClick={() => onChoose(r)}
              className="relative flex w-full flex-col items-center gap-2 transition-transform hover:scale-[1.04] active:scale-95"
            >
              <div className="transition-transform group-hover:scale-110">
                <RelicCardArt id={r.id} rarity={r.rarity} size={64} />
              </div>
              <span
                className={`text-xs font-black uppercase tracking-wider ${RARITY_TEXT[r.rarity]}`}
              >
                {r.rarity}
              </span>
              <span className="text-lg font-bold text-slate-100">{r.name}</span>
              <span className="text-xs text-slate-400">{r.desc}</span>
            </button>
            {canBanish(gs.banishedRelicIds, BANISH_MAX) && (
              <button
                onClick={() => handleBanishOffer(r.id)}
                disabled={gs.money < banishCost(gs.banishedRelicIds, BANISH_COSTS)}
                className="rc-btn rc-btn-flat relative px-3 py-1 text-[11px] disabled:opacity-40"
              >
                Desterrar
                {banishCost(gs.banishedRelicIds, BANISH_COSTS) > 0
                  ? ` (${banishCost(gs.banishedRelicIds, BANISH_COSTS)}$)`
                  : " (gratis)"}
              </button>
            )}
          </div>
        ))}
        {offers.length === 0 && (
          <p className="col-span-3 text-slate-500">
            Tienes todos los modificadores disponibles. ¡Impresionante!
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onSkip}
          className="rc-btn rc-btn-flat px-5 py-2 text-sm"
        >
          Saltar (+{DECLINE_RELIC_COMPENSATION}$)
        </button>
        {rerollCount < REWARD_REROLL_MAX && (
          <button
            onClick={handleReroll}
            disabled={!rerollAllowed}
            className="rc-btn rc-btn-flat px-5 py-2 text-sm disabled:opacity-40"
          >
            Volver a tirar ({nextRerollCost}$)
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Pantalla: Recompensa económica ---------------- */
function MoneyRewardScreen({
  gs,
  onContinue,
}: {
  gs: GameState;
  onContinue: () => void;
}) {
  const reward = useMemo(
    () => resolveRoundReward(gs.round, gs.endless),
    [gs.round, gs.endless]
  );
  const amount = reward.type === "money" ? reward.amount : 0;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="rc-eyebrow mb-2">Ronda {gs.round} superada</p>
      <h2 className="rc-title mb-6 text-3xl">RECOMPENSA ECONÓMICA</h2>
      <div className="rc-panel rc-panel__corners mb-6 flex flex-col items-center gap-1 p-8">
        <span className="rc-num text-4xl text-emerald-300">+{amount}$</span>
        <span className="text-xs text-slate-500">Total: ${gs.money}</span>
      </div>
      <button
        onClick={onContinue}
        className="rc-btn rc-btn-primary w-full py-4 text-lg"
      >
        Continuar →
      </button>
    </div>
  );
}

/* ---------------- Pantalla: Tienda ---------------- */
type ShopStock = {
  relics: { relic: Relic; price: number }[];
  specials: ShopSpecial[];
};

function ShopScreen({
  gs,
  rng,
  onBuyRelic,
  onApplySpecial,
  onSellCard,
  onContinue,
  onRerollSpend,
  onBanish,
  initialStock,
  initialUsedSpecialKinds,
  initialRerollCount,
  onStockChange,
}: {
  gs: GameState;
  rng: Rng;
  onBuyRelic: (r: Relic, price: number) => void;
  onApplySpecial: (sp: ShopSpecial, cardId: string, suit?: Suit) => void;
  onSellCard: (cardId: string) => void;
  onContinue: () => void;
  onRerollSpend: (cost: number) => void;
  onBanish: (relicId: string) => void;
  /** Al restaurar un save con esta pantalla pendiente (docs/PERSISTENCE_2F.md). */
  initialStock?: ShopStock;
  initialUsedSpecialKinds?: SpecialCardKind[];
  initialRerollCount?: number;
  onStockChange: (
    stock: ShopStock,
    usedSpecialKinds: SpecialCardKind[],
    rerollCount: number
  ) => void;
}) {
  const [pendingSpecial, setPendingSpecial] = useState<ShopSpecial | null>(
    null
  );
  const [convSuit, setConvSuit] = useState<Suit>("spades");
  const [showSell, setShowSell] = useState(false);
  // Se identifica por `kind` (no por índice de `stock.specials`) para que
  // un reroll de tienda pueda regenerar las mejoras de carta sin perder
  // el rastro de cuáles ya se aplicaron a una carta - "las compras ya
  // realizadas no reaparecen automáticamente" (sección 4 del encargo).
  const [usedSpecialKinds, setUsedSpecialKinds] = useState<
    Set<SpecialCardKind>
  >(new Set(initialUsedSpecialKinds ?? []));
  const [shopRerollCount, setShopRerollCount] = useState(initialRerollCount ?? 0);

  const generateStock = (
    excludeSpecialKinds: Set<SpecialCardKind>,
    rerollsUsed = 0
  ): ShopStock => {
    const excludeRelicIds = new Set([
      ...gs.relics.map((r) => r.id),
      ...gs.banishedRelicIds,
    ]);
    const weights = SHOP_WEIGHTS[phaseForRound(gs.round)];
    const relics = pickRelicOffer(
      rng,
      RELIC_POOL,
      excludeRelicIds,
      SHOP_RELIC_COUNT,
      weights,
      gs.relics
    );
    logRelicOfferDebug(gs, {
      context: rerollsUsed === 0 ? "shop" : "shop-reroll",
      offers: relics,
      rerollsUsed,
    });
    const availableSpecials = SPECIAL_DEFS.filter(
      (sp) => !excludeSpecialKinds.has(sp.kind)
    );
    const specials = shuffle(rng, availableSpecials).slice(0, SHOP_SPECIAL_COUNT);
    return {
      relics: relics.map((r) => ({ relic: r, price: relicPrice(r.rarity) })),
      specials,
    };
  };

  const [stock, setStock] = useState<ShopStock>(
    () => initialStock ?? generateStock(new Set())
  );

  // Reporta el stock actual a App.tsx para el autosave — solo en el
  // montaje inicial; los cambios posteriores se reportan explícitamente
  // en sus propios handlers (mismo patrón que RewardScreen).
  useEffect(() => {
    onStockChange(stock, [...usedSpecialKinds], shopRerollCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shopRerollAllowed = canReroll(
    shopRerollCount,
    SHOP_REROLL_MAX,
    gs.money,
    SHOP_REROLL_COSTS
  );
  const nextShopRerollCost = rerollCost(SHOP_REROLL_COSTS, shopRerollCount);

  const handleBanishOffer = (relicId: string) => {
    onBanish(relicId);
    const next = {
      ...stock,
      relics: stock.relics.filter(({ relic }) => relic.id !== relicId),
    };
    setStock(next);
    onStockChange(next, [...usedSpecialKinds], shopRerollCount);
  };

  const handleShopReroll = () => {
    if (!shopRerollAllowed) return;
    onRerollSpend(nextShopRerollCost);
    const next = generateStock(usedSpecialKinds, shopRerollCount + 1);
    setStock(next);
    setShopRerollCount((c) => c + 1);
    onStockChange(next, [...usedSpecialKinds], shopRerollCount + 1);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-7 flex items-baseline justify-between">
        <div>
          <p className="rc-eyebrow mb-1">Ronda {gs.round} · parada</p>
          <h2 className="rc-title text-3xl sm:text-4xl">TIENDA</h2>
        </div>
        <span className="rc-btn rc-btn-gold rc-panel__corners rc-num px-4 py-2 text-sm">
          ${gs.money}
        </span>
      </div>

      <h3 className="rc-eyebrow mb-2">
        Modificadores ({gs.relics.length}/{MAX_ACTIVE_RELICS})
      </h3>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {stock.relics.map(({ relic, price }) => {
          const bought = gs.relics.some((r) => r.id === relic.id);
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
              <RelicCardArt id={relic.id} rarity={relic.rarity} size={40} />
              <div className="relative min-w-0 flex-1">
                <div
                  className={`text-sm font-bold ${RARITY_TEXT[relic.rarity]}`}
                >
                  {relic.name}
                </div>
                <div className="text-xs text-slate-400">{relic.desc}</div>
              </div>
              <div className="relative flex shrink-0 flex-col items-stretch gap-1">
                <button
                  disabled={bought || !afford}
                  onClick={() => onBuyRelic(relic, price)}
                  className="rc-btn rc-btn-primary px-3 py-2 text-sm"
                >
                  {bought ? "✓" : `${price}`}
                </button>
                {!bought && canBanish(gs.banishedRelicIds, BANISH_MAX) && (
                  <button
                    onClick={() => handleBanishOffer(relic.id)}
                    disabled={
                      gs.money < banishCost(gs.banishedRelicIds, BANISH_COSTS)
                    }
                    className="rc-btn rc-btn-flat px-3 py-1 text-[11px] disabled:opacity-40"
                  >
                    Desterrar
                  </button>
                )}
              </div>
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
          const used = usedSpecialKinds.has(sp.kind);
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
              <RelicCardArt id={sp.kind} rarity={sp.rarity} size={52} />
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

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setShowSell((s) => !s)}
          className="rc-btn rc-btn-ghost--magenta px-4 py-2 text-sm"
        >
          {showSell
            ? "▲ Ocultar baraja"
            : "▼ Vender cartas (+2$ c/u)"}
        </button>
        {shopRerollCount < SHOP_REROLL_MAX && (
          <button
            onClick={handleShopReroll}
            disabled={!shopRerollAllowed}
            className="rc-btn rc-btn-ghost--magenta px-4 py-2 text-sm disabled:opacity-40"
          >
            Volver a tirar tienda ({nextShopRerollCost}$)
          </button>
        )}
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
              <RelicCardArt
                id={pendingSpecial.kind}
                rarity={pendingSpecial.rarity}
                size={30}
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
                      const nextUsed = new Set(usedSpecialKinds).add(
                        pendingSpecial.kind
                      );
                      setUsedSpecialKinds(nextUsed);
                      onStockChange(stock, [...nextUsed], shopRerollCount);
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

/* ---------------- Modal: sustituir modificador (cupo lleno) ---------------- */
function RelicReplaceModal({
  incoming,
  current,
  onConfirm,
  onCancel,
}: {
  incoming: Relic;
  current: Relic[];
  onConfirm: (removeId: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,7,20,0.92)] p-4 backdrop-blur-sm">
      <div className="rc-panel rc-panel__corners max-h-[85vh] w-full max-w-2xl overflow-auto p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <RelicCardArt id={incoming.id} rarity={incoming.rarity} size={30} />
          <h4 className="rc-title flex-1 text-lg">
            {current.length}/{MAX_ACTIVE_RELICS} modificadores — elige cuál sustituir
          </h4>
          <button
            onClick={onCancel}
            className="rc-btn rc-btn-flat px-3 py-1 text-sm"
          >
            Cancelar
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-400">
          Modificador nuevo:{" "}
          <span className="font-bold text-slate-100">{incoming.name}</span> —{" "}
          {incoming.desc}
        </p>
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {current.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={`rc-panel rc-panel__corners flex items-center gap-3 p-3 text-left ring-1 transition-transform ${RARITY_RING[r.rarity]} ${
                selected === r.id ? "scale-[1.02] ring-2 ring-rose-400" : ""
              }`}
            >
              <RelicCardArt id={r.id} rarity={r.rarity} size={36} />
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-bold ${RARITY_TEXT[r.rarity]}`}>
                  {r.name}
                </div>
                <div className="text-xs text-slate-400">{r.desc}</div>
              </div>
              {selected === r.id && <span className="text-rose-300">✕</span>}
            </button>
          ))}
        </div>
        <button
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="rc-btn rc-btn-primary w-full py-3 text-sm disabled:opacity-40"
        >
          Confirmar sustitución
        </button>
      </div>
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
/**
 * Pantalla de Coronación — Iteración 2E (docs/METAPROGRESSION_2E.md,
 * sección 9). Extiende la antigua pantalla de victoria con un flujo
 * de 3 pasos: resumen de la Coronación → elegir Legado (si queda
 * alguno disponible) → confirmación de lo desbloqueado. Los botones
 * finales (Endless / nueva run / menú) solo aparecen en el último
 * paso, y "Seguir escalando" sigue funcionando exactamente igual que
 * antes tras elegir Legado — nunca se pierde la recompensa por elegir
 * Endless (sección 9 del encargo).
 */
function WinScreen({
  gs,
  profile,
  onClaimLegacy,
  onContinueEndless,
  onNewRun,
  onMenu,
  initialStep,
  initialClaimedId,
  onStepChange,
}: {
  gs: GameState;
  profile: PlayerProfile;
  onClaimLegacy: (legacyId: string) => void;
  onContinueEndless: () => void;
  onNewRun: () => void;
  onMenu: () => void;
  /** Al restaurar un save con Coronación pendiente (docs/PERSISTENCE_2F.md). */
  initialStep?: WinStep;
  initialClaimedId?: string | null;
  onStepChange: (step: WinStep, claimedId: string | null) => void;
}) {
  const [step, setStep] = useState<WinStep>(initialStep ?? "summary");
  const [claimedId, setClaimedId] = useState<string | null>(initialClaimedId ?? null);

  // Reporta el paso actual a App.tsx para el autosave — la oferta de
  // Legados en sí NO se reporta (se recalcula determinista al
  // restaurar, ver runSave.ts). Deps vacías: el mount inicial ya
  // coincide con initialStep/initialClaimedId, no hace falta re-avisar.
  useEffect(() => {
    onStepChange(step, claimedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, claimedId]);

  const finalBoss = gs.activeBossId ? getBossById(gs.activeBossId) : null;
  const oath = getOathById(gs.oathId);
  const buildLabels = dominantArchetypes(gs.relics, SYNERGY_MIN_AFFINITY, 2).map(
    (a) => ARCHETYPE_LABELS[a]
  );
  const buildLabel = buildLabels.length > 0 ? buildLabels.join(" · ") : "Sin arquetipo dominante";
  // Determinista (docs/METAPROGRESSION_2E.md, sección 11): misma seed +
  // mismo perfil (ya actualizado con esta Coronación) ⇒ misma oferta.
  const offers = useMemo(() => offerLegacies(profile, gs.seed), [profile, gs.seed]);

  const handleChoose = (legacyId: string) => {
    onClaimLegacy(legacyId);
    setClaimedId(legacyId);
    setStep("confirm");
  };

  const crownIcon = (
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
  );

  if (step === "summary") {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
        {crownIcon}
        <p className="rc-eyebrow text-amber-300">Coronación completada</p>
        <h2 className="rc-title text-4xl">Has conquistado esta Ascensión.</h2>
        {finalBoss && (
          <p className="text-sm font-semibold text-rose-300">
            Boss final derrotado: {finalBoss.name}
          </p>
        )}
        <p className="text-slate-400">
          Has superado las {gs.round} rondas de esta run. Puedes parar aquí, o
          seguir escalando en Modo Endless desde la ronda {gs.round + 1}.
        </p>
        <div className="grid w-full grid-cols-2 gap-2">
          <StatBox label="Rondas" value={`${gs.round}`} accent="text-amber-300" />
          <StatBox
            label="Puntos totales"
            value={gs.stats.totalScore.toLocaleString()}
            accent="text-sky-300"
          />
          <StatBox
            label="Mejor jugada"
            value={gs.stats.bestHand.toLocaleString()}
            accent="text-rose-300"
          />
          <StatBox
            label="Juramento"
            value={oath ? oath.name : "Ninguno"}
            accent="text-fuchsia-300"
          />
        </div>
        <p className="text-xs text-slate-500">Build dominante: {buildLabel}</p>
        <button
          onClick={() => setStep("legacy")}
          className="rc-btn rc-btn-primary px-6 py-3"
        >
          {offers.length > 0
            ? `👑 Elegir Legado (${offers.length} disponible${offers.length > 1 ? "s" : ""})`
            : "Continuar"}
        </button>
      </div>
    );
  }

  if (step === "legacy") {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="rc-eyebrow text-amber-300">Legados de la Corona</p>
        <h2 className="rc-title text-3xl">Elige tu Legado</h2>
        {offers.length === 0 ? (
          <>
            <p className="text-slate-400">
              Todos los Legados disponibles han sido reclamados.
            </p>
            <button
              onClick={() => setStep("confirm")}
              className="rc-btn rc-btn-primary px-6 py-3"
            >
              Continuar
            </button>
          </>
        ) : (
          <div className="flex w-full flex-col gap-2">
            {offers.map((legacy) => (
              <button
                key={legacy.id}
                onClick={() => handleChoose(legacy.id)}
                className="rc-panel rc-panel__corners p-3 text-left transition-colors hover:border-cyan-400/60"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">
                    {legacy.name}
                  </span>
                  <span className="rc-eyebrow text-slate-500" style={{ fontSize: "0.6rem" }}>
                    {legacy.category === "content"
                      ? "Contenido"
                      : legacy.category === "playstyle"
                      ? "Forma de jugar"
                      : "Desafío"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{legacy.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // step === "confirm"
  const claimedLegacy = claimedId ? getLegacyById(claimedId) : null;
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
      {crownIcon}
      {claimedLegacy ? (
        <>
          <p className="rc-eyebrow text-amber-300">Desbloqueado</p>
          <h2 className="rc-title text-3xl">{claimedLegacy.name}</h2>
          <p className="text-slate-400">{claimedLegacy.description}</p>
        </>
      ) : (
        <h2 className="rc-title text-3xl">¡PARTIDA COMPLETADA!</h2>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onContinueEndless}
          className="rc-btn rc-btn-primary px-6 py-3"
        >
          ∞ Seguir escalando
        </button>
        <button onClick={onNewRun} className="rc-btn rc-btn-ghost px-6 py-3">
          ▶ Nueva run
        </button>
        <button onClick={onMenu} className="rc-btn rc-btn-flat px-6 py-3">
          Menú principal
        </button>
      </div>
    </div>
  );
}

/**
 * Panel de depuración del perfil — Iteración 2E, sección 12. Solo se
 * monta cuando `import.meta.env.DEV` (ver el guard en `App`, más
 * abajo, y el mismo patrón ya usado en `src/game/debug.ts`): nunca
 * aparece en el build de producción. Permite inspeccionar el perfil
 * crudo, resetear progresión y desbloquear temporalmente todo el
 * contenido implementado para probar el flujo sin jugar 3 runs
 * completas.
 */
function DevProfilePanel({
  profile,
  onReset,
  onUnlockAll,
}: {
  profile: PlayerProfile;
  onReset: () => void;
  onUnlockAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-2 right-2 z-50 max-w-xs text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rc-btn rc-btn-flat px-2 py-1"
        style={{ fontSize: "0.6rem" }}
      >
        🛠 DEV perfil
      </button>
      {open && (
        <div className="mt-1 max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/90 p-2 text-slate-300">
          <div className="mb-2 flex gap-2">
            <button
              onClick={onReset}
              className="rc-btn rc-btn-flat px-2 py-1"
              style={{ fontSize: "0.6rem" }}
            >
              Reset perfil
            </button>
            <button
              onClick={onUnlockAll}
              className="rc-btn rc-btn-flat px-2 py-1"
              style={{ fontSize: "0.6rem" }}
            >
              Desbloquear todo
            </button>
          </div>
          <div className="mb-2 border-b border-white/10 pb-2" style={{ fontSize: "0.6rem" }}>
            {(() => {
              const s = buildPlayerStats(profile);
              return (
                <>
                  <div>
                    runs: {s.runsStarted} · ganadas: {s.runsWon} · perdidas: {s.runsLost} ·
                    winRate: {(s.winRate * 100).toFixed(0)}%
                  </div>
                  <div>
                    manos: {s.totalHandsPlayed} · descartes: {s.totalDiscards} · rerolls:{" "}
                    {s.totalRerolls} · destierros: {s.totalBanishes} · compras:{" "}
                    {s.totalShopPurchases}
                  </div>
                  <div>
                    mejor ronda: {s.highestRound} · mejor ronda Endless:{" "}
                    {s.highestEndlessRound} · mejor puntuación: {s.bestTotalScore} · mejor
                    mano: {s.bestSingleHand}
                  </div>
                  <div>
                    Coronaciones: {s.coronationsCount} · build favorita:{" "}
                    {s.favoriteBuild ?? "—"}
                  </div>
                </>
              );
            })()}
          </div>
          <pre className="whitespace-pre-wrap break-all" style={{ fontSize: "0.6rem" }}>
            {JSON.stringify(profile, null, 1)}
          </pre>
        </div>
      )}
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
  const [pendingRelicReplace, setPendingRelicReplace] =
    useState<PendingRelicReplaceSave | null>(null);
  // Perfil de progresión persistente — Iteración 2E
  // (docs/METAPROGRESSION_2E.md). Independiente de `gs`: sobrevive a
  // partidas perdidas, a cerrar la pestaña, a "Nueva partida".
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const unlockedBossIds = useMemo(() => getUnlockedBossIds(profile), [profile]);
  const unlockedOathIds = useMemo(() => getUnlockedOathIds(profile), [profile]);
  const unlockedVariantIds = useMemo(() => getUnlockedVariantIds(profile), [profile]);
  const rewardRng = useRef<Rng>(makeRng(1));
  const shopRng = useRef<Rng>(makeRng(1));

  // Persistencia de run activa — Iteración 2F (docs/PERSISTENCE_2F.md).
  // `runSaveState` se carga UNA vez al montar (no se vuelve a leer de
  // localStorage salvo que el propio usuario borre/continúe/reemplace
  // el save) y separa explícitamente "no hay save" / "save válido" /
  // "save corrupto" para que MenuScreen pueda mostrar cada caso.
  const [runSaveState, setRunSaveState] = useState<LoadRunSaveResult>(() =>
    loadRunSave()
  );
  const [runProgress, setRunProgress] = useState<RunProgressCounters>(
    emptyRunProgressCounters()
  );
  const [pendingReward, setPendingReward] = useState<PendingRewardSave | null>(
    null
  );
  const [pendingShop, setPendingShop] = useState<PendingShopSave | null>(null);
  const [pendingLegacy, setPendingLegacy] = useState<PendingLegacySave | null>(
    null
  );
  // Cuando una acción borra el save de forma explícita y adelantada
  // (p.ej. detectar handsLeft<=0 en playHand, antes de que termine la
  // animación de derrota — ver más abajo), el siguiente `gs`/`screen`
  // que ya estaba en cola dispararía este mismo useEffect y
  // re-escribiría el save recién borrado. Esta bandera hace que esa
  // única escritura se salte, sin tener que acoplar el efecto a
  // ninguna lógica de victoria/derrota.
  const suppressNextAutosaveRef = useRef(false);

  // Autosave — sección 2 del encargo. Se dispara tras CUALQUIER
  // transición real (cambia `gs` o `screen`), nunca durante animaciones
  // puramente visuales: los efectos cosméticos de PlayScreen
  // (floatScore, shake, particles, scoringIds) viven como estado local
  // de ese componente, nunca tocan `gs`, así que no disparan este
  // efecto. Solo escribe en pantallas guardables (`isSaveableScreen`) —
  // en "menu" o "defeat" no hay run activa que guardar.
  useEffect(() => {
    if (!gs || !isSaveableScreen(screen)) return;
    if (suppressNextAutosaveRef.current) {
      suppressNextAutosaveRef.current = false;
      return;
    }
    const save: RunSave = {
      version: RUN_SAVE_VERSION,
      savedAt: new Date().toISOString(),
      screen,
      gameState: gs,
      runProgress,
      pendingReward: screen === "reward" ? pendingReward : null,
      pendingShop: screen === "shop" ? pendingShop : null,
      pendingRelicReplace,
      pendingLegacy: screen === "win" ? pendingLegacy : null,
    };
    saveRunSave(save);
  }, [
    gs,
    screen,
    runProgress,
    pendingReward,
    pendingShop,
    pendingRelicReplace,
    pendingLegacy,
  ]);

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
    (
      base: GameState,
      round: number,
      unlockedBossIds: ReadonlySet<string>
    ): GameState => {
      const rng = makeRng(base.seed + round * 104729);
      const drawPile = shuffle(rng, base.deck);
      // Boss de esta ronda (docs/BOSS_DESIGN_2D.md): se recalcula en
      // cada startRound, así que nunca sobrevive a la ronda para la que
      // fue seleccionado. Endless no tiene bosses (isBossRound ya lo
      // excluye), y selectBossForAnte devuelve null si ese ante todavía
      // no tiene ningún boss definido. `unlockedBossIds` (Iteración 2E)
      // habilita bosses desbloqueables vía Legado de la Corona — ver
      // docs/METAPROGRESSION_2E.md.
      const ante = anteOfRound(round);
      const boss = isBossRound(round, base.endless)
        ? selectBossForAnte(base.seed, ante as 1 | 2 | 3, unlockedBossIds)
        : null;
      let g: GameState = {
        ...base,
        round,
        ante,
        drawPile,
        hand: [],
        discardPile: [],
        handsLeft: base.handsPerRound,
        discardsLeft: base.discardsPerRound,
        scoreThisRound: 0,
        target: targetForRound(round),
        discardsUsedThisRound: 0,
        activeBossId: boss?.id ?? null,
        bossState: initBossState(boss?.id ?? null),
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

  const newGame = (
    seed: number,
    endless: boolean,
    oathId: string | null = null,
    variantId: string | null = null
  ) => {
    setLastSeed(seed);
    // "runs iniciadas" (docs/METAPROGRESSION_2E.md, sección 1) - se
    // cuenta aquí, gane o pierda la run después.
    const startedProfile = recordRunStart(profile);
    setProfile(startedProfile);
    saveProfile(startedProfile);
    // Nueva run: cualquier save anterior (jugado hasta el final o no)
    // deja de ser la run activa. MenuScreen ya pidió confirmación si
    // hacía falta (docs/PERSISTENCE_2F.md, sección "Fin de run").
    deleteRunSave();
    setRunSaveState({ status: "none" });
    setRunProgress(emptyRunProgressCounters());
    setPendingReward(null);
    setPendingShop(null);
    setPendingLegacy(null);
    setPendingRelicReplace(null);
    const deck = buildStartingDeck();
    const base: GameState = applyStartVariant(
      {
        seed,
        round: 1,
        ante: 1,
        money: STARTING_MONEY,
        deck,
        drawPile: [],
        hand: [],
        discardPile: [],
        relics: [],
        handsLeft: HANDS_PER_ROUND,
        discardsLeft: DISCARDS_PER_ROUND,
        handsPerRound: HANDS_PER_ROUND,
        discardsPerRound: DISCARDS_PER_ROUND,
        handSize: HAND_SIZE,
        scoreThisRound: 0,
        target: targetForRound(1),
        discardsUsedThisRound: 0,
        permaMult: 0,
        history: [],
        endless,
        stats: { handsPlayed: 0, bestHand: 0, totalScore: 0 },
        banishedRelicIds: [],
        activeBossId: null,
        bossState: {},
        oathId,
      },
      variantId
    );
    rewardRng.current = makeRng(seed + 555);
    shopRng.current = makeRng(seed + 999);
    setParticles([]);
    setGs(startRound(base, 1, unlockedBossIds));
    setScreen("play");
  };

  // Flujo de fin de ronda - ver docs/BALANCE_ITERATION_2B.md sección 2 y
  // src/game/progression.ts. `resolveRoundReward` decide de entrada (al
  // ganar la ronda) qué tipo de recompensa toca: modificador, dinero,
  // tienda o victoria - ya no hay una pantalla de recompensa universal
  // que luego decida si además toca tienda/victoria.
  const handleWinRound = (g: GameState) => {
    const outcome = resolveRoundReward(g.round, g.endless);
    if (outcome.type === "victory") {
      // Coronación (docs/METAPROGRESSION_2E.md, sección 2): derrotar
      // al boss final de una run no-Endless. Se registra aquí, antes
      // de mostrar la pantalla de victoria, para que la oferta de
      // Legados (WinScreen) ya vea el perfil actualizado.
      const record = buildCoronationRecord(g);
      let nextProfile = recordCoronation(profile, record, g.round, g.stats.bestHand);
      // Totales outcome-agnósticos (sección 10) — recordCoronation ya
      // actualizó runsWon/coronations/bossesDefeated, recordRunEnd
      // añade hands/discards/rerolls/banishes/compras de ESTA run.
      nextProfile = recordRunEnd(nextProfile, {
        won: true,
        endless: g.endless,
        reachedRound: g.round,
        totalScore: g.stats.totalScore,
        bestHand: g.stats.bestHand,
        handsPlayed: g.stats.handsPlayed,
        discardsUsed: runProgress.discardsUsed,
        rerollsUsed: runProgress.rerollsUsed,
        shopPurchases: runProgress.shopPurchases,
        banishesUsed: g.banishedRelicIds.length,
      });
      setProfile(nextProfile);
      saveProfile(nextProfile);
      setGs(g);
      setScreen("win");
      return;
    }
    if (outcome.type === "shop") {
      setGs(g);
      shopRng.current = makeRng(g.seed + g.round * 31337);
      setScreen("shop");
      return;
    }
    if (outcome.type === "relic") {
      setGs(g);
      setScreen("reward");
      return;
    }
    // outcome.type === "money"
    setGs({ ...g, money: g.money + outcome.amount });
    setScreen("money-reward");
  };

  /** Avanza siempre a la ronda siguiente - `handleWinRound` ya resolvió
   *  una sola vez si tocaba tienda/victoria antes de llegar aquí. */
  const advanceToNextRound = (g: GameState) => {
    const { nextRound } = resolveAfterShop(g.round);
    setPendingReward(null);
    setPendingShop(null);
    setGs(startRound(g, nextRound, unlockedBossIds));
    setScreen("play");
  };

  const handleReward = (relic: Relic) => {
    if (!gs) return;
    if (hasRelicCapacity(gs.relics, MAX_ACTIVE_RELICS)) {
      advanceToNextRound({ ...gs, relics: [...gs.relics, relic] });
    } else {
      setPendingRelicReplace({ incoming: relic, context: "reward" });
    }
  };
  const handleSkipReward = () => {
    if (!gs) return;
    advanceToNextRound({ ...gs, money: gs.money + DECLINE_RELIC_COMPENSATION });
  };

  const handleRewardRerollSpend = (cost: number) => {
    if (!gs) return;
    setGs({ ...gs, money: gs.money - cost });
    setRunProgress((p) => ({ ...p, rerollsUsed: p.rerollsUsed + 1 }));
  };

  const handleMoneyRewardContinue = () => {
    if (!gs) return;
    advanceToNextRound(gs);
  };

  const handleConfirmRelicReplace = (removeId: string) => {
    if (!gs || !pendingRelicReplace) return;
    const { incoming, context, price } = pendingRelicReplace;
    let g: GameState = {
      ...gs,
      relics: replaceRelic(gs.relics, removeId, incoming),
    };
    if (context === "shop" && price != null) {
      g = { ...g, money: g.money - price };
      setRunProgress((p) => ({ ...p, shopPurchases: p.shopPurchases + 1 }));
    }
    setPendingRelicReplace(null);
    if (context === "reward") {
      advanceToNextRound(g);
    } else {
      setGs(g);
    }
  };
  const handleCancelRelicReplace = () => setPendingRelicReplace(null);

  const handleContinueFromShop = () => {
    if (!gs) return;
    advanceToNextRound(gs);
  };

  const handleShopRerollSpend = (cost: number) => {
    if (!gs) return;
    setGs({ ...gs, money: gs.money - cost });
    setRunProgress((p) => ({ ...p, rerollsUsed: p.rerollsUsed + 1 }));
  };

  /**
   * Destierro permanente de modificador (docs/BUILD_AGENCY_ITERATION_2C.md,
   * sección 7). Valida capacidad/dinero/no-poseído aquí, en el único sitio
   * con acceso a `gs` — RewardScreen/ShopScreen ya deshabilitan el botón
   * cuando no procede, esto es la comprobación real antes de mutar estado.
   */
  const handleBanish = (relicId: string) => {
    if (!gs) return;
    if (!canBanish(gs.banishedRelicIds, BANISH_MAX)) return;
    if (gs.relics.some((r) => r.id === relicId)) return;
    const cost = banishCost(gs.banishedRelicIds, BANISH_COSTS);
    if (gs.money < cost) return;
    setGs({
      ...gs,
      money: gs.money - cost,
      banishedRelicIds: applyBanish(gs.banishedRelicIds, relicId),
    });
  };

  const handleBuyRelic = (r: Relic, price: number) => {
    if (!gs || gs.money < price) return;
    if (hasRelicCapacity(gs.relics, MAX_ACTIVE_RELICS)) {
      setGs({ ...gs, money: gs.money - price, relics: [...gs.relics, r] });
      setRunProgress((p) => ({ ...p, shopPurchases: p.shopPurchases + 1 }));
    } else {
      setPendingRelicReplace({ incoming: r, context: "shop", price });
    }
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
    setRunProgress((p) => ({ ...p, shopPurchases: p.shopPurchases + 1 }));
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
    // "Si continuó o no en Endless" (docs/METAPROGRESSION_2E.md,
    // sección 2) — marca la última Coronación, nunca crea una nueva.
    const nextProfile = markLastCoronationEndless(profile);
    setProfile(nextProfile);
    saveProfile(nextProfile);
    setPendingLegacy(null);
    const { round, endless } = beginEndlessContinuation(gs.round);
    // Convierte el MISMO save al estado Endless (sección 9) — sigue
    // siendo la única clave de storage, nunca se crea un save nuevo.
    setGs(startRound({ ...gs, endless }, round, unlockedBossIds));
    setScreen("play");
  };

  /** Reclama un Legado tras una Coronación (docs/METAPROGRESSION_2E.md, sección 4). */
  const handleClaimLegacy = (legacyId: string) => {
    const nextProfile = claimLegacy(profile, legacyId);
    setProfile(nextProfile);
    saveProfile(nextProfile);
  };

  /** Reporta el paso del flujo de Coronación para el autosave (sección 8: "Legado pendiente" debe sobrevivir a un cierre). */
  const handleWinStepChange = (step: WinStep, claimedLegacyId: string | null) => {
    setPendingLegacy({ step, claimedLegacyId });
  };

  /** "Nueva run" desde la pantalla de Coronación: arranca de inmediato con una seed nueva, condiciones por defecto. */
  const handleNewRunFromWin = () => {
    newGame((Math.random() * 1e9) | 0, false);
  };

  /** Vuelve al menú tras una Coronación resuelta - fin de run real, se elimina el save (sección 8). */
  const handleMenuFromWin = () => {
    deleteRunSave();
    setRunSaveState({ status: "none" });
    setScreen("menu");
  };

  /**
   * Continuar una run guardada (sección 3-4). Restauración = hidratar
   * estado ya resuelto, NUNCA volver a ejecutar un handler de
   * transición (`handleWinRound`, `recordCoronation`, `claimLegacy`...)
   * — así ninguna recompensa/Coronación/Legado puede duplicarse al
   * restaurar (sección 5, idempotencia). Los streams de reward/shop se
   * re-siembran de forma determinista pero no continúan exactamente la
   * secuencia previa al cierre — ver runSave.ts y
   * docs/PERSISTENCE_2F.md.
   */
  const handleContinueRun = () => {
    if (runSaveState.status !== "valid") return;
    const { save } = runSaveState;
    setLastSeed(save.gameState.seed);
    rewardRng.current = makeRng(
      save.gameState.seed +
        555 +
        save.gameState.round * 31 +
        (save.pendingReward?.rerollCount ?? 0) * 7
    );
    shopRng.current = makeRng(
      save.gameState.seed +
        save.gameState.round * 31337 +
        (save.pendingShop?.rerollCount ?? 0) * 13
    );
    setRunProgress(save.runProgress);
    setPendingReward(save.pendingReward);
    setPendingShop(save.pendingShop);
    setPendingRelicReplace(save.pendingRelicReplace);
    setPendingLegacy(save.pendingLegacy);
    setParticles([]);
    setGs(save.gameState);
    setScreen(save.screen);
  };

  /** Save corrupto (sección 6): se elimina explícitamente, nunca se toca PlayerProfile. */
  const handleDeleteCorruptSave = () => {
    deleteRunSave();
    setRunSaveState({ status: "none" });
  };

  /** Aplica un perfil importado ya validado y confirmado por el jugador (sección 11). */
  const handleImportProfile = (imported: PlayerProfile) => {
    setProfile(imported);
    saveProfile(imported);
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
          <MenuScreen
            onStart={newGame}
            lastSeed={lastSeed}
            unlockedOathIds={unlockedOathIds}
            unlockedVariantIds={unlockedVariantIds}
            runSaveState={runSaveState}
            onContinue={handleContinueRun}
            onDeleteCorruptSave={handleDeleteCorruptSave}
            profile={profile}
            onImportProfile={handleImportProfile}
          />
        )}

        {screen === "play" && gs && (
          <PlayScreen
            gs={gs}
            setGs={setGs}
            spawnParticles={spawnParticles}
            onWinRound={handleWinRound}
            unlockedBossIds={unlockedBossIds}
            onDiscard={() =>
              setRunProgress((p) => ({ ...p, discardsUsed: p.discardsUsed + 1 }))
            }
            onRunEnding={() => {
              deleteRunSave();
              setRunSaveState({ status: "none" });
              suppressNextAutosaveRef.current = true;
            }}
            onDefeat={(g) => {
              // Derrota definitiva (sección 8): se elimina el save de
              // inmediato (redundante con onRunEnding, pero idempotente
              // y a prueba de que se llegue aquí por otra vía).
              deleteRunSave();
              setRunSaveState({ status: "none" });
              // Totales outcome-agnósticos (sección 10) — una derrota
              // también cuenta hands/discards/rerolls/banishes/compras
              // y puede batir mejores marcas, aunque no sea Coronación.
              const nextProfile = recordRunEnd(profile, {
                won: false,
                endless: g.endless,
                reachedRound: g.round,
                totalScore: g.stats.totalScore,
                bestHand: g.stats.bestHand,
                handsPlayed: g.stats.handsPlayed,
                discardsUsed: runProgress.discardsUsed,
                rerollsUsed: runProgress.rerollsUsed,
                shopPurchases: runProgress.shopPurchases,
                banishesUsed: g.banishedRelicIds.length,
              });
              setProfile(nextProfile);
              saveProfile(nextProfile);
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
            onRerollSpend={handleRewardRerollSpend}
            onBanish={handleBanish}
            initialOffers={pendingReward?.offers}
            initialRerollCount={pendingReward?.rerollCount}
            onOfferChange={(offers, rerollCount) =>
              setPendingReward({ offers, rerollCount })
            }
          />
        )}

        {screen === "money-reward" && gs && (
          <MoneyRewardScreen gs={gs} onContinue={handleMoneyRewardContinue} />
        )}

        {screen === "shop" && gs && (
          <ShopScreen
            gs={gs}
            rng={shopRng.current}
            onBuyRelic={handleBuyRelic}
            onApplySpecial={handleApplySpecial}
            onSellCard={handleSellCard}
            onContinue={handleContinueFromShop}
            onRerollSpend={handleShopRerollSpend}
            onBanish={handleBanish}
            initialStock={pendingShop?.stock}
            initialUsedSpecialKinds={pendingShop?.usedSpecialKinds}
            initialRerollCount={pendingShop?.rerollCount}
            onStockChange={(stock, usedSpecialKinds, rerollCount) =>
              setPendingShop({ stock, usedSpecialKinds, rerollCount })
            }
          />
        )}

        {screen === "defeat" && gs && (
          <DefeatScreen
            gs={gs}
            onMenu={() => setScreen("menu")}
            onRetry={() => newGame(gs.seed, gs.endless, gs.oathId)}
          />
        )}

        {screen === "win" && gs && (
          <WinScreen
            gs={gs}
            profile={profile}
            onClaimLegacy={handleClaimLegacy}
            onContinueEndless={handleContinueEndless}
            onNewRun={handleNewRunFromWin}
            onMenu={handleMenuFromWin}
            initialStep={pendingLegacy?.step}
            initialClaimedId={pendingLegacy?.claimedLegacyId}
            onStepChange={handleWinStepChange}
          />
        )}

        {pendingRelicReplace && gs && (
          <RelicReplaceModal
            incoming={pendingRelicReplace.incoming}
            current={gs.relics}
            onConfirm={handleConfirmRelicReplace}
            onCancel={handleCancelRelicReplace}
          />
        )}
      </div>

      {import.meta.env.DEV && (
        <DevProfilePanel
          profile={profile}
          onReset={() => {
            const p = defaultProfile();
            setProfile(p);
            saveProfile(p);
          }}
          onUnlockAll={() => {
            let p = profile;
            for (const legacy of LEGACY_POOL) {
              if (legacy.implemented) p = claimLegacy(p, legacy.id);
            }
            setProfile(p);
            saveProfile(p);
          }}
        />
      )}
    </div>
  );
}
