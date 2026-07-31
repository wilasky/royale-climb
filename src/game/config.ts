/* ============================================================
   Configuración de progresión — Iteración 2A (docs/GAME_AUDIT.md, P0-1/P0-2).
   Toda constante de flujo/curva/rareza vive aquí en vez de dispersa
   por los componentes. Cambiar el juego = cambiar estos números,
   no buscar por todo App.tsx.
   ============================================================ */

/** Duración de una partida "Nueva partida" (no endless). */
export const ROUNDS_PER_RUN = 9;

/** Cuántas rondas forman un ante. */
export const ROUNDS_PER_ANTE = 3;

/** Cada cuántas rondas se abre la tienda (ambos modos). */
export const SHOP_EVERY_N_ROUNDS = 3;

/** Configuración inicial de una run (sin cambios respecto al original). */
export const STARTING_MONEY = 4;
export const HANDS_PER_ROUND = 4;
export const DISCARDS_PER_ROUND = 3;
export const HAND_SIZE = 8;

/**
 * Curva de objetivo de puntuación. SIN CAMBIOS respecto a la fórmula
 * original (`200 * 1.55^(ronda-1)`) — el audit no propuso una curva
 * alternativa concreta, así que la opción que menos modifica el
 * balance actual es mantener esta fórmula exacta y solo centralizarla.
 * Ver docs/CHANGELOG_GAMEPLAY.md para los valores exactos de las
 * rondas 1-9 (y algunas de referencia en modo Endless más allá de la 9).
 */
export const TARGET_BASE = 200;
export const TARGET_GROWTH = 1.55;

/** Cuántas opciones se ofrecen en cada punto de elección. */
export const REWARD_OFFER_COUNT = 3;
export const SHOP_RELIC_COUNT = 2;
export const SHOP_SPECIAL_COUNT = 3;

/**
 * Pesos de rareza por fase (fase = ante actual, con tope en 3 -
 * ver `phaseForRound` en progression.ts). Un peso de 0 excluye esa
 * rareza por completo en esa fase (así se garantiza, no solo se hace
 * improbable, que no haya legendarios en las primeras rondas - P0-2).
 */
export interface RarityWeights {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

export type RewardPhase = 1 | 2 | 3;

/** Pesos usados en la pantalla de recompensa (fin de ronda). */
export const REWARD_WEIGHTS: Record<RewardPhase, RarityWeights> = {
  1: { common: 70, rare: 25, epic: 5, legendary: 0 },
  2: { common: 45, rare: 35, epic: 16, legendary: 4 },
  3: { common: 30, rare: 32, epic: 25, legendary: 13 },
};

/**
 * Pesos usados en la tienda. Distintos de los de recompensa (la
 * tienda cuesta dinero, así que se permite algo más de generosidad
 * en rarezas altas) pero reutilizan el mismo selector (`pickRelics`).
 */
export const SHOP_WEIGHTS: Record<RewardPhase, RarityWeights> = {
  1: { common: 55, rare: 35, epic: 10, legendary: 0 },
  2: { common: 35, rare: 35, epic: 22, legendary: 8 },
  3: { common: 22, rare: 30, epic: 28, legendary: 20 },
};
