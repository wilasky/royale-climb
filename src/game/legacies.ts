/* ============================================================
   Legados de la Corona — Iteración 2E (docs/METAPROGRESSION_2E.md,
   secciones 4-5). Un Legado es un desbloqueo permanente de perfil,
   ofrecido tras cada Coronación: el jugador elige uno de hasta 3, los
   demás no se pierden — pueden reaparecer en una Coronación futura.

   Puramente data-driven a propósito (encargo, sección 4): añadir un
   Legado nuevo es añadir una entrada a `LEGACY_POOL`, nunca un `if`
   nuevo en App.tsx. De los 9 diseñados, solo 3 tienen
   `implemented: true` — son los únicos que `offerLegacies` puede
   llegar a ofrecer; los otros 6 quedan documentados como candidatos
   futuros (ver docs/METAPROGRESSION_2E.md), presentes en el pool para
   que su forma de datos ya exista, pero inertes en el juego real.
   ============================================================ */
import type { PlayerProfile } from "./profile";
import { makeRng } from "./rng";
import { shuffle } from "./rng";

export type LegacyCategory = "content" | "playstyle" | "challenge";

/**
 * Qué desbloquea un Legado. `future` es un desbloqueo todavía sin
 * mecánica implementada — documentado, no accionable (ver `implemented`
 * en `LegacyDefinition`, que es lo que realmente controla si puede
 * ofrecerse).
 */
export type LegacyUnlock =
  | { type: "boss"; bossId: string }
  | { type: "variant"; variantId: string }
  | { type: "oath"; oathId: string }
  | { type: "relic"; relicId: string }
  | { type: "future"; note: string };

export interface LegacyDefinition {
  id: string;
  name: string;
  description: string;
  category: LegacyCategory;
  unlock: LegacyUnlock;
  /** Ids de otros Legados que deben estar ya reclamados antes de que este pueda ofrecerse. */
  prerequisites: string[];
  /** Si es false, el Legado está diseñado/documentado pero nunca aparece en una oferta real. */
  implemented: boolean;
}

export const LEGACY_POOL: LegacyDefinition[] = [
  // --- Contenido (3) ---
  {
    id: "forbidden_echo",
    name: "Eco Prohibido",
    description:
      "Desbloquea un nuevo boss posible para el Ante 2: El Eco del Trono. A partir de ahora puede sustituir a El Contable Implacable en rondas de boss futuras.",
    category: "content",
    unlock: { type: "boss", bossId: "thrones_echo" },
    prerequisites: [],
    implemented: true,
  },
  {
    id: "lost_relic",
    name: "Reliquia Perdida",
    description:
      "Añade un nuevo modificador al pool de recompensas y tienda. (Diseño pendiente para una iteración futura.)",
    category: "content",
    unlock: { type: "future", note: "nuevo modificador de recompensa/tienda" },
    prerequisites: ["forbidden_echo"],
    implemented: false,
  },
  {
    id: "crowned_deck",
    name: "Baraja Coronada",
    description:
      "Desbloquea una futura variante visual de cartas. (Pausado hasta el final del desarrollo jugable — ver docs/CARD_ART_DIRECTION.md.)",
    category: "content",
    unlock: { type: "future", note: "variante visual de cartas" },
    prerequisites: [],
    implemented: false,
  },

  // --- Nuevas formas de jugar (3) ---
  {
    id: "empty_pockets_legacy",
    name: "Bolsillos Vacíos",
    description:
      "Desbloquea la variante de inicio Bolsillos Vacíos: empiezas con 2$ en vez de 4$, pero con un descarte extra por ronda.",
    category: "playstyle",
    unlock: { type: "variant", variantId: "empty_pockets" },
    prerequisites: [],
    implemented: true,
  },
  {
    id: "trimmed_deck_legacy",
    name: "Mazo Depurado",
    description:
      "Desbloquea una variante de inicio que retira los cuatro 2 del mazo antes de empezar la run. (Diseño pendiente para una iteración futura.)",
    category: "playstyle",
    unlock: { type: "future", note: "variante de mazo depurado (sin los cuatro 2)" },
    prerequisites: [],
    implemented: false,
  },
  {
    id: "first_fortune_legacy",
    name: "Primera Fortuna",
    description:
      "Desbloquea una variante de inicio que garantiza un reroll extra gratuito en la primera recompensa de la run. (Diseño pendiente para una iteración futura.)",
    category: "playstyle",
    unlock: { type: "future", note: "variante de reroll inicial gratuito" },
    prerequisites: ["empty_pockets_legacy"],
    implemented: false,
  },

  // --- Nuevos desafíos (3) ---
  {
    id: "veil_of_the_throne_legacy",
    name: "El Velo del Trono",
    description:
      "Desbloquea el Juramento I: El Velo del Trono. No verás el próximo boss del ante hasta llegar a su ronda — toca improvisar.",
    category: "challenge",
    unlock: { type: "oath", oathId: "veil_of_the_throne" },
    prerequisites: [],
    implemented: true,
  },
  {
    id: "second_oath_legacy",
    name: "Segundo Juramento",
    description:
      "Desbloquea el Juramento II: Manos Prestadas. (Diseño pendiente para una iteración futura.)",
    category: "challenge",
    unlock: { type: "future", note: "Juramento II: Manos Prestadas" },
    prerequisites: ["veil_of_the_throne_legacy"],
    implemented: false,
  },
  {
    id: "no_return_route_legacy",
    name: "Ruta sin Retorno",
    description:
      "Desbloquea un nuevo nivel de dificultad adicional. (Diseño pendiente para una iteración futura.)",
    category: "challenge",
    unlock: { type: "future", note: "nuevo nivel de dificultad" },
    prerequisites: ["second_oath_legacy"],
    implemented: false,
  },
];

