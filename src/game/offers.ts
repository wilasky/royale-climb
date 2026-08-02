/* ============================================================
   Generación de ofertas de modificador con sesgo de sinergia —
   Iteración 2C (docs/BUILD_AGENCY_ITERATION_2C.md, secciones 5 y 6).
   Combina el muestreo ponderado por rareza de la 2A con un sesgo
   suave hacia el arquetipo dominante del jugador, y un best-effort
   (nunca una garantía) para que la oferta contenga tanto una opción
   relacionada con la build como una opción para pivotar.
   ============================================================ */
import type { Relic } from "./types";
import type { RarityWeights } from "./config";
import type { Rng } from "./rng";
import { pickRelics, pickRelicsAvoidingRepeat } from "./rewards";
import { computeBuildIdentity } from "./buildIdentity";
import { relicMatchesArchetype } from "./archetypes";
import type { Archetype } from "./archetypes";
import { SYNERGY_MIN_AFFINITY, SYNERGY_BONUS } from "./config";

function buildSynergyMultiplier(
  pool: Relic[],
  excludeIds: ReadonlySet<string>,
  currentRelics: Relic[]
): { multiplier: ((r: Relic) => number) | undefined; dominant: Archetype | null } {
  const identity = computeBuildIdentity(currentRelics);
  const dominant =
    identity.affinities.find(
      (a) => a.archetype !== "GENERAL" && a.count >= SYNERGY_MIN_AFFINITY
    )?.archetype ?? null;

  if (!dominant) return { multiplier: undefined, dominant: null };

  const relatedIds = new Set(
    pool
      .filter((r) => !excludeIds.has(r.id) && relicMatchesArchetype(r.id, dominant))
      .map((r) => r.id)
  );
  if (relatedIds.size === 0) return { multiplier: undefined, dominant };

  return {
    multiplier: (r: Relic) => (relatedIds.has(r.id) ? 1 + SYNERGY_BONUS : 1),
    dominant,
  };
}

/**
 * Genera una oferta de `count` modificadores aplicando, en este orden
 * (sección 5 del encargo):
 * 1. Restricciones de rareza (`weights`, sin cambios respecto a la 2A).
 * 2. Exclusión de modificadores poseídos y desterrados (`excludeIds`).
 * 3. Cálculo de afinidades actuales del jugador (`currentRelics`).
 * 4. Bonus moderado de peso a candidatos relacionados con el arquetipo
 *    dominante (solo si el jugador ya tiene `SYNERGY_MIN_AFFINITY`
 *    piezas de ese arquetipo — nunca garantiza que aparezcan).
 * 5. Selección final mediante `rng` determinista.
 *
 * Tras generar la oferta, intenta (sin garantizarlo — sección 6) que
 * contenga al menos un candidato relacionado con la build dominante Y
 * al menos una opción distinta para poder pivotar. Si el pool no lo
 * permite, se deja la oferta tal cual salió del sorteo ponderado.
 */
export function pickRelicOffer(
  rng: Rng,
  pool: Relic[],
  excludeIds: ReadonlySet<string>,
  count: number,
  weights: RarityWeights,
  currentRelics: Relic[],
  avoidExactMatch?: ReadonlySet<string>
): Relic[] {
  const { multiplier, dominant } = buildSynergyMultiplier(
    pool,
    excludeIds,
    currentRelics
  );

  let picks = pickRelicsAvoidingRepeat(
    rng,
    pool,
    excludeIds,
    count,
    weights,
    avoidExactMatch,
    multiplier
  );

  if (!dominant || picks.length !== count) return picks;

  const pickedIds = new Set(picks.map((r) => r.id));
  const relatedCount = picks.filter((r) => relicMatchesArchetype(r.id, dominant)).length;

  if (relatedCount === 0) {
    const relatedCandidates = pool.filter(
      (r) =>
        !excludeIds.has(r.id) &&
        !pickedIds.has(r.id) &&
        relicMatchesArchetype(r.id, dominant)
    );
    const [replacement] = pickRelics(rng, relatedCandidates, new Set(), 1, weights);
    if (replacement) picks = [...picks.slice(0, -1), replacement];
  } else if (relatedCount === picks.length) {
    const generalistCandidates = pool.filter(
      (r) =>
        !excludeIds.has(r.id) &&
        !pickedIds.has(r.id) &&
        !relicMatchesArchetype(r.id, dominant)
    );
    const [replacement] = pickRelics(rng, generalistCandidates, new Set(), 1, weights);
    if (replacement) picks = [...picks.slice(0, -1), replacement];
  }

  return picks;
}
