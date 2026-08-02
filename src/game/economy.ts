/* ============================================================
   Economía de una run — Iteración 2B (docs/BALANCE_ITERATION_2B.md,
   sección 4). Funciones puras: no leen ni escriben estado de React.
   ============================================================ */
import type { Rarity } from "./types";
import {
  ROUND_CLEAR_BASE,
  ROUND_CLEAR_HANDS_BONUS_CAP,
  INTEREST_DIVISOR,
  INTEREST_CAP,
  RELIC_PRICE_BY_RARITY,
} from "./config";

/** Dinero base al superar una ronda, antes de bonus de modificadores. */
export function roundClearBaseReward(handsLeft: number): number {
  return ROUND_CLEAR_BASE + Math.min(handsLeft, ROUND_CLEAR_HANDS_BONUS_CAP);
}

/** Interés de Banca Privada: +1$ por cada `INTEREST_DIVISOR`$, con tope. */
export function computeInterest(money: number): number {
  return Math.min(INTEREST_CAP, Math.floor(money / INTEREST_DIVISOR));
}

/** Precio de tienda de un modificador según su rareza. */
export function relicPrice(rarity: Rarity): number {
  return RELIC_PRICE_BY_RARITY[rarity];
}
