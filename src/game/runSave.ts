/* ============================================================
   Save versionado de una run activa — Iteración 2F
   (docs/PERSISTENCE_2F.md). Deliberadamente separado de
   `profile.ts`: el perfil sobrevive entre runs, `RunSave` representa
   ÚNICAMENTE la partida activa (o ninguna, si no hay run en curso).

   Qué guarda y qué NO:
   - `gameState`: el `GameState` completo — ya es puramente serializable
     (sin funciones, sin closures de RNG) porque así se diseñó desde la
     Iteración 2A.
   - `screen`: en qué pantalla estaba el jugador (solo las que
     representan una run activa — ver `SAVEABLE_SCREENS`).
   - `pendingReward`/`pendingShop`: la oferta ACTUAL mostrada en
     RewardScreen/ShopScreen. Se snapshotea explícitamente (no se
     regenera con RNG al restaurar) porque esas pantallas consumen un
     stream de RNG compartido y acumulativo a lo largo de TODA la run
     (`rewardRng`/`shopRng` en App.tsx) — cuántos rerolls se han hecho
     en pantallas anteriores de la misma run no queda registrado en
     ningún otro sitio, así que la única manera fiable de restaurar
     "lo que el jugador está viendo ahora mismo" es guardarlo tal cual.
   - `pendingLegacy`: solo el paso del flujo de Coronación
     (resumen/legado/confirmación) y qué se reclamó. La oferta de
     Legados en sí NO se snapshotea: `offerLegacies(profile, seed)`
     usa una RNG propia recalculada en cada render a partir de
     `profile.coronations.length`, que no cambia mientras no se
     reclame nada — así que es determinista por construcción y
     recomputarla al restaurar da exactamente la misma oferta.
   - NO guarda el estado interno de ningún generador de números
     aleatorios (los `Rng` de `rng.ts` son funciones/closures, no
     serializables). Los streams de RNG acotados a una sola pantalla
     (previsualización de rotura de cristal en `PlayScreen`, siguiente
     reroll tras restaurar) se re-siembran de forma determinista pero
     NO continúan exactamente la secuencia previa al refresco — ver
     docs/PERSISTENCE_2F.md, sección "Qué NO garantiza el determinismo".
   ============================================================ */
import type {
  Card,
  GameState,
  Relic,
  Screen,
  ShopSpecial,
  SpecialCardKind,
  Suit,
  Rarity,
} from "./types";
import type { ProfileStorage } from "./profile";
import { getBossById } from "./bosses";
import { getOathById } from "./oaths";
import { getLegacyById } from "./legacies";

export const RUN_SAVE_VERSION = 1;
export const RUN_SAVE_STORAGE_KEY = "royale-climb:run";

/** Pantallas que representan una run activa guardable. "menu" y "defeat" nunca lo son (sección 8). */
export const SAVEABLE_SCREENS: ReadonlySet<Screen> = new Set([
  "play",
  "reward",
  "money-reward",
  "shop",
  "win",
]);

export function isSaveableScreen(screen: Screen): boolean {
  return SAVEABLE_SCREENS.has(screen);
}

export interface PendingRewardSave {
  offers: Relic[];
  rerollCount: number;
}

export interface PendingShopSave {
  stock: {
    relics: { relic: Relic; price: number }[];
    specials: ShopSpecial[];
  };
  usedSpecialKinds: SpecialCardKind[];
  rerollCount: number;
}

export interface PendingRelicReplaceSave {
  incoming: Relic;
  context: "reward" | "shop";
  price?: number;
}

export type WinStep = "summary" | "legacy" | "confirm";

export interface PendingLegacySave {
  step: WinStep;
  claimedLegacyId: string | null;
}

/** Contadores de progreso de ESTA run — sección 10 (estadísticas), no viven en `GameState` porque no afectan a la partida en sí, solo se acumulan en el perfil al terminar. */
export interface RunProgressCounters {
  discardsUsed: number;
  rerollsUsed: number;
  shopPurchases: number;
}

export function emptyRunProgressCounters(): RunProgressCounters {
  return { discardsUsed: 0, rerollsUsed: 0, shopPurchases: 0 };
}

export interface RunSave {
  version: number;
  /** ISO 8601 — momento del último autosave. */
  savedAt: string;
  screen: Screen;
  gameState: GameState;
  runProgress: RunProgressCounters;
  pendingReward: PendingRewardSave | null;
  pendingShop: PendingShopSave | null;
  pendingRelicReplace: PendingRelicReplaceSave | null;
  pendingLegacy: PendingLegacySave | null;
}

/* ---------------- Validación estructural ---------------- */

const RARITIES: readonly Rarity[] = ["common", "rare", "epic", "legendary"];
const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const SPECIAL_KINDS: readonly SpecialCardKind[] = [
  "glass",
  "steel",
  "gold",
  "bonus",
  "suitconv",
];

