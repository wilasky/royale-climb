/* ============================================================
   Tipos de dominio del motor de juego. Movidos aquí desde App.tsx
   para que src/game/* pueda usarlos sin depender de un componente
   React (ver docs/CHANGELOG_GAMEPLAY.md, iteración 2A).
   ============================================================ */

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Screen =
  | "menu"
  | "play"
  | "reward"
  | "money-reward"
  | "shop"
  | "defeat"
  | "win";

export interface Card {
  id: string;
  suit: Suit;
  rank: number; // 2..14 (11=J,12=Q,13=K,14=A)
  bonusChips: number;
  glass: boolean;
  steel: boolean;
  gold: boolean;
}

export interface Relic {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: string;
}

export interface HandResult {
  name: string;
  baseChips: number;
  baseMult: number;
}

export type SpecialCardKind = "glass" | "steel" | "gold" | "bonus" | "suitconv";
export interface ShopSpecial {
  kind: SpecialCardKind;
  name: string;
  desc: string;
  price: number;
  rarity: Rarity;
  icon: string;
}

export interface GameState {
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
  /**
   * Modificadores desterrados permanentemente de las ofertas de esta run
   * — Iteración 2C, sección 7. Persiste entre recompensas y tiendas (es
   * parte de `GameState`, así que sobrevive a `startRound`/Endless sin
   * lógica extra); una partida nueva siempre empieza con la lista vacía.
   */
  banishedRelicIds: string[];
  /**
   * Boss activo de la ronda actual — Iteración 2D
   * (docs/BOSS_DESIGN_2D.md). `null` en rondas normales. Se recalcula en
   * cada `startRound`: solo existe durante la ronda de boss en la que fue
   * seleccionado, nunca persiste a la ronda siguiente.
   */
  activeBossId: string | null;
  /**
   * Estado interno del boss activo (p.ej. tipo de la última mano jugada,
   * fase actual). Bolsa de datos pequeña y serializable, propia de cada
   * `BossDefinition`; vacía cuando no hay boss activo.
   */
  bossState: Record<string, unknown>;
  /**
   * Juramento elegido antes de empezar esta run — Iteración 2E
   * (docs/METAPROGRESSION_2E.md). `null` en una run normal. Se fija una
   * vez en `newGame` y no cambia durante la run; los propios Juramentos
   * consultan este id donde haga falta (p.ej. ocultar el telegraph de
   * boss) en vez de dispersar banderas nuevas por `GameState`.
   */
  oathId: string | null;
}

export interface ScoreBreakdown {
  handName: string;
  chips: number;
  mult: number;
  total: number;
  lines: string[];
}
