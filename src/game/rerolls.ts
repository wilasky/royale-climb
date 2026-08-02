/* ============================================================
   Reroll de ofertas — Iteración 2C (docs/BUILD_AGENCY_ITERATION_2C.md,
   secciones 3 y 4). Funciones puras compartidas por el reroll de
   recompensa y el reroll de tienda: solo difieren en la tabla de
   costes y el máximo de intentos, ambos centralizados en config.ts.
   ============================================================ */

/**
 * Coste del siguiente reroll dado cuántos ya se han usado. El índice se
 * limita al último valor de `costs`, así que agotar la tabla reutiliza
 * su último coste en vez de lanzar un error o necesitar un caso especial
 * ("tercero y siguientes: 7$").
 */
export function rerollCost(costs: number[], usedCount: number): number {
  const idx = Math.min(usedCount, costs.length - 1);
  return costs[idx];
}

/**
 * Si se puede rerollear: no se ha alcanzado el máximo de intentos y hay
 * dinero suficiente para el coste del siguiente reroll.
 */
export function canReroll(
  usedCount: number,
  max: number,
  money: number,
  costs: number[]
): boolean {
  if (usedCount >= max) return false;
  return money >= rerollCost(costs, usedCount);
}