export function getLegacyById(id: string): LegacyDefinition | null {
  return LEGACY_POOL.find((l) => l.id === id) ?? null;
}

/**
 * Hasta 3 Legados ofrecidos tras una Coronación — sección 5 y 10 del
 * encargo. Determinista: misma `profile.claimedLegacyIds` + mismo
 * `seed` + mismo número de coronaciones ya registradas en `profile` ⇒
 * misma oferta (sección 11). Solo considera candidatos `implemented`,
 * no reclamados y con todos sus `prerequisites` ya reclamados — nunca
 * ofrece un Legado ya desbloqueado (sección 10). Si quedan menos de 3
 * candidatos, devuelve los que haya (incluido un array vacío cuando ya
 * se reclamaron todos los implementados).
 *
 * `pool` es inyectable (por defecto `LEGACY_POOL`) para poder testear
 * la lógica de candidatos/prerrequisitos con listas pequeñas a medida
 * sin depender de que el pool real crezca o cambie.
 */
export function offerLegacies(
  profile: PlayerProfile,
  seed: number,
  pool: LegacyDefinition[] = LEGACY_POOL
): LegacyDefinition[] {
  const claimed = new Set(profile.claimedLegacyIds);
  const candidates = pool.filter(
    (l) =>
      l.implemented &&
      !claimed.has(l.id) &&
      l.prerequisites.every((id) => claimed.has(id))
  );
  const rng = makeRng(seed + profile.coronations.length * 97 + 424243);
  return shuffle(rng, candidates).slice(0, 3);
}

/**
 * Reclama un Legado: lo añade a `claimedLegacyIds` (idempotente — si
 * ya estaba reclamado, o el id no existe en `LEGACY_POOL`, devuelve el
 * perfil sin cambios) y, si desbloquea un Juramento, sube
 * `maxDifficultyUnlocked` a al menos 1. Pura: no muta `profile`.
 */
export function claimLegacy(profile: PlayerProfile, legacyId: string): PlayerProfile {
  if (profile.claimedLegacyIds.includes(legacyId)) return profile;
  const legacy = getLegacyById(legacyId);
  if (!legacy) return profile;

  let next: PlayerProfile = {
    ...profile,
    claimedLegacyIds: [...profile.claimedLegacyIds, legacyId],
  };
  if (legacy.unlock.type === "oath") {
    next = { ...next, maxDifficultyUnlocked: Math.max(next.maxDifficultyUnlocked, 1) };
  }
  return next;
}

/** Los `LegacyDefinition` ya reclamados en `profile`, en el mismo orden que `claimedLegacyIds`. */
function claimedLegacies(profile: PlayerProfile): LegacyDefinition[] {
  return profile.claimedLegacyIds
    .map((id) => getLegacyById(id))
    .filter((l): l is LegacyDefinition => l !== null);
}

/** Ids de boss desbloqueados por algún Legado reclamado — usado por `selectBossForAnte`. */
export function getUnlockedBossIds(profile: PlayerProfile): Set<string> {
  return new Set(
    claimedLegacies(profile)
      .filter((l) => l.unlock.type === "boss")
      .map((l) => (l.unlock as { type: "boss"; bossId: string }).bossId)
  );
}

/** Ids de variante de inicio desbloqueados por algún Legado reclamado. */
export function getUnlockedVariantIds(profile: PlayerProfile): Set<string> {
  return new Set(
    claimedLegacies(profile)
      .filter((l) => l.unlock.type === "variant")
      .map((l) => (l.unlock as { type: "variant"; variantId: string }).variantId)
  );
}

/** Ids de Juramento desbloqueados por algún Legado reclamado. */
export function getUnlockedOathIds(profile: PlayerProfile): Set<string> {
  return new Set(
    claimedLegacies(profile)
      .filter((l) => l.unlock.type === "oath")
      .map((l) => (l.unlock as { type: "oath"; oathId: string }).oathId)
  );
}
