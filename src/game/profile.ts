/* ============================================================
   Perfil de progresión persistente — Iteración 2E
   (docs/METAPROGRESSION_2E.md, sección 1). Independiente del estado
   de una run (`GameState`): sobrevive a `newGame`, a cerrar la
   pestaña, a perder una partida. Vive en localStorage bajo una única
   clave versionada.

   Diseño deliberado:
   - Todas las funciones que TOCAN el perfil (`recordRunStart`,
     `recordCoronation`, ...) son puras: reciben un perfil y devuelven
     uno nuevo, nunca mutan el de entrada. Guardar en localStorage es
     responsabilidad exclusiva de `saveProfile`, llamada explícitamente
     desde App.tsx después de cada cambio - así el perfil se puede
     testear sin tocar el navegador.
   - El acceso a `localStorage` está detrás de un `ProfileStorage`
     inyectable (por defecto, `localStorage` real si existe). Los
     tests de Vitest corren en entorno `node` (sin DOM, ver
     vitest.config.ts) y pasan un storage en memoria en su lugar, en
     vez de necesitar jsdom solo para esto.
   - Ninguna función de este archivo lanza si el JSON está corrupto o
     tiene una forma inesperada: siempre se recupera devolviendo (o
     rellenando con) `defaultProfile()`.
   ============================================================ */
import type { CoronationRecord } from "./coronation";

export const PROFILE_STORAGE_KEY = "royale-climb:profile";

/** Versión del formato de perfil. Subir al añadir/renombrar campos y
 *  extender `migrateProfile` con la regla de subida correspondiente. */
export const PROFILE_VERSION = 1;

export interface PlayerProfile {
  version: number;
  runsStarted: number;
  /** Redundante con `coronations.length` a propósito (sección 1 pide
   *  el campo explícito); `recordCoronation` mantiene ambos en sync. */
  runsWon: number;
  /** Runs terminadas en derrota — Iteración 2F, sección 10. */
  runsLost: number;
  /** bossId -> nº de veces derrotado como boss final de una Coronación. */
  bossesDefeated: Record<string, number>;
  bestRound: number;
  bestTotalScore: number;
  bestHand: number;
  /** Mejor ronda alcanzada en Endless (más allá de la 9) — sección 10. */
  highestEndlessRound: number;
  /** Totales acumulados entre todas las runs — sección 10. */
  totalHandsPlayed: number;
  totalDiscards: number;
  totalRerolls: number;
  totalBanishes: number;
  totalShopPurchases: number;
  /** Escalera simple de dificultad desbloqueada (0 = ninguna Juramento). */
  maxDifficultyUnlocked: number;
  /** Ids de `LegacyDefinition` ya reclamados (ver legacies.ts). */
  claimedLegacyIds: string[];
  /** Historial mínimo de victorias (sección 1). */
  coronations: CoronationRecord[];
}

export function defaultProfile(): PlayerProfile {
  return {
    version: PROFILE_VERSION,
    runsStarted: 0,
    runsWon: 0,
    runsLost: 0,
    bossesDefeated: {},
    bestRound: 0,
    bestTotalScore: 0,
    bestHand: 0,
    highestEndlessRound: 0,
    totalHandsPlayed: 0,
    totalDiscards: 0,
    totalRerolls: 0,
    totalBanishes: 0,
    totalShopPurchases: 0,
    maxDifficultyUnlocked: 0,
    claimedLegacyIds: [],
    coronations: [],
  };
}

/** Superficie mínima de `localStorage` que este módulo necesita — permite inyectar un doble en tests. */
export interface ProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Usado por `runSave.ts::deleteRunSave` para borrar la run activa. */
  removeItem(key: string): void;
}

function realLocalStorage(): ProfileStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // Algunos entornos (modo privado agresivo, sandboxes) lanzan al
    // acceder a `localStorage` en vez de dejarlo `undefined`.
    return null;
  }
}

/**
 * Valida que `x` tenga al menos la forma mínima de un perfil (un
 * objeto con `version` numérica) antes de intentar usarlo. No valida
 * campo a campo — `migrateProfile` rellena cualquier campo ausente o
 * con tipo incorrecto con el valor por defecto correspondiente, así
 * que un objeto parcialmente corrupto se recupera en vez de
 * descartarse entero.
 */
