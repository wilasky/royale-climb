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
 *
 * `preBossBreakdown` — Iteración 2F, limpieza técnica documentada en
 * la 2E (docs/METAPROGRESSION_2E.md, sección "Eco del Trono"): el
 * resultado de `scorePlay` ANTES de que `modifyScore` de ningún boss
 * lo toque. Existe para que un boss que necesite "el valor original
 * de esta mano" (p.ej. El Eco del Trono, que fija su eco a partir del
 * Mult de la primera mano) lo lea directamente en vez de tener que
 * deshacer matemáticamente su propia transformación — antes de este
 * cambio, `THRONES_ECHO.afterHand` calculaba `breakdown.mult / 0.7`
 * para reconstruirlo, una operación frágil que dejaba de tener
 * sentido en cuanto la fórmula de `modifyScore` cambiara. El
 * resultado numérico no cambia: `preBossBreakdown` es exactamente el
 * mismo objeto que ya se calculaba internamente, solo que ahora se
 * expone en vez de descartarse.
 */
export interface BossScoreContext {
  gs: GameState;
  isFirstHand: boolean;
  isLastHand: boolean;
  handName: string;
  preBossBreakdown: ScoreBreakdown;
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
  /**
   * Si es true, este boss requiere un desbloqueo de perfil (Legado de
   * la Corona, ver docs/METAPROGRESSION_2E.md) antes de poder salir
   * seleccionado — `selectBossForAnte` lo excluye de los candidatos
   * salvo que su id esté en `unlockedBossIds`. Los bosses de la
   * Iteración 2D no lo requieren (`locked: false`).
   */
  locked: boolean;
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
  locked: false,
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
 * Ante 2 — El Contable Implacable (docs/BOSS_DESIGN_2D.md, sección 2).
 * Cada mano debe superar en puntuación total a la mano anterior de la
 * ronda; si no lo consigue, sus fichas se reducen a la mitad antes de
 * multiplicar (el multiplicador no se toca). La primera mano de la
 * ronda nunca se penaliza. Presiona el ORDEN en el que se juegan las
 * manos, no qué tipo de mano se juega.
 */
const THE_ACCOUNTANT: BossDefinition = {
  id: "the_accountant",
  name: "El Contable Implacable",
  ante: 2,
  locked: false,
  shortDescription:
    "Cada mano debe superar en puntos a la anterior o sus fichas se reducen a la mitad.",
  description:
    "El Contable solo acepta cifras crecientes: si una mano no supera en " +
    "puntuación total a la mano anterior de esta ronda, sus fichas se " +
    "reducen a la mitad antes de multiplicar. Reserva tus mejores combos " +
    "para el final.",
  initialState: () => ({ previousTotal: null as number | null }),
  modifyScore: (breakdown, _ctx, state) => {
    const previousTotal = state.previousTotal as number | null;
    if (previousTotal === null || breakdown.total > previousTotal) {
      return breakdown;
    }
    const chips = Math.round(breakdown.chips * 0.5);
    const total = Math.round(chips * breakdown.mult);
    return {
      ...breakdown,
      chips,
      total,
      lines: [
        ...breakdown.lines,
        `El Contable Implacable: fichas a la mitad (no superaste ${previousTotal} puntos)`,
      ],
    };
  },
  afterHand: (state, _ctx, breakdown) => ({
    ...state,
    previousTotal: breakdown.total,
  }),
  describeState: (state) => {
    const previousTotal = state.previousTotal as number | null;
    return previousTotal === null
      ? "Primera mano: todavía no hay listón que superar."
      : `Debes superar: ${previousTotal.toLocaleString()} puntos.`;
  },
};

/**
 * Ante 3 (final) — El Trono Partido (docs/BOSS_DESIGN_2D.md, sección 2).
 * Boss de dos fases: hasta cruzar el 50% del objetivo, reglas normales
 * (Fase 1). La mano que hace cruzar ese umbral puntúa todavía con las
 * reglas de Fase 1 (sin penalización retroactiva); a partir de la
 * siguiente mano, cada una suma +40 fichas planas pero su multiplicador
 * se reduce a ×0.7 (Fase 2) durante el resto de la ronda.
 */
const SPLIT_THRONE: BossDefinition = {
  id: "split_throne",
  name: "El Trono Partido",
  ante: 3,
  locked: false,
  shortDescription:
    "Al superar el 50% del objetivo: +40 fichas pero ×0.7 Mult el resto de la ronda.",
  description:
    "El trono se parte en dos en cuanto demuestras que mereces la corona. " +
    "Hasta la mitad del objetivo, reglas normales. Al cruzarla, cada mano " +
    "posterior suma +40 fichas planas pero su multiplicador baja a ×0.7 " +
    "durante el resto de la ronda.",
  initialState: () => ({ phase: 1 as 1 | 2 }),
  modifyScore: (breakdown, _ctx, state) => {
    const phase = state.phase as 1 | 2;
    if (phase !== 2) return breakdown;
    const chips = breakdown.chips + 40;
    const mult = Math.round(breakdown.mult * 0.7 * 10) / 10;
    const total = Math.round(chips * mult);
    return {
      ...breakdown,
      chips,
      mult,
      total,
      lines: [...breakdown.lines, "El Trono Partido (Fase 2): +40 fichas, ×0.7 Mult"],
    };
  },
  afterHand: (state, ctx, breakdown) => {
    const phase = state.phase as 1 | 2;
    if (phase === 2) return state;
    const cumulative = ctx.gs.scoreThisRound + breakdown.total;
    if (cumulative >= ctx.gs.target / 2) {
      return { ...state, phase: 2 as 1 | 2 };
    }
    return state;
  },
  describeState: (state) => {
    const phase = state.phase as 1 | 2;
    return phase === 1
      ? "Fase 1: reglas normales."
      : "Fase 2 activa: +40 fichas, ×0.7 Mult por mano.";
  },
};

/**
 * Ante 2 — El Eco del Trono (docs/BOSS_DESIGN_2D.md, candidato B
 * aplazado; desbloqueado como Legado de la Corona "Eco Prohibido" en
 * la Iteración 2E, ver docs/METAPROGRESSION_2E.md). Segundo candidato
 * posible para el boss de Ante 2, junto a El Contable Implacable —
 * `locked: true` hasta que el perfil tenga el Legado reclamado.
 *
 * La primera mano de la ronda puntúa con su multiplicador reducido a
 * ×0.7 (se "sacrifica" para fijar el eco); a partir de ahí, cada mano
 * posterior recibe un bonus aditivo de multiplicador igual al 20% del
 * multiplicador *base* de esa primera mano (antes del ×0.7 — se
 * reconstruye dividiendo entre 0.7, ya que `modifyScore` solo puede
 * devolver el desglose ya modificado). Premia abrir fuerte en vez de
 * cerrar fuerte, lo opuesto en espíritu a El Contable Implacable.
 */
const THRONES_ECHO: BossDefinition = {
  id: "thrones_echo",
  name: "El Eco del Trono",
  ante: 2,
  locked: true,
  shortDescription:
    "Tu 1ª mano puntúa a ×0.7 Mult, pero fija un eco: el resto de manos ganan Mult extra.",
  description:
    "El trono repite un eco de tu primera decisión durante el resto del " +
    "combate. Tu primera mano de la ronda se sacrifica a ×0.7 Mult para " +
    "fijar el eco; a partir de ahí, cada mano posterior recibe un bonus " +
    "aditivo de Mult basado en la fuerza de esa primera mano.",
  initialState: () => ({ echoBonus: 0 as number }),
  modifyScore: (breakdown, ctx, state) => {
    if (ctx.isFirstHand) {
      const mult = Math.round(breakdown.mult * 0.7 * 10) / 10;
      const total = Math.round(breakdown.chips * mult);
      return {
        ...breakdown,
        mult,
        total,
        lines: [...breakdown.lines, "El Eco del Trono: ×0.7 Mult (fija el eco)"],
      };
    }
    const echoBonus = state.echoBonus as number;
    if (echoBonus <= 0) return breakdown;
    const mult = Math.round((breakdown.mult + echoBonus) * 10) / 10;
    const total = Math.round(breakdown.chips * mult);
    return {
      ...breakdown,
      mult,
      total,
      lines: [...breakdown.lines, `El Eco del Trono: +${echoBonus} Mult (eco)`],
    };
  },
  afterHand: (state, ctx) => {
    if (!ctx.isFirstHand) return state;
    // Iteración 2F: se lee el Mult original directamente de
    // `preBossBreakdown` en vez de reconstruirlo dividiendo entre 0.7
    // — ver el comentario de `BossScoreContext` en la cabecera de este
    // archivo. Mismo resultado numérico que antes, sin la división.
    const baseMult = ctx.preBossBreakdown.mult;
    const echoBonus = Math.round(baseMult * 0.2 * 10) / 10;
    return { ...state, echoBonus };
  },
  describeState: (state) => {
    const echoBonus = state.echoBonus as number;
    return echoBonus > 0
      ? `Eco fijado: +${echoBonus} Mult en cada mano restante.`
      : "Primera mano todavía sin jugar (fija el eco a ×0.7 Mult).";
  },
};

/**
 * Catálogo de bosses por ante. Un ante puede tener varios candidatos —
 * la selección determinista de abajo ya está preparada para eso.
 * Ante 2 ya tiene dos: El Contable Implacable (siempre disponible) y
 * El Eco del Trono (`locked: true`, requiere el Legado "Eco Prohibido").
 * Ante 1 y Ante 3 (final) siguen con un único candidato — los otros
 * cuatro conceptos aplazados quedan documentados en
 * docs/BOSS_DESIGN_2D.md, sin ninguna línea de código todavía.
 */
export const BOSSES_BY_ANTE: Record<BossAnte, BossDefinition[]> = {
  1: [UNSTABLE_MIRROR],
  2: [THE_ACCOUNTANT, THRONES_ECHO],
  3: [SPLIT_THRONE],
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
 * + mismo conjunto de bosses desbloqueados ⇒ siempre el mismo boss
 * (mismo `rng()`, mismo cálculo de índice sobre la misma lista de
 * candidatos). `unlockedBossIds` (por defecto vacío) filtra los
 * candidatos con `locked: true` cuyo id no esté en el conjunto — así
 * un boss desbloqueable (Iteración 2E, docs/METAPROGRESSION_2E.md)
 * nunca puede salir seleccionado antes de que el perfil lo desbloquee,
 * y una vez desbloqueado entra a competir con total naturalidad junto
 * a los candidatos ya disponibles del mismo ante. Devuelve `null` si
 * el ante no tiene ningún candidato disponible (ninguno definido, o
 * los únicos que hay siguen bloqueados).
 */
export function selectBossForAnte(
  seed: number,
  ante: BossAnte,
  unlockedBossIds: ReadonlySet<string> = new Set()
): BossDefinition | null {
  const candidates = (BOSSES_BY_ANTE[ante] ?? []).filter(
    (b) => !b.locked || unlockedBossIds.has(b.id)
  );
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
  const ctx: BossScoreContext = {
    gs,
    isFirstHand,
    isLastHand,
    handName: base.handName,
    preBossBreakdown: base,
  };
  return boss.modifyScore(base, ctx, gs.bossState);
}

/**
 * Nuevo `bossState` tras resolver una mano (llamar con el `breakdown` ya
 * pasado por `scoreWithBoss`, y con los MISMOS `played`/`heldInHand` que
 * se le pasaron a `scoreWithBoss` para esa mano). Si no hay boss activo o
 * no define `afterHand`, devuelve el `bossState` sin cambios (mismo
 * objeto, sin mutar ni clonar innecesariamente).
 *
 * Recalcula `scorePlay` (puro, sin RNG, sin efectos) para reconstruir
 * `preBossBreakdown` — Iteración 2F: es un recálculo barato (unas pocas
 * cartas) que evita que `scoreWithBoss` tenga que cambiar su forma de
 * retorno solo para transportar el desglose previo hasta aquí.
 */
export function advanceBossState(
  gs: GameState,
  played: Card[],
  heldInHand: Card[],
  breakdown: ScoreBreakdown,
  isFirstHand: boolean,
  isLastHand: boolean
): Record<string, unknown> {
  const boss = gs.activeBossId ? getBossById(gs.activeBossId) : null;
  if (!boss?.afterHand) return gs.bossState;
  const preBossBreakdown = scorePlay(played, heldInHand, gs, isFirstHand, isLastHand);
  const ctx: BossScoreContext = {
    gs,
    isFirstHand,
    isLastHand,
    handName: breakdown.handName,
    preBossBreakdown,
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
