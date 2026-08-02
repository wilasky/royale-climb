/* ============================================================
   Metadata de arquetipos de build — Iteración 2C
   (docs/BUILD_AGENCY_ITERATION_2C.md, sección 1). Clasificación
   puramente declarativa de los 24 modificadores existentes: no
   cambia ningún comportamiento de juego, solo etiqueta cada
   modificador con la(s) identidad(es) de build a la que pertenece.
   ============================================================ */

/**
 * Categorías de build. Los nombres siguen la nomenclatura del encargo;
 * GENERAL agrupa efectos universales que no definen una identidad de
 * build concreta (ver `dominantArchetypes` en buildIdentity.ts, que
 * excluye explícitamente GENERAL como arquetipo dominante).
 */
export type Archetype =
  | "PAIR"
  | "STRAIGHT"
  | "FLUSH"
  | "LOW_CARDS"
  | "HIGH_CARDS"
  | "SMALL_HAND"
  | "FIRST_HAND"
  | "LAST_HAND"
  | "NO_DISCARD"
  | "ECONOMY"
  | "CARD_ENHANCEMENT"
  | "GENERAL";

/** Orden fijo — se usa para desempatar de forma determinista al ordenar afinidades. */
export const ARCHETYPES: Archetype[] = [
  "PAIR",
  "STRAIGHT",
  "FLUSH",
  "LOW_CARDS",
  "HIGH_CARDS",
  "SMALL_HAND",
  "FIRST_HAND",
  "LAST_HAND",
  "NO_DISCARD",
  "ECONOMY",
  "CARD_ENHANCEMENT",
  "GENERAL",
];

/**
 * Rol funcional de la pieza dentro de una build:
 * - starter: entrada barata y directa a un arquetipo (comunes de mano).
 * - enabler: apoya el arquetipo sin ser el pago final (bonus por palo).
 * - payoff: recompensa grande condicionada a la mano/situación objetivo.
 * - utility: efecto útil puntual, no define identidad por sí solo.
 * - generalist: funciona igual de bien en cualquier build.
 */
export type RelicRole = "starter" | "enabler" | "payoff" | "utility" | "generalist";

export interface RelicArchetypeInfo {
  primary: Archetype;
  secondary: Archetype[];
  role: RelicRole;
}

/**
 * Tabla completa de los 24 modificadores (`RELIC_POOL` en App.tsx).
 * Ver docs/BUILD_AGENCY_ITERATION_2C.md para la justificación de cada
 * fila, incluidas las dos decisiones de encaje forzado documentadas
 * ahí: Espectro (spectrum_boost) se trata como FLUSH por ser
 * "concentración de color", y Equilibrio Par (even_odd) no encaja en
 * ningún arquetipo de la lista pedida (depende de paridad de rango,
 * no de un arquetipo de mano) así que queda en GENERAL.
 */
export const RELIC_ARCHETYPES: Record<string, RelicArchetypeInfo> = {
  pair_mult: { primary: "PAIR", secondary: [], role: "starter" },
  flush_chips: { primary: "FLUSH", secondary: [], role: "starter" },
  straight_mult: { primary: "STRAIGHT", secondary: [], role: "starter" },
  spades_chip: { primary: "FLUSH", secondary: [], role: "enabler" },
  hearts_mult: { primary: "FLUSH", secondary: [], role: "enabler" },
  diamonds_money: { primary: "ECONOMY", secondary: ["FLUSH"], role: "enabler" },
  clubs_chip: { primary: "FLUSH", secondary: [], role: "enabler" },
  first_hand_mult: { primary: "FIRST_HAND", secondary: [], role: "payoff" },
  low_card_chip: { primary: "LOW_CARDS", secondary: [], role: "payoff" },
  face_mult: { primary: "HIGH_CARDS", secondary: [], role: "payoff" },
  discard_refund: { primary: "ECONOMY", secondary: ["NO_DISCARD"], role: "utility" },
  no_discard_mult: { primary: "NO_DISCARD", secondary: [], role: "payoff" },
  ace_chip: { primary: "HIGH_CARDS", secondary: [], role: "payoff" },
  pair_chain: { primary: "PAIR", secondary: [], role: "payoff" },
  scaling_round: { primary: "GENERAL", secondary: [], role: "generalist" },
  interest: { primary: "ECONOMY", secondary: [], role: "payoff" },
  glass_master: { primary: "CARD_ENHANCEMENT", secondary: [], role: "payoff" },
  small_hand: { primary: "SMALL_HAND", secondary: [], role: "payoff" },
  spectrum_boost: { primary: "FLUSH", secondary: [], role: "payoff" },
  even_odd: { primary: "GENERAL", secondary: [], role: "payoff" },
  blood_pact: { primary: "GENERAL", secondary: [], role: "generalist" },
  overflow: { primary: "ECONOMY", secondary: [], role: "utility" },
  the_collector: { primary: "GENERAL", secondary: [], role: "generalist" },
  final_hand: { primary: "LAST_HAND", secondary: [], role: "payoff" },
};

/** Arquetipos (primario + secundarios) de un modificador por id. Vacío si no está catalogado. */
export function archetypesOfRelic(relicId: string): Archetype[] {
  const info = RELIC_ARCHETYPES[relicId];
  if (!info) return [];
  return [info.primary, ...info.secondary];
}

/** Si un modificador pertenece (como primario o secundario) a un arquetipo dado. */
export function relicMatchesArchetype(relicId: string, archetype: Archetype): boolean {
  return archetypesOfRelic(relicId).includes(archetype);
}