function looksLikeProfile(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Normaliza un valor cargado de storage a un `PlayerProfile` válido.
 * - Si no tiene ni la forma mínima de objeto: perfil por defecto.
 * - Si tiene forma de objeto pero campos ausentes/con tipo incorrecto:
 *   cada campo se recupera individualmente desde `defaultProfile()`
 *   (migración básica implícita — subir `PROFILE_VERSION` en el
 *   futuro solo necesita añadir aquí la regla de conversión concreta
 *   para versiones antiguas antes de este relleno campo a campo).
 */
export function migrateProfile(raw: unknown): PlayerProfile {
  const fallback = defaultProfile();
  if (!looksLikeProfile(raw)) return fallback;

  const num = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? v : def);
  const strArr = (v: unknown, def: string[]) =>
    Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : def;
  const recordOfNum = (v: unknown, def: Record<string, number>) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return def;
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
    }
    return out;
  };
  const coronationArr = (v: unknown, def: CoronationRecord[]) => {
    if (!Array.isArray(v)) return def;
    return v.filter(
      (c): c is CoronationRecord =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).seed === "number" &&
        typeof (c as Record<string, unknown>).date === "string"
    );
  };

  return {
    version: PROFILE_VERSION,
    runsStarted: num(raw.runsStarted, fallback.runsStarted),
    runsWon: num(raw.runsWon, fallback.runsWon),
    runsLost: num(raw.runsLost, fallback.runsLost),
    bossesDefeated: recordOfNum(raw.bossesDefeated, fallback.bossesDefeated),
    bestRound: num(raw.bestRound, fallback.bestRound),
    bestTotalScore: num(raw.bestTotalScore, fallback.bestTotalScore),
    bestHand: num(raw.bestHand, fallback.bestHand),
    highestEndlessRound: num(raw.highestEndlessRound, fallback.highestEndlessRound),
    totalHandsPlayed: num(raw.totalHandsPlayed, fallback.totalHandsPlayed),
    totalDiscards: num(raw.totalDiscards, fallback.totalDiscards),
    totalRerolls: num(raw.totalRerolls, fallback.totalRerolls),
    totalBanishes: num(raw.totalBanishes, fallback.totalBanishes),
    totalShopPurchases: num(raw.totalShopPurchases, fallback.totalShopPurchases),
    maxDifficultyUnlocked: num(raw.maxDifficultyUnlocked, fallback.maxDifficultyUnlocked),
    claimedLegacyIds: strArr(raw.claimedLegacyIds, fallback.claimedLegacyIds),
    coronations: coronationArr(raw.coronations, fallback.coronations),
  };
}

/**
 * Carga el perfil desde `storage` (por defecto, `localStorage` real).
 * Nunca lanza: JSON inválido, storage ausente o cualquier error de
 * acceso devuelven `defaultProfile()`.
 */
export function loadProfile(storage: ProfileStorage | null = realLocalStorage()): PlayerProfile {
  if (!storage) return defaultProfile();
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return defaultProfile();
    return migrateProfile(JSON.parse(raw));
  } catch {
    return defaultProfile();
  }
}

/**
 * Guarda el perfil en `storage`. Nunca lanza (cuota excedida, modo
 * privado): si falla, la sesión sigue jugándose sin persistir ese
 * cambio, en vez de romper la app.
 */
export function saveProfile(
  profile: PlayerProfile,
  storage: ProfileStorage | null = realLocalStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ver comentario de arriba - fallo silencioso intencionado.
  }
}

/** Se llama una vez por cada `newGame()`, gane o pierda la run. */
export function recordRunStart(profile: PlayerProfile): PlayerProfile {
  return { ...profile, runsStarted: profile.runsStarted + 1 };
}

/**
 * Registra una Coronación (sección 2): actualiza contadores, mejores
 * marcas y el historial. `gsRound`/`gsBestHand` llegan por separado en
 * vez de reconstruirse del `CoronationRecord` porque el registro no
 * guarda la ronda alcanzada ni la mejor jugada individual (esos son
 * campos de `PlayerProfile`, no de cada Coronación - ver sección 1 vs
 * sección 2 del encargo, son conceptos relacionados pero distintos).
 */
export function recordCoronation(
  profile: PlayerProfile,
  record: CoronationRecord,
  reachedRound: number,
  bestHandThisRun: number
): PlayerProfile {
  const bossesDefeated = { ...profile.bossesDefeated };
  if (record.finalBossId) {
    bossesDefeated[record.finalBossId] = (bossesDefeated[record.finalBossId] ?? 0) + 1;
  }
  return {
    ...profile,
    runsWon: profile.runsWon + 1,
    bossesDefeated,
    bestRound: Math.max(profile.bestRound, reachedRound),
    bestTotalScore: Math.max(profile.bestTotalScore, record.score),
    bestHand: Math.max(profile.bestHand, bestHandThisRun),
    coronations: [...profile.coronations, record],
  };
}

/**
 * Marca la última Coronación registrada como continuada en Endless —
 * llamado cuando el jugador pulsa "Seguir escalando" desde la
 * pantalla de Coronación. No crea un registro nuevo, actualiza el
 * último tal cual pide la sección 2 ("si continuó o no en Endless").
 */
