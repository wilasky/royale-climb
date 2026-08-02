/* ============================================================
   Límite y sustitución de modificadores activos — Iteración 2B
   (docs/BALANCE_ITERATION_2B.md, sección 1). Funciones puras: no
   mutan los arrays recibidos ni tocan estado de React.
   ============================================================ */
import type { Relic } from "./types";

/** ¿Hay hueco para un modificador más sin tener que sustituir ninguno? */
export function hasRelicCapacity(relics: Relic[], max: number): boolean {
  return relics.length < max;
}

/**
 * Sustituye el modificador `removeId` por `added`, preservando el orden
 * de la lista. Si `removeId` no está entre los actuales (no debería
 * ocurrir — la UI solo permite elegir entre los que el jugador ya
 * tiene), devuelve la lista sin cambios en vez de añadir `added` de más.
 */
export function replaceRelic(
  relics: Relic[],
  removeId: string,
  added: Relic
): Relic[] {
  return relics.map((r) => (r.id === removeId ? added : r));
}
