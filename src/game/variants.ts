/* ============================================================
   Variantes de inicio — Iteración 2E (docs/METAPROGRESSION_2E.md,
   sección 7). Una variante cambia CÓMO empieza una run (composición
   inicial, recurso inicial, riesgo/recompensa...) reutilizando
   sistemas ya existentes, sin arte nuevo ni mecánicas nuevas: `apply`
   solo transforma los valores iniciales de un `GameState` ya
   construido, antes de la primera `startRound`. No toca ninguna
   fórmula ni constante protegida (`config.ts` sigue intacto) — una
   run sin variante (`variantId: null`) es exactamente la run de
   siempre.

   Solo BOLSILLOS VACÍOS está implementada. Las otras 2 diseñadas
   quedan documentadas en docs/METAPROGRESSION_2E.md, sin código.
   ============================================================ */
import type { GameState } from "./types";

export interface StartVariantDefinition {
  id: string;
  name: string;
  description: string;
  /** Transforma el `GameState` base recién construido en `newGame`, antes de la primera ronda. Pura: no muta `base`. */
  apply: (base: GameState) => GameState;
}

export const VARIANT_EMPTY_POCKETS = "empty_pockets";

export const START_VARIANTS: Record<string, StartVariantDefinition> = {
  [VARIANT_EMPTY_POCKETS]: {
    id: VARIANT_EMPTY_POCKETS,
    name: "Bolsillos Vacíos",
    description:
      "Empiezas con 2$ en vez de 4$, pero con un descarte extra por ronda (4 en vez de 3).",
    apply: (base) => ({
      ...base,
      money: Math.max(0, base.money - 2),
      discardsPerRound: base.discardsPerRound + 1,
    }),
  },
};

export function getStartVariant(id: string | null): StartVariantDefinition | null {
  return id ? START_VARIANTS[id] ?? null : null;
}

/** Aplica la variante `id` a `base` si existe; si no, devuelve `base` sin tocar. Nunca lanza por un id desconocido. */
export function applyStartVariant(base: GameState, id: string | null): GameState {
  const variant = getStartVariant(id);
  return variant ? variant.apply(base) : base;
}
