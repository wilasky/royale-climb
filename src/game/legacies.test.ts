import { describe, it, expect } from "vitest";
import {
  LEGACY_POOL,
  getLegacyById,
  offerLegacies,
  claimLegacy,
  getUnlockedBossIds,
  getUnlockedVariantIds,
  getUnlockedOathIds,
} from "./legacies";
import type { LegacyDefinition } from "./legacies";
import { defaultProfile, recordCoronation } from "./profile";
import type { PlayerProfile } from "./profile";
import type { CoronationRecord } from "./coronation";

function record(overrides: Partial<CoronationRecord> = {}): CoronationRecord {
  return {
    seed: 1,
    score: 1000,
    dominantBuild: null,
    activeModifierIds: [],
    finalBossId: "split_throne",
    oathId: null,
    date: "2026-08-09T00:00:00.000Z",
    continuedEndless: false,
    ...overrides,
  };
}

function withClaims(ids: string[]): PlayerProfile {
  return { ...defaultProfile(), claimedLegacyIds: ids };
}

describe("LEGACY_POOL — diseño de los 9 Legados", () => {
  it("tiene exactamente 9 Legados", () => {
    expect(LEGACY_POOL.length).toBe(9);
  });

  it("tiene exactamente 3 por categoría", () => {
    const byCategory = { content: 0, playstyle: 0, challenge: 0 };
    for (const l of LEGACY_POOL) byCategory[l.category]++;
    expect(byCategory).toEqual({ content: 3, playstyle: 3, challenge: 3 });
  });

  it("tiene exactamente 3 implementados, 1 por categoría", () => {
    const implemented = LEGACY_POOL.filter((l) => l.implemented);
    expect(implemented).toHaveLength(3);
    const categories = new Set(implemented.map((l) => l.category));
    expect(categories).toEqual(new Set(["content", "playstyle", "challenge"]));
  });

  it("todos los ids son únicos", () => {
    const ids = LEGACY_POOL.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo prerequisito referencia un id real del propio pool", () => {
    const ids = new Set(LEGACY_POOL.map((l) => l.id));
    for (const l of LEGACY_POOL) {
      for (const prereq of l.prerequisites) {
        expect(ids.has(prereq)).toBe(true);
      }
    }
  });
});

describe("getLegacyById", () => {
  it("encuentra un Legado real", () => {
    expect(getLegacyById("forbidden_echo")?.name).toBe("Eco Prohibido");
  });

  it("devuelve null para un id desconocido", () => {
    expect(getLegacyById("no_existe")).toBeNull();
  });
});

describe("offerLegacies — oferta de hasta 3", () => {
  it("con perfil nuevo, ofrece los 3 Legados implementados (ninguno tiene prerrequisitos)", () => {
    const offers = offerLegacies(defaultProfile(), 123);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((l) => l.id))).toEqual(
      new Set(["forbidden_echo", "empty_pockets_legacy", "veil_of_the_throne_legacy"])
    );
  });

  it("nunca ofrece un Legado ya reclamado", () => {
    const profile = withClaims(["forbidden_echo"]);
    const offers = offerLegacies(profile, 123);
    expect(offers.map((l) => l.id)).not.toContain("forbidden_echo");
    expect(offers).toHaveLength(2);
  });

  it("con todos los implementados ya reclamados, no ofrece nada", () => {
    const profile = withClaims([
      "forbidden_echo",
      "empty_pockets_legacy",
      "veil_of_the_throne_legacy",
    ]);
    expect(offerLegacies(profile, 123)).toEqual([]);
  });

  it("nunca ofrece un Legado no implementado, aunque sus prerrequisitos estén reclamados", () => {
    // lost_relic requiere forbidden_echo y NO está implementado: no debe aparecer nunca.
    const profile = withClaims(["forbidden_echo"]);
    const offers = offerLegacies(profile, 123);
    expect(offers.map((l) => l.id)).not.toContain("lost_relic");
  });

  it("es determinista: misma seed + mismo perfil = misma oferta", () => {
    const profile = withClaims(["forbidden_echo"]);
    const a = offerLegacies(profile, 999);
    const b = offerLegacies(profile, 999);
    expect(a.map((l) => l.id)).toEqual(b.map((l) => l.id));
  });

  it("distintas seeds pueden variar el orden de la oferta (mismo conjunto, orden no forzado)", () => {
    const profile = defaultProfile();
    const a = offerLegacies(profile, 1);
    const b = offerLegacies(profile, 2);
    // Mismo conjunto de 3 en ambos casos (todos los implementados sin reclamar).
    expect(new Set(a.map((l) => l.id))).toEqual(new Set(b.map((l) => l.id)));
  });

  it("el número de coronaciones ya registradas participa en el determinismo", () => {
    const p0 = defaultProfile();
    const p1 = recordCoronation(p0, record(), 9, 100);
    // Incluso con las mismas claims, la oferta puede reordenarse porque
    // coronations.length forma parte del offset de la rng - lo importante
    // es que ambas siguen siendo deterministas para su propio estado.
    const offersAtP0 = offerLegacies(p0, 555);
    const offersAtP0Again = offerLegacies(p0, 555);
    expect(offersAtP0.map((l) => l.id)).toEqual(offersAtP0Again.map((l) => l.id));
    expect(offerLegacies(p1, 555).map((l) => l.id)).toHaveLength(3);
  });

  it("respeta prerrequisitos usando un pool de prueba a medida", () => {
    const pool: LegacyDefinition[] = [
      {
        id: "a",
        name: "A",
        description: "",
        category: "content",
        unlock: { type: "future", note: "" },
        prerequisites: [],
        implemented: true,
      },
      {
        id: "b",
        name: "B",
        description: "",
        category: "content",
        unlock: { type: "future", note: "" },
        prerequisites: ["a"],
        implemented: true,
      },
    ];
    const profileWithoutA = defaultProfile();
    expect(offerLegacies(profileWithoutA, 1, pool).map((l) => l.id)).toEqual(["a"]);

    const profileWithA = withClaims(["a"]);
    expect(offerLegacies(profileWithA, 1, pool).map((l) => l.id)).toEqual(["b"]);
  });

  it("con menos de 3 disponibles, muestra solo los que hay (sin inventar nada)", () => {
    const profile = withClaims(["forbidden_echo", "empty_pockets_legacy"]);
    const offers = offerLegacies(profile, 42);
    expect(offers).toHaveLength(1);
    expect(offers[0].id).toBe("veil_of_the_throne_legacy");
  });
});

