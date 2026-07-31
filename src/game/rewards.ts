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
 * Determinista: para la misma secuencia de `rng()` y el mismo estado
 * de entrada, siempre devuelve el mismo resultado.
 */
export function pickRelics(
  rng: Rng,
  pool: Relic[],
  ownedIds: ReadonlySet<string>,
  count: number,
  weights: RarityWeights
): Relic[] {
  const remaining = pool.filter((r) => !ownedIds.has(r.id));
  const picks: Relic[] = [];

  while (picks.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce(
      (sum, r) => sum + (weights[r.rarity] ?? 0),
      0
    );

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
        roll -= weights[remaining[i].rarity] ?? 0;
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