function isRarity(x: unknown): x is Rarity {
  return typeof x === "string" && (RARITIES as string[]).includes(x);
}
function isSuit(x: unknown): x is Suit {
  return typeof x === "string" && (SUITS as string[]).includes(x);
}
function isSpecialKind(x: unknown): x is SpecialCardKind {
  return typeof x === "string" && (SPECIAL_KINDS as string[]).includes(x);
}
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

function isCard(x: unknown): x is Card {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    isSuit(c.suit) &&
    typeof c.rank === "number" &&
    c.rank >= 2 &&
    c.rank <= 14 &&
    typeof c.bonusChips === "number" &&
    typeof c.glass === "boolean" &&
    typeof c.steel === "boolean" &&
    typeof c.gold === "boolean"
  );
}
function isCardArray(x: unknown): x is Card[] {
  return Array.isArray(x) && x.every(isCard);
}

function isRelic(x: unknown): x is Relic {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    typeof r.desc === "string" &&
    isRarity(r.rarity) &&
    typeof r.icon === "string"
  );
}
function isRelicArray(x: unknown): x is Relic[] {
  return Array.isArray(x) && x.every(isRelic);
}

function isShopSpecial(x: unknown): x is ShopSpecial {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    isSpecialKind(s.kind) &&
    typeof s.name === "string" &&
    typeof s.desc === "string" &&
    typeof s.price === "number" &&
    isRarity(s.rarity) &&
    typeof s.icon === "string"
  );
}

/**
 * Valida un `GameState` completo, incluida la existencia real de los
 * ids que referencia (`activeBossId`, `oathId`) — sección 6 del
 * encargo: "referencia ids inexistentes" debe tratarse como
 * corrupción, no como un crash al intentar `getBossById(...)!`.
 */
function isValidGameState(x: unknown): x is GameState {
  if (typeof x !== "object" || x === null) return false;
  const g = x as Record<string, unknown>;

  const numFields: (keyof GameState)[] = [
    "seed",
    "round",
    "ante",
    "money",
    "handsLeft",
    "discardsLeft",
    "handsPerRound",
    "discardsPerRound",
    "handSize",
    "scoreThisRound",
    "target",
    "discardsUsedThisRound",
    "permaMult",
  ];
  for (const f of numFields) {
    if (typeof g[f] !== "number" || !Number.isFinite(g[f] as number)) return false;
  }
  if ((g.round as number) < 1 || (g.handSize as number) < 1 || (g.target as number) <= 0) {
    return false;
  }

  if (!isCardArray(g.deck)) return false;
  if (!isCardArray(g.drawPile)) return false;
  if (!isCardArray(g.hand)) return false;
  if (!isCardArray(g.discardPile)) return false;
  if (!isRelicArray(g.relics)) return false;
  if (!isStringArray(g.banishedRelicIds)) return false;

  if (typeof g.endless !== "boolean") return false;

  if (typeof g.stats !== "object" || g.stats === null) return false;
  const stats = g.stats as Record<string, unknown>;
  if (
    typeof stats.handsPlayed !== "number" ||
    typeof stats.bestHand !== "number" ||
    typeof stats.totalScore !== "number"
  )
    return false;

  if (!Array.isArray(g.history)) return false;
  for (const entry of g.history) {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    if (
      typeof e.hand !== "string" ||
      typeof e.score !== "number" ||
      typeof e.round !== "number"
    )
      return false;
  }

  if (g.activeBossId !== null) {
    if (typeof g.activeBossId !== "string" || !getBossById(g.activeBossId)) {
      return false;
    }
  }
  if (typeof g.bossState !== "object" || g.bossState === null || Array.isArray(g.bossState)) {
    return false;
  }
  if (g.oathId !== null) {
    if (typeof g.oathId !== "string" || !getOathById(g.oathId)) {
      return false;
    }
  }

  return true;
}

function isValidPendingReward(x: unknown): x is PendingRewardSave {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return isRelicArray(p.offers) && typeof p.rerollCount === "number";
}

function isValidPendingShop(x: unknown): x is PendingShopSave {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  if (typeof p.stock !== "object" || p.stock === null) return false;
  const stock = p.stock as Record<string, unknown>;
  if (!Array.isArray(stock.relics)) return false;
  for (const entry of stock.relics) {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    if (!isRelic(e.relic) || typeof e.price !== "number") return false;
  }
  if (!Array.isArray(stock.specials) || !stock.specials.every(isShopSpecial)) {
    return false;
  }
  if (!Array.isArray(p.usedSpecialKinds) || !p.usedSpecialKinds.every(isSpecialKind)) {
    return false;
  }
  return typeof p.rerollCount === "number";
}