describe("claimLegacy", () => {
  it("añade el id a claimedLegacyIds", () => {
    const next = claimLegacy(defaultProfile(), "forbidden_echo");
    expect(next.claimedLegacyIds).toEqual(["forbidden_echo"]);
  });

  it("es idempotente: reclamar dos veces el mismo id no lo duplica", () => {
    let p = claimLegacy(defaultProfile(), "forbidden_echo");
    p = claimLegacy(p, "forbidden_echo");
    expect(p.claimedLegacyIds).toEqual(["forbidden_echo"]);
  });

  it("un id desconocido no modifica el perfil", () => {
    const p = defaultProfile();
    expect(claimLegacy(p, "no_existe")).toEqual(p);
  });

  it("reclamar un Legado de tipo oath sube maxDifficultyUnlocked a al menos 1", () => {
    const p = claimLegacy(defaultProfile(), "veil_of_the_throne_legacy");
    expect(p.maxDifficultyUnlocked).toBeGreaterThanOrEqual(1);
  });

  it("reclamar un Legado que no es oath no toca maxDifficultyUnlocked", () => {
    const p = claimLegacy(defaultProfile(), "forbidden_echo");
    expect(p.maxDifficultyUnlocked).toBe(0);
  });

  it("no muta el perfil recibido", () => {
    const p = defaultProfile();
    claimLegacy(p, "forbidden_echo");
    expect(p.claimedLegacyIds).toEqual([]);
  });
});

describe("desbloqueos derivados de los Legados reclamados", () => {
  it("sin Legados reclamados, no hay bosses/variantes/juramentos desbloqueados", () => {
    const p = defaultProfile();
    expect(getUnlockedBossIds(p)).toEqual(new Set());
    expect(getUnlockedVariantIds(p)).toEqual(new Set());
    expect(getUnlockedOathIds(p)).toEqual(new Set());
  });

  it("reclamar Eco Prohibido desbloquea el boss thrones_echo, nada más", () => {
    const p = claimLegacy(defaultProfile(), "forbidden_echo");
    expect(getUnlockedBossIds(p)).toEqual(new Set(["thrones_echo"]));
    expect(getUnlockedVariantIds(p)).toEqual(new Set());
    expect(getUnlockedOathIds(p)).toEqual(new Set());
  });

  it("reclamar Bolsillos Vacíos desbloquea la variante empty_pockets", () => {
    const p = claimLegacy(defaultProfile(), "empty_pockets_legacy");
    expect(getUnlockedVariantIds(p)).toEqual(new Set(["empty_pockets"]));
  });

  it("reclamar El Velo del Trono desbloquea el juramento veil_of_the_throne", () => {
    const p = claimLegacy(defaultProfile(), "veil_of_the_throne_legacy");
    expect(getUnlockedOathIds(p)).toEqual(new Set(["veil_of_the_throne"]));
  });

  it("reclamar los 3 implementados los desbloquea todos simultáneamente", () => {
    let p = defaultProfile();
    p = claimLegacy(p, "forbidden_echo");
    p = claimLegacy(p, "empty_pockets_legacy");
    p = claimLegacy(p, "veil_of_the_throne_legacy");
    expect(getUnlockedBossIds(p)).toEqual(new Set(["thrones_echo"]));
    expect(getUnlockedVariantIds(p)).toEqual(new Set(["empty_pockets"]));
    expect(getUnlockedOathIds(p)).toEqual(new Set(["veil_of_the_throne"]));
  });
});
