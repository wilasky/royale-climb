/* ============================================================
   Sistema de bosses — Iteración 2D (docs/BOSS_DESIGN_2D.md).
   Cada boss vive como una `BossDefinition` declarativa en
   `BOSSES_BY_ANTE`; ninguna lógica de boss vive dispersa en App.tsx
   como bloques `if boss === ...`. El resto de este archivo es la
   maquinaria compartida (selección determinista, hooks, wrapper de
   puntuación) que hace que añadir un boss nuevo sea solo añadir una
   entrada más a `BOSSES_BY_ANTE`.
   ============================================================ */
import type { Card, GameState, ScoreBreakdown } from "./types";
import { scorePlay } from "./scoring";
import { makeRng } from "./rng";

/** Ante en el que puede aparecer un boss — solo 1, 2 o 3 (rondas 3/6/9). */
export type BossAnte = 1 | 2 | 3;

/**
 * Contexto disponible para los hooks de un boss al puntuar una mano.
 * `gs` es el estado ANTES de sumar el resultado de esta mano (igual que
 * recibe `scorePlay`) — para saber el total acumulado tras la mano hay
 * que sumar `gs.scoreThisRound + breakdown.total` explícitamente.
 */
export interface BossScoreContext {
  gs: GameState;
  isFirstHand: boolean;
  isLastHand: boolean;
  handName: string;
}

/**
 * Definición de un boss. Solo se abstraen los hooks que los tres bosses
 * implementados necesitan de verdad (ver docs/BOSS_DESIGN_2D.md, sección
 * "Hooks"): estado inicial, ajuste de puntuación y avance de estado tras
 * cada mano. `describeState` es opcional y solo alimenta la línea de
 * estado del panel de boss activo (sección 8 del encargo) — no afecta a
 * la puntuación.
 */
export interface BossDefinition {
  id: string;
  name: string;
  ante: BossAnte;
  /** Una línea, para el aviso/telegraph y el panel de boss activo. */
  shortDescription: string;
  /** Explicación algo más larga, para la pantalla de aviso. */
  description: string;
  /** Estado inicial al empezar la ronda de este boss. */
  initialState: () => Record<string, unknown>;
  /** Ajusta el desglose de puntuación de una mano. Puro: no muta `breakdown`. */
  modifyScore?: (
    breakdown: ScoreBreakdown,
    ctx: BossScoreContext,
    state: Record<string, unknown>
  ) => ScoreBreakdown;
  /** Calcula el nuevo estado del boss tras resolver una mano. Puro: no muta `state`. */
  afterHand?: (
    state: Record<string, unknown>,
    ctx: BossScoreContext,
    breakdown: ScoreBreakdown
  ) => Record<string, unknown>;
  /** Línea de estado legible para el jugador (p.ej. "Fase 2 activa"). */
  describeState?: (state: Record<string, unknown>, gs: GameState) => string;
}

/**
 * Ante 1 — El Espejo Inestable (docs/BOSS_DESIGN_2D.md, sección 2).
 * Repetir el mismo tipo de mano dos veces seguidas dentro de la ronda
 * penaliza el multiplicador de la repetición en ×0.75. Nunca llega a 0
 * ni desactiva ningún tipo de mano — solo empuja a variar.
 */
const UNSTABLE_MIRROR: BossDefinition = {
  id: "unstable_mirror",
  name: "El Espejo Inestable",
  ante: 1,
  shortDescription: "Repetir el mismo tipo de mano dos veces seguidas: ×0.75 Mult.",
  description:
    "Si juegas el mismo tipo de mano dos veces seguidas en esta ronda, la " +
    "segunda vez su multiplicador se reduce a ×0.75. Cambia de tipo de " +
    "mano (o acepta el descuento) para evitarlo.",
  initialState: () => ({ lastHandName: null as string | null }),
  modifyScore: (breakdown, _ctx, state) => {
    const lastHandName = state.lastHandName as string | null;
    if (lastHandName !== breakdown.handName) return breakdown;
    const mult = Math.round(breakdown.mult * 0.75 * 10) / 10;
    const total = Math.round(breakdown.chips * mult);
    return {
      ...breakdown,
      mult,
      total,
      lines: [
        ...breakdown.lines,
        `El Espejo Inestable: ×0.75 Mult (repites ${breakdown.handName})`,
      ],
    };
  },
  afterHand: (state, _ctx, breakdown) => ({
    ...state,
    lastHandName: breakdown.handName,
  }),
  describeState: (state) => {
    const lastHandName = state.lastHandName as string | null;
    return lastHandName
      ? `Última mano jugada: ${lastHandName}.`
      : "Todavía no has jugado ninguna mano esta ronda.";
  },
};