export function markLastCoronationEndless(profile: PlayerProfile): PlayerProfile {
  if (profile.coronations.length === 0) return profile;
  const coronations = [...profile.coronations];
  const last = coronations[coronations.length - 1];
  coronations[coronations.length - 1] = { ...last, continuedEndless: true };
  return { ...profile, coronations };
}

/**
 * Resumen de una run que acaba de terminar (victoria o derrota) — lo
 * que hace falta para actualizar los totales "outcome-agnósticos" de
 * la sección 10. Deliberadamente separado de `CoronationRecord`: una
 * Coronación solo existe en victoria, `recordRunEnd` se llama
 * SIEMPRE (derrota y victoria) para que hands/discards/rerolls/
 * banishes/compras y las mejores marcas se acumulen sin importar
 * cómo terminó la run. `runProgress` (descartes/rerolls/compras) vive
 * en `RunSave`, no en `GameState` — ver runSave.ts.
 */
export interface RunEndSummary {
  won: boolean;
  endless: boolean;
  reachedRound: number;
  totalScore: number;
  bestHand: number;
  handsPlayed: number;
  discardsUsed: number;
  rerollsUsed: number;
  shopPurchases: number;
  banishesUsed: number;
}

/**
 * Acumula los totales de una run terminada — sección 10. Llamar en
 * AMBOS casos (derrota y victoria); en victoria se llama además de
 * `recordCoronation` (que sigue siendo el único responsable de
 * `runsWon`/`coronations`/`bossesDefeated`, para no duplicar esos
 * campos aquí).
 */
export function recordRunEnd(
  profile: PlayerProfile,
  summary: RunEndSummary
): PlayerProfile {
  return {
    ...profile,
    runsLost: profile.runsLost + (summary.won ? 0 : 1),
    totalHandsPlayed: profile.totalHandsPlayed + summary.handsPlayed,
    totalDiscards: profile.totalDiscards + summary.discardsUsed,
    totalRerolls: profile.totalRerolls + summary.rerollsUsed,
    totalBanishes: profile.totalBanishes + summary.banishesUsed,
    totalShopPurchases: profile.totalShopPurchases + summary.shopPurchases,
    bestRound: Math.max(profile.bestRound, summary.reachedRound),
    bestTotalScore: Math.max(profile.bestTotalScore, summary.totalScore),
    bestHand: Math.max(profile.bestHand, summary.bestHand),
    highestEndlessRound: summary.endless
      ? Math.max(profile.highestEndlessRound, summary.reachedRound)
      : profile.highestEndlessRound,
  };
}

/** Estadísticas derivadas para mostrar al jugador — sección 10, `buildPlayerStats(profile)`. */
export interface PlayerStats {
  runsStarted: number;
  runsWon: number;
  runsLost: number;
  /** `runsWon / runsStarted`, entre 0 y 1. `0` si todavía no se ha iniciado ninguna run. */
  winRate: number;
  totalHandsPlayed: number;
  totalDiscards: number;
  totalRerolls: number;
  totalBanishes: number;
  totalShopPurchases: number;
  highestRound: number;
  highestEndlessRound: number;
  bestTotalScore: number;
  bestSingleHand: number;
  coronationsCount: number;
  bossesDefeated: Record<string, number>;
  /** Arquetipo más frecuente entre `coronations[].dominantBuild`, o `null` sin datos suficientes. */
  favoriteBuild: string | null;
}

/** Pura — no lee ni escribe storage, solo deriva de un `PlayerProfile` ya cargado. */
export function buildPlayerStats(profile: PlayerProfile): PlayerStats {
  const counts = new Map<string, number>();
  for (const c of profile.coronations) {
    if (!c.dominantBuild) continue;
    counts.set(c.dominantBuild, (counts.get(c.dominantBuild) ?? 0) + 1);
  }
  let favoriteBuild: string | null = null;
  let favoriteCount = 0;
  for (const [build, count] of counts) {
    if (count > favoriteCount) {
      favoriteBuild = build;
      favoriteCount = count;
    }
  }

  return {
    runsStarted: profile.runsStarted,
    runsWon: profile.runsWon,
    runsLost: profile.runsLost,
    winRate: profile.runsStarted > 0 ? profile.runsWon / profile.runsStarted : 0,
    totalHandsPlayed: profile.totalHandsPlayed,
    totalDiscards: profile.totalDiscards,
    totalRerolls: profile.totalRerolls,
    totalBanishes: profile.totalBanishes,
    totalShopPurchases: profile.totalShopPurchases,
    highestRound: profile.bestRound,
    highestEndlessRound: profile.highestEndlessRound,
    bestTotalScore: profile.bestTotalScore,
    bestSingleHand: profile.bestHand,
    coronationsCount: profile.coronations.length,
    bossesDefeated: profile.bossesDefeated,
    favoriteBuild,
  };
}
