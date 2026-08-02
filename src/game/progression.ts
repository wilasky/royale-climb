/* ============================================================
   Flujo de progresión de una run — Iteración 2A (docs/GAME_AUDIT.md, P0-1).
   Funciones puras, sin estado React, para poder testear el flujo
   determinísticamente sin montar componentes.
   ============================================================ */
import {
  ROUNDS_PER_RUN,
  ROUNDS_PER_ANTE,
  SHOP_EVERY_N_ROUNDS,
  ROUND_TARGETS,
  ENDLESS_TARGET_GROWTH,
  MONEY_REWARD_BY_PHASE,
} from "./config";
import type { RewardPhase } from "./config";

/**
 * Objetivo de puntuación de una ronda — Iteración 2B
 * (docs/BALANCE_ITERATION_2B.md, sección 5). Rondas 1-9 salen de la tabla
 * explícita `ROUND_TARGETS`; más allá (Endless) continúa desde el objetivo
 * de la ronda 9 con crecimiento geométrico moderado.
 */
export function targetForRound(round: number): number {
  const explicit = ROUND_TARGETS[round];
  if (explicit !== undefined) return explicit;
  return Math.round(
    ROUND_TARGETS[ROUNDS_PER_RUN] *
      Math.pow(ENDLESS_TARGET_GROWTH, round - ROUNDS_PER_RUN)
  );
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

export type RoundReward =
  | { type: "victory" } // solo Nueva partida, exactamente en ROUNDS_PER_RUN
  | { type: "shop" } // múltiplos de ROUNDS_PER_ANTE (3, 6, 9, 12...)
  | { type: "relic" } // round % ROUNDS_PER_ANTE === 1 (1, 4, 7, 10...)
  | { type: "money"; amount: number }; // round % ROUNDS_PER_ANTE === 2 (2, 5, 8, 11...)

/**
 * Qué tipo de recompensa toca al ganar esta ronda — Iteración 2B
 * (docs/BALANCE_ITERATION_2B.md, sección 2). Sustituye a
 * `resolveAfterReward`/`RoundOutcome` de la 2A: aquella decidía qué pasaba
 * DESPUÉS de resolver una recompensa que siempre era de modificador; esta
 * decide DE ENTRADA qué tipo de recompensa mostrar, porque ahora una ronda
 * ofrece exactamente una de tres cosas (modificador, dinero o tienda), no
 * las 9 rondas por igual. La victoria se sigue decidiendo aquí, no al
 * salir de la tienda, para no forzar nunca la pantalla de victoria al
 * continuar desde una tienda intermedia.
 */
export function resolveRoundReward(round: number, endless: boolean): RoundReward {
  if (isNormalRunComplete(round, endless)) return { type: "victory" };
  if (isShopRound(round)) return { type: "shop" };
  const cyclePos = round % ROUNDS_PER_ANTE; // 0 ya cubierto arriba (isShopRound)
  if (cyclePos === 1) return { type: "relic" };
  return { type: "money", amount: MONEY_REWARD_BY_PHASE[phaseForRound(round)] };
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