function isValidPendingRelicReplace(x: unknown): x is PendingRelicReplaceSave {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  if (!isRelic(p.incoming)) return false;
  if (p.context !== "reward" && p.context !== "shop") return false;
  if (p.price !== undefined && typeof p.price !== "number") return false;
  return true;
}

function isValidPendingLegacy(x: unknown): x is PendingLegacySave {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  if (p.step !== "summary" && p.step !== "legacy" && p.step !== "confirm") return false;
  if (p.claimedLegacyId !== null) {
    if (typeof p.claimedLegacyId !== "string" || !getLegacyById(p.claimedLegacyId)) {
      return false;
    }
  }
  return true;
}

function isValidRunProgress(x: unknown): x is RunProgressCounters {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.discardsUsed === "number" &&
    typeof p.rerollsUsed === "number" &&
    typeof p.shopPurchases === "number"
  );
}

/**
 * Valida la forma completa de un `RunSave` ya con `version` correcta
 * (la comprobación de versión vive en `migrateRunSave`). Devuelve el
 * save tipado si es válido, o `null` si cualquier parte de la forma
 * es incorrecta o referencia un id que no existe.
 */
export function validateRunSave(raw: unknown): RunSave | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;

  if (typeof s.savedAt !== "string") return null;
  if (typeof s.screen !== "string" || !isSaveableScreen(s.screen as Screen)) return null;
  if (!isValidGameState(s.gameState)) return null;
  if (!isValidRunProgress(s.runProgress)) return null;

  if (s.pendingReward !== null && !isValidPendingReward(s.pendingReward)) return null;
  if (s.pendingShop !== null && !isValidPendingShop(s.pendingShop)) return null;
  if (
    s.pendingRelicReplace !== null &&
    !isValidPendingRelicReplace(s.pendingRelicReplace)
  ) {
    return null;
  }
  if (s.pendingLegacy !== null && !isValidPendingLegacy(s.pendingLegacy)) return null;

  return {
    version: RUN_SAVE_VERSION,
    savedAt: s.savedAt,
    screen: s.screen as Screen,
    gameState: s.gameState as GameState,
    runProgress: s.runProgress as RunProgressCounters,
    pendingReward: (s.pendingReward as PendingRewardSave | null) ?? null,
    pendingShop: (s.pendingShop as PendingShopSave | null) ?? null,
    pendingRelicReplace:
      (s.pendingRelicReplace as PendingRelicReplaceSave | null) ?? null,
    pendingLegacy: (s.pendingLegacy as PendingLegacySave | null) ?? null,
  };
}

/**
 * Punto central de migración — sección 7. Hoy solo existe
 * `RUN_SAVE_VERSION = 1`, así que no hay ninguna conversión real que
 * hacer: se valida tal cual. Una versión futura desconocida falla de
 * forma segura (`null`) en vez de intentar adivinar su forma — cuando
 * exista `RUN_SAVE_VERSION = 2`, este es el sitio donde se añadiría
 * `if (raw.version === 1) { raw = upgradeV1ToV2(raw); }` antes de
 * validar.
 */
export function migrateRunSave(raw: unknown): RunSave | null {
  if (typeof raw !== "object" || raw === null) return null;
  const version = (raw as Record<string, unknown>).version;
  if (version !== RUN_SAVE_VERSION) return null;
  return validateRunSave(raw);
}

/* ---------------- Carga / guardado ---------------- */

export type LoadRunSaveResult =
  | { status: "none" }
  | { status: "valid"; save: RunSave }
  | { status: "corrupt" };

function realLocalStorage(): ProfileStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Carga el save de run desde `storage` (por defecto `localStorage`
 * real). Nunca lanza — JSON inválido, forma inesperada o versión
 * incompatible se reportan como `{ status: "corrupt" }` en vez de
 * hacer crashear la app (sección 6).
 */
export function loadRunSave(
  storage: ProfileStorage | null = realLocalStorage()
): LoadRunSaveResult {
  if (!storage) return { status: "none" };
  let raw: string | null;
  try {
    raw = storage.getItem(RUN_SAVE_STORAGE_KEY);
  } catch {
    return { status: "none" };
  }
  if (!raw) return { status: "none" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "corrupt" };
  }

  const migrated = migrateRunSave(parsed);
  if (!migrated) return { status: "corrupt" };
  return { status: "valid", save: migrated };
}

/** Guarda `save` en `storage`. Nunca lanza (cuota excedida, modo privado). */
export function saveRunSave(
  save: RunSave,
  storage: ProfileStorage | null = realLocalStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(RUN_SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Fallo silencioso intencionado — ver profile.ts::saveProfile.
  }
}

/** Elimina el save de run — fin de partida (derrota, vuelta al menú tras Coronación, Nueva Run confirmada). */
export function deleteRunSave(
  storage: ProfileStorage | null = realLocalStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(RUN_SAVE_STORAGE_KEY);
  } catch {
    // Idem.
  }
}
