/* ============================================================
   Selección de modificadores ponderada por rareza — Iteración 2A
   (docs/GAME_AUDIT.md, P0-2). Una única función pura, reutilizada
   tanto por la pantalla de recompensa como por la tienda.
   ============================================================ */
import type { Relic } from "./types";
import type { RarityWeights } from "./config";
import type { Rng } from "./rng";

/**
 * Elige `count` modificadores de `pool`, sin duplicados, excluyendo
 * los ya poseídos, con probabilidad proporcional a `weights[rareza]`.
 * Muestreo sin reemplazo: tras cada elección se recalculan los pesos
 * sobre lo que queda, para no favorecer artificialmente al final.
 *
 * `weightMultiplier` opcional (Iteración 2C, sección 5): multiplica el
 * peso de rareza de cada candidato antes de tirar. Se aplica SOBRE el
 * peso de rareza, nunca lo sustituye — un candidato con peso 0 en esta
 * fase (p.ej. legendario en fase 1) sigue teniendo peso 0 sin importar
 * el multiplicador, así el sesgo de sinergia nunca salta las
 * restricciones de fase.
 *
 * Determinista: para la misma secuencia de `rng()` y el mismo estado
 * de entrada, siempre devuelve el mismo resultado.
 */
export function pickRelics(
  rng: Rng,
  pool: Relic[],
  ownedIds: ReadonlySet<string>,
  count: number,
  weights: RarityWeights,
  weightMultiplier?: (relic: Relic) => number
): Relic[] {
  const remaining = pool.filter((r) => !ownedIds.has(r.id));
  const picks: Relic[] = [];
  const effectiveWeight = (r: Relic) =>
    (weights[r.rarity] ?? 0) * (weightMultiplier ? weightMultiplier(r) : 1);

  while (picks.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, r) => sum + effectiveWeight(r), 0);

    let index: number;
    if (totalWeight <= 0) {
      // Solo quedan rarezas con peso 0 en esta fase (p.ej. únicamente
      // legendarios sin descubrir en fase 1): recurrir a uniforme en
      // vez de no poder ofrecer nada.
      index = Math.floor(rng() * remaining.length);
    } else {
      let roll = rng() * totalWeight;
      index = remaining.length - 1;
      for (let i = 0; i < remaining.length; i++) {
        roll -= effectiveWeight(remaining[i]);
        if (roll <= 0) {
          index = i;
          break;
        }
      }
    }

    picks.push(remaining[index]);
    remaining.splice(index, 1);
  }

  return picks;
}

/**
 * Igual que `pickRelics`, pero para rerolls — Iteración 2C
 * (docs/BUILD_AGENCY_ITERATION_2C.md, secciones 3 y 4). Si el resultado
 * coincide exactamente con `avoidExactMatch` (la oferta anterior) y el
 * pool tiene margen para una alternativa real, vuelve a tirar una vez
 * más. No es una garantía de que la nueva oferta sea distinta (con un
 * pool muy reducido puede no haber alternativa), solo evita el caso
 * más chocante: pagar por un reroll y recibir exactamente lo mismo
 * pudiendo haber sido distinto.
 */
export function pickRelicsAvoidingRepeat(
  rng: Rng,
  pool: Relic[],
  ownedIds: ReadonlySet<string>,
  count: number,
  weights: RarityWeights,
  avoidExactMatch?: ReadonlySet<string>,
  weightMultiplier?: (relic: Relic) => number
): Relic[] {
  let picks = pickRelics(rng, pool, ownedIds, count, weights, weightMultiplier);

  if (
    avoidExactMatch &&
    picks.length > 0 &&
    picks.length === avoidExactMatch.size &&
    picks.every((r) => avoidExactMatch.has(r.id))
  ) {
    const remainingCandidates = pool.filter((r) => !ownedIds.has(r.id));
    if (remainingCandidates.length > count) {
      picks = pickRelics(rng, pool, ownedIds, count, weights, weightMultiplier);
    }
  }

  return picks;
}