/**
 * Catálogo de bosses por ante. Un ante puede tener varios candidatos —
 * la selección determinista de arriba ya está preparada para eso,
 * aunque en esta iteración cada ante solo tenga uno implementado (los
 * otros quedan documentados en docs/BOSS_DESIGN_2D.md como candidatos
 * futuros, sin ninguna línea de código todavía).
 */
export const BOSSES_BY_ANTE: Record<BossAnte, BossDefinition[]> = {
  1: [UNSTABLE_MIRROR],
  2: [],
  3: [],
};

const ALL_BOSSES: Record<string, BossDefinition> = {};
for (const ante of [1, 2, 3] as BossAnte[]) {
  for (const boss of BOSSES_BY_ANTE[ante]) {
    ALL_BOSSES[boss.id] = boss;
  }
}

export function getBossById(id: string): BossDefinition | null {
  return ALL_BOSSES[id] ?? null;
}

/**
 * Selección determinista del boss de un ante. Misma seed + mismo ante
 * siempre devuelve el mismo boss (mismo `rng()`, mismo cálculo de
 * índice). Con un solo candidato por ante (estado actual), `rng()` se
 * sigue consumiendo igual pero el resultado es trivialmente el único
 * candidato — así que añadir un segundo candidato el día de mañana no
 * cambia el comportamiento de determinismo, solo dejaría de ser trivial.
 * Devuelve `null` si el ante no tiene ningún boss definido todavía.
 */
export function selectBossForAnte(seed: number, ante: BossAnte): BossDefinition | null {
  const candidates = BOSSES_BY_ANTE[ante] ?? [];
  if (candidates.length === 0) return null;
  const rng = makeRng(seed + ante * 97711);
  const index = Math.floor(rng() * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)];
}

/** Estado inicial del boss `bossId` (objeto vacío si no hay boss o no define uno). */
export function initBossState(bossId: string | null): Record<string, unknown> {
  if (!bossId) return {};
  const boss = getBossById(bossId);
  return boss?.initialState ? boss.initialState() : {};
}

/**
 * Envoltorio de `scorePlay` consciente del boss activo — Iteración 2D.
 * Usado tanto por la previsualización como por la ejecución real de una
 * mano (igual que exige docs/CHANGELOG_GAMEPLAY.md desde la 2A: preview
 * y puntuación real deben ser literalmente la misma llamada). Si no hay
 * boss activo o el boss no define `modifyScore`, el resultado es
 * exactamente el de `scorePlay` sin ningún cambio.
 */
export function scoreWithBoss(
  played: Card[],
  heldInHand: Card[],
  gs: GameState,
  isFirstHand: boolean,
  isLastHand: boolean
): ScoreBreakdown {
  const base = scorePlay(played, heldInHand, gs, isFirstHand, isLastHand);
  const boss = gs.activeBossId ? getBossById(gs.activeBossId) : null;
  if (!boss?.modifyScore) return base;
  const ctx: BossScoreContext = { gs, isFirstHand, isLastHand, handName: base.handName };
  return boss.modifyScore(base, ctx, gs.bossState);
}

/**
 * Nuevo `bossState` tras resolver una mano (llamar con el `breakdown` ya
 * pasado por `scoreWithBoss`). Si no hay boss activo o no define
 * `afterHand`, devuelve el `bossState` sin cambios (mismo objeto, sin
 * mutar ni clonar innecesariamente).
 */
export function advanceBossState(
  gs: GameState,
  breakdown: ScoreBreakdown,
  isFirstHand: boolean,
  isLastHand: boolean
): Record<string, unknown> {
  const boss = gs.activeBossId ? getBossById(gs.activeBossId) : null;
  if (!boss?.afterHand) return gs.bossState;
  const ctx: BossScoreContext = {
    gs,
    isFirstHand,
    isLastHand,
    handName: breakdown.handName,
  };
  return boss.afterHand(gs.bossState, ctx, breakdown);
}

/** Línea de estado del boss activo para el HUD, o `null` si no aplica. */
export function describeBossState(gs: GameState): string | null {
  if (!gs.activeBossId) return null;
  const boss = getBossById(gs.activeBossId);
  if (!boss?.describeState) return null;
  return boss.describeState(gs.bossState, gs);
}
