/* ============================================================
   Configuración de progresión — Iteración 2A (docs/GAME_AUDIT.md, P0-1/P0-2)
   y balance de la Iteración 2B (docs/BALANCE_ITERATION_2B.md).
   Toda constante de flujo/curva/rareza/economía vive aquí en vez de
   dispersa por los componentes. Cambiar el juego = cambiar estos
   números, no buscar por todo App.tsx.
   ============================================================ */
import type { Rarity } from "./types";

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
 * Curva de objetivo de puntuación — Iteración 2B (docs/BALANCE_ITERATION_2B.md,
 * sección 5). Sustituye la fórmula exponencial genérica de la 2A por una
 * tabla explícita ronda a ronda, calibrada contra el poder real de una
 * build con el nuevo tope de `MAX_ACTIVE_RELICS` y la economía ajustada
 * (ver docs/BALANCE_ITERATION_2B.md para el razonamiento por ronda).
 */
export const ROUND_TARGETS: Record<number, number> = {
  1: 180,
  2: 280,
  3: 450,
  4: 700,
  5: 1050,
  6: 1900,
  7: 3200,
  8: 5200,
  9: 8500,
};

/**
 * Endless (rondas 10+) continúa desde el objetivo de la ronda 9 con
 * crecimiento geométrico moderado, en vez de reutilizar la vieja fórmula
 * exponencial genérica. Ver `targetForRound` en progression.ts.
 */
export const ENDLESS_TARGET_GROWTH = 1.6;

/** Cuántas opciones se ofrecen en cada punto de elección. */
export const REWARD_OFFER_COUNT = 3;
export const SHOP_RELIC_COUNT = 2;
export const SHOP_SPECIAL_COUNT = 3;

/**
 * Tope de modificadores activos simultáneos — Iteración 2B
 * (docs/BALANCE_ITERATION_2B.md, sección 1). Con los espacios llenos,
 * obtener un modificador nuevo exige sustituir uno existente (elección
 * explícita del jugador, nunca automática) en vez de acumular sin límite.
 */
export const MAX_ACTIVE_RELICS = 6;

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

/**
 * Recompensa económica determinista por fase — Iteración 2B
 * (docs/BALANCE_ITERATION_2B.md, sección 3). Reutiliza el mismo
 * concepto de fase que las tablas de rareza (tope en fase 3, así que
 * Endless hereda el mismo importe que la segunda mitad de Nueva
 * partida sin necesitar un caso especial).
 */
export const MONEY_REWARD_BY_PHASE: Record<RewardPhase, number> = {
  1: 6,
  2: 9,
  3: 12,
};

/**
 * Economía — Iteración 2B (docs/BALANCE_ITERATION_2B.md, sección 4).
 * El cobro automático por ronda superada era el mayor contribuyente al
 * excedente de dinero observado en el playtest, independientemente de
 * cualquier modificador; se aprieta junto con el resto de la economía.
 */
export const ROUND_CLEAR_BASE = 2;
export const ROUND_CLEAR_HANDS_BONUS_CAP = 2;

/** Banca Privada (interest): 1$ por cada N$ tenidos, con tope por ronda. */
export const INTEREST_DIVISOR = 6;
export const INTEREST_CAP = 4;

/** Precio de un modificador en tienda según su rareza. */
export const RELIC_PRICE_BY_RARITY: Record<Rarity, number> = {
  common: 5,
  rare: 8,
  epic: 12,
  legendary: 18,
};

/**
 * Compensación fija por rechazar la recompensa de modificador ("Saltar").
 * Claramente inferior al valor de un buen modificador y no escala con la
 * rareza rechazada, para que "saltar y comprar" no se vuelva la estrategia
 * sistemáticamente correcta.
 */
export const DECLINE_RELIC_COMPENSATION = 3;

/**
 * Reroll de la recompensa gratuita de modificador — Iteración 2C
 * (docs/BUILD_AGENCY_ITERATION_2C.md, sección 3). Coste creciente por
 * intento; el índice se limita al último valor del array una vez
 * agotada la lista (así "tercero y siguientes" reutiliza el último
 * coste sin necesidad de un caso especial). Se reinicia en cada
 * recompensa nueva — el contador vive en el componente, no en `gs`.
 */
export const REWARD_REROLL_COSTS = [3, 5, 7];
export const REWARD_REROLL_MAX = 3;

/**
 * Reroll de inventario de tienda — Iteración 2C, sección 4. Mismo
 * patrón de coste creciente que el reroll de recompensa, con un
 * intento extra permitido (máx. 4) y el coste tope (7$) repitiéndose
 * a partir del tercero.
 */
export const SHOP_REROLL_COSTS = [3, 5, 7];
export const SHOP_REROLL_MAX = 4;

/**
 * Sesgo suave hacia la build actual al generar ofertas de modificador
 * — Iteración 2C, sección 5. `SYNERGY_MIN_AFFINITY` es el número de
 * piezas del mismo arquetipo que el jugador debe tener ya para que se
 * active el sesgo; `SYNERGY_BONUS` es el incremento multiplicativo de
 * peso (no de probabilidad directa) aplicado a los candidatos
 * relacionados con el arquetipo dominante. Se aplica sobre los pesos
 * de rareza existentes, nunca los sustituye (ver src/game/offers.ts):
 * un legendario relacionado en fase 1 sigue teniendo peso 0.
 */
export const SYNERGY_MIN_AFFINITY = 2;
export const SYNERGY_BONUS = 0.3;

/**
 * Destierro permanente de modificador — Iteración 2C, sección 7. El
 * primer destierro de la run es gratis; a partir del segundo cuesta
 * `BANISH_COSTS[1]`. Igual que los rerolls, el índice se limita al
 * último valor del array si se agotara la tabla.
 */
export const BANISH_MAX = 2;
export const BANISH_COSTS = [0, 5];
