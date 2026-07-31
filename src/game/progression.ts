/* ============================================================
   Flujo de progresión de una run — Iteración 2A (docs/GAME_AUDIT.md, P0-1).
   Funciones puras, sin estado React, para poder testear el flujo
   determinísticamente sin montar componentes.
   ============================================================ */
import {
  ROUNDS_PER_RUN,
  ROUNDS_PER_ANTE,
  SHOP_EVERY_N_ROUNDS,
  TARGET_BASE,
  TARGET_GROWTH,
} from "./config";
import type { RewardPhase } from "./config";

/** Objetivo de puntuación de una ronda. Fórmula sin cambios (ver config.ts). */
export function targetForRound(round: number): number {
  return Math.round(TARGET_BASE * Math.pow(TARGET_GROWTH, round - 1));
}

/** Ante al que pertenece una ronda (3 rondas por ante, sin tope). */
export function anteOfRound(round: number): number {
  return Math.ceil(round / ROUNDS_PER_ANTE);
}

/** Si una ronda abre tienda al superarla (igual en ambos modos). */
export function isShopRound(round: number): boolean {
  return round % SHOP_EVERY_N_ROUNDS === 0;
}

/**
 * Fase de rareza de una ronda, con tope en 3 (ante 3 en adelante,
 * incluido todo el Endless más allá de la ronda 9, usa la fase 3).
 */
export function phaseForRound(round: number): RewardPhase {
  const ante = anteOfRound(round);
  if (ante <= 1) return 1;
  if (ante === 2) return 2;
  return 3;
}

/** Si una run "Nueva partida" (no endless) ha llegado a su ronda final. */
export function isNormalRunComplete(round: number, endless: boolean): boolean {
  return !endless && round === ROUNDS_PER_RUN;
}

export type RoundOutcome =
  | { type: "victory" } // solo Nueva partida, exactamente en ROUNDS_PER_RUN
  | { type: "shop" } // ronda de tienda (ambos modos)
  | { type: "next-round" }; // continuar directo a la siguiente ronda

/**
 * Qué ocurre después de resolver la recompensa de una ronda.
 * Sustituye a la lógica anterior (P0-1): la victoria se decide AQUÍ,
 * no al salir de la tienda - así no hay rama muerta ni tienda forzada
 * a terminar siempre en pantalla de victoria.
 */
export function resolveAfterReward(round: number, endless: boolean): RoundOutcome {
  if (isNormalRunComplete(round, endless)) return { type: "victory" };
  if (isShopRound(round)) return { type: "shop" };
  return { type: "next-round" };
}

/** Tras la tienda, ambos modos continúan siempre a la siguiente ronda. */
export function resolveAfterShop(round: number): { nextRound: number } {
  return { nextRound: round + 1 };
}

/**
 * Al pulsar "Continuar en Endless" desde la pantalla de victoria:
 * activa el modo endless y arranca en la ronda siguiente (10, ya que
 * la victoria solo ocurre exactamente en ROUNDS_PER_RUN).
 */
export function beginEndlessContinuation(
  fromRound: number
): { round: number; endless: true } {
  return { round: fromRound + 1, endless: true };
}
