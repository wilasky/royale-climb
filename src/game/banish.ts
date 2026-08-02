/* ============================================================
   Destierro permanente de modificador — Iteración 2C
   (docs/BUILD_AGENCY_ITERATION_2C.md, sección 7). Funciones puras,
   sin mutar los arrays recibidos.
   ============================================================ */

/** ¿Se puede desterrar uno más sin superar el máximo por run? */
export function canBanish(banishedIds: string[], max: number): boolean {
  return banishedIds.length < max;
}

/**
 * Coste del siguiente destierro. Primero gratis, después el resto de
 * `costs` (el índice se limita al último valor si se agotara la tabla).
 */
export function banishCost(banishedIds: string[], costs: number[]): number {
  const idx = Math.min(banishedIds.length, costs.length - 1);
  return costs[idx];
}

/** Si un modificador ya está en la lista de desterrados de esta run. */
export function isBanished(banishedIds: string[], relicId: string): boolean {
  return banishedIds.includes(relicId);
}

/**
 * Añade `relicId` a la lista de desterrados sin mutar la original. Si ya
 * estaba desterrado, devuelve la misma lista (no duplica entradas).
 */
export function applyBanish(banishedIds: string[], relicId: string): string[] {
  if (banishedIds.includes(relicId)) return banishedIds;
  return [...banishedIds, relicId];
}
