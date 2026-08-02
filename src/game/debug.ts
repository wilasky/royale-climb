/* ============================================================
   Modo de depuración local — Iteración 2C
   (docs/BUILD_AGENCY_ITERATION_2C.md, sección 9). Únicamente activo
   en desarrollo (`import.meta.env.DEV`, controlado por Vite — nunca
   se ejecuta en el build de producción). Sin interfaz, sin servicios
   externos: solo logging condicionado a consola.
   ============================================================ */
import type { GameState, Relic } from "./types";
import { computeBuildIdentity } from "./buildIdentity";

export interface RelicOfferDebugInfo {
  /** Contexto de la llamada: "reward" | "reward-reroll" | "shop" | "shop-reroll". */
  context: string;
  offers: Relic[];
  rerollsUsed: number;
}

/**
 * Vuelca a consola (solo en dev) el estado relevante para depurar la
 * generación de una oferta: afinidades actuales, arquetipo dominante,
 * modificadores desterrados, rerolls usados y la seed de la run. No
 * expone pesos ponderados por candidato individual (esos ya se pueden
 * inspeccionar recalculando `computeBuildIdentity`/`pickRelicOffer`
 * con los mismos argumentos) — mantenerlo así evita duplicar estado
 * solo para depuración.
 */
export function logRelicOfferDebug(gs: GameState, info: RelicOfferDebugInfo): void {
  if (!import.meta.env.DEV) return;
  const identity = computeBuildIdentity(gs.relics);
  // eslint-disable-next-line no-console
  console.debug(`[royale-climb:debug] ${info.context}`, {
    seed: gs.seed,
    round: gs.round,
    affinities: identity.affinities,
    dominant: identity.dominant,
    banishedRelicIds: gs.banishedRelicIds,
    rerollsUsed: info.rerollsUsed,
    offers: info.offers.map((r) => ({ id: r.id, name: r.name, rarity: r.rarity })),
  });
}
