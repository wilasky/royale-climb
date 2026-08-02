/* ============================================================
   Juramentos — Iteración 2E (docs/METAPROGRESSION_2E.md, sección 6).
   Un Juramento es una condición adicional que el jugador elige ANTES
   de empezar una run — no copia el sistema de Stakes de Balatro
   directamente (+X% objetivo escalonado): en vez de tocar números
   protegidos (objetivos de ronda, economía, rarezas, valores de
   modificadores — todos fuera de alcance en esta iteración), cambia
   una condición de DECISIÓN o de INFORMACIÓN disponible.

   Solo JURAMENTO I está implementado. Los otros 5 diseños quedan
   documentados en docs/METAPROGRESSION_2E.md como candidatos futuros,
   sin ninguna línea de código de efecto todavía — este archivo solo
   contiene la definición y el helper de efecto de JURAMENTO I.
   ============================================================ */

export interface OathDefinition {
  id: string;
  name: string;
  description: string;
}

/**
 * JURAMENTO I — "El Velo del Trono". Oculta el panel de aviso previo
 * ("Próximo boss del ante", ver docs/BOSS_DESIGN_2D.md sección 7-8):
 * el jugador no sabe qué boss le espera hasta llegar a la ronda de
 * boss en persona. No es un hard counter (todos los bosses siguen
 * siendo superables adaptando decisiones EN la ronda, igual que sin
 * Juramento — lo único que cambia es la planificación previa) y no
 * toca ningún objetivo de ronda ni valor numérico existente.
 */
export const OATH_I_VEIL_OF_THE_THRONE = "veil_of_the_throne";

export const OATH_POOL: Record<string, OathDefinition> = {
  [OATH_I_VEIL_OF_THE_THRONE]: {
    id: OATH_I_VEIL_OF_THE_THRONE,
    name: "El Velo del Trono",
    description:
      "No verás qué boss te espera hasta llegar a su ronda — sin aviso previo, toca improvisar.",
  },
};

export function getOathById(id: string | null): OathDefinition | null {
  return id ? OATH_POOL[id] ?? null : null;
}

/**
 * Si el telegraph de "próximo boss del ante" debe mostrarse. Pura,
 * para poder testear el efecto del Juramento sin montar componentes
 * React — `App.tsx` solo llama a esto en vez de comparar el id a
 * mano en mitad del JSX.
 */
export function shouldShowBossTelegraph(oathId: string | null): boolean {
  return oathId !== OATH_I_VEIL_OF_THE_THRONE;
}
