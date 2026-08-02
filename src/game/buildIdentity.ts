/* ============================================================
   Identidad de build — Iteración 2C (docs/BUILD_AGENCY_ITERATION_2C.md,
   sección 2). Funciones puras que analizan los modificadores activos
   del jugador y devuelven arquetipos representados, intensidad de cada
   uno y el arquetipo dominante. Sin estado de React, sin efectos.
   ============================================================ */
import type { Relic } from "./types";
import { ARCHETYPES, archetypesOfRelic } from "./archetypes";
import type { Archetype } from "./archetypes";

export type AffinityStrength = "none" | "weak" | "moderate" | "strong";

export interface ArchetypeAffinity {
  archetype: Archetype;
  count: number;
  strength: AffinityStrength;
}

export interface BuildIdentity {
  /** Solo arquetipos con al menos 1 pieza, ordenados por número de piezas descendente. */
  affinities: ArchetypeAffinity[];
  /** Arquetipo con más piezas, excluyendo GENERAL. null si no hay ninguno. */
  dominant: Archetype | null;
}

/**
 * 0 piezas = sin afinidad, 1 = débil, 2 = afinidad, 3+ = build claramente
 * orientada. Escala deliberadamente simple (ver encargo, sección 2).
 */
export function affinityStrength(count: number): AffinityStrength {
  if (count <= 0) return "none";
  if (count === 1) return "weak";
  if (count === 2) return "moderate";
  return "strong";
}

/**
 * Cuenta piezas por arquetipo. Un modificador con arquetipos secundarios
 * suma una pieza a cada arquetipo que toca (primario y secundarios por
 * igual) — un modificador multi-arquetipo puede reforzar más de una build
 * a la vez, mientras exista una razón real (ver Veta Dorada: ECONOMY +
 * FLUSH secundario).
 */
export function computeArchetypeCounts(relics: Relic[]): Partial<Record<Archetype, number>> {
  const counts: Partial<Record<Archetype, number>> = {};
  for (const relic of relics) {
    for (const archetype of archetypesOfRelic(relic.id)) {
      counts[archetype] = (counts[archetype] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Analiza los modificadores activos y devuelve arquetipos representados,
 * número de piezas de cada uno y el arquetipo dominante. GENERAL nunca
 * puede ser el arquetipo dominante, aunque tenga más piezas que el resto
 * — por diseño no define una identidad de build (ver encargo, "GENERAL
 * no debe dominar una build").
 */
export function computeBuildIdentity(relics: Relic[]): BuildIdentity {
  const counts = computeArchetypeCounts(relics);
  const affinities: ArchetypeAffinity[] = ARCHETYPES.filter(
    (archetype) => (counts[archetype] ?? 0) > 0
  ).map((archetype) => {
    const count = counts[archetype]!;
    return { archetype, count, strength: affinityStrength(count) };
  });
  // Orden estable: ARCHETYPES ya está en un orden fijo, así que un sort
  // estable por -count desempata siempre igual para las mismas piezas.
  affinities.sort((a, b) => b.count - a.count);

  const dominant =
    affinities.find((a) => a.archetype !== "GENERAL" && a.count > 0)?.archetype ?? null;

  return { affinities, dominant };
}

/**
 * Arquetipos con afinidad "suficiente" (por defecto, `moderate` o más:
 * 2+ piezas), excluyendo GENERAL, hasta un máximo. Pensado para:
 * - selección de ofertas (synergy bias, sección 5 del encargo);
 * - la etiqueta discreta de build en el HUD (sección 8).
 */
export function dominantArchetypes(
  relics: Relic[],
  minCount = 2,
  max = 2
): Archetype[] {
  const { affinities } = computeBuildIdentity(relics);
  return affinities
    .filter((a) => a.archetype !== "GENERAL" && a.count >= minCount)
    .slice(0, max)
    .map((a) => a.archetype);
}
