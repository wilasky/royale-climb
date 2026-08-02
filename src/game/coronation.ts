/* ============================================================
   Concepto de Coronación — Iteración 2E (docs/METAPROGRESSION_2E.md).
   Una "Coronation" es el registro de una victoria: derrotar al boss
   final de la ronda 9 en una run normal (no Endless). Este módulo solo
   sabe construir ese registro a partir de un `GameState` ya ganado —
   la persistencia (dónde vive el historial de Coronaciones) es
   responsabilidad de `profile.ts`, que importa `CoronationRecord` de
   aquí. Separado de `profile.ts` a propósito: uno entiende "qué es una
   victoria", el otro entiende "cómo se guarda un perfil".
   ============================================================ */
import type { GameState } from "./types";
import { dominantArchetypes } from "./buildIdentity";
import { ARCHETYPE_LABELS } from "./archetypes";
import { getBossById } from "./bosses";
import { SYNERGY_MIN_AFFINITY } from "./config";

/**
 * Registro mínimo de una Coronación — sección 2 del encargo. Se guarda
 * en `PlayerProfile.coronations`. No se muestran todos estos campos al
 * jugador todavía (solo un subconjunto en la pantalla de Coronación),
 * pero quedan registrados desde ya para no tener que migrar el perfil
 * cuando se necesiten.
 */
export interface CoronationRecord {
  seed: number;
  score: number;
  /** Etiqueta de arquetipo dominante (igual que el HUD), o null si no hay uno claro. */
  dominantBuild: string | null;
  activeModifierIds: string[];
  finalBossId: string | null;
  oathId: string | null;
  /** ISO 8601. */
  date: string;
  continuedEndless: boolean;
}

/**
 * Construye el registro de Coronación a partir del `GameState` justo
 * al ganar la ronda final (antes de cualquier decisión de Endless —
 * `continuedEndless` se fija en `false` aquí y se actualiza aparte si
 * el jugador continúa, ver `profile.ts::markLastCoronationEndless`).
 * Pura: no lee `Date.now()` más que para el campo `date`, no muta `gs`.
 */
export function buildCoronationRecord(gs: GameState): CoronationRecord {
  const buildLabels = dominantArchetypes(gs.relics, SYNERGY_MIN_AFFINITY, 2).map(
    (a) => ARCHETYPE_LABELS[a]
  );
  return {
    seed: gs.seed,
    score: gs.stats.totalScore,
    dominantBuild: buildLabels.length > 0 ? buildLabels.join(" · ") : null,
    activeModifierIds: gs.relics.map((r) => r.id),
    finalBossId: gs.activeBossId,
    oathId: gs.oathId,
    date: new Date().toISOString(),
    continuedEndless: false,
  };
}

/** Nombre legible del boss final registrado en una Coronación, o null. */
export function finalBossNameOf(record: CoronationRecord): string | null {
  return record.finalBossId ? getBossById(record.finalBossId)?.name ?? null : null;
}
