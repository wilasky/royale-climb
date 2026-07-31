/* ============================================================
   Tipos de dominio del motor de juego. Movidos aquí desde App.tsx
   para que src/game/* pueda usarlos sin depender de un componente
   React (ver docs/CHANGELOG_GAMEPLAY.md, iteración 2A).
   ============================================================ */

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Screen = "menu" | "play" | "reward" | "shop" | "defeat" | "win";

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
}

export interface ScoreBreakdown {
  handName: string;
  chips: number;
  mult: number;
  total: number;
  lines: string[];
}
