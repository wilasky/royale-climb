import { describe, it, expect } from "vitest";
import {
  RELIC_ARCHETYPES,
  ARCHETYPES,
  ARCHETYPE_LABELS,
  archetypesOfRelic,
  relicMatchesArchetype,
} from "./archetypes";

describe("clasificación de los 24 modificadores", () => {
  it("cataloga exactamente 24 modificadores", () => {
    expect(Object.keys(RELIC_ARCHETYPES).length).toBe(24);
  });

  it("cada entrada tiene un arquetipo primario válido y un rol reconocido", () => {
    const validRoles = new Set([
      "starter",
      "enabler",
      "payoff",
      "utility",
      "generalist",
    ]);
    for (const info of Object.values(RELIC_ARCHETYPES)) {
      expect(ARCHETYPES).toContain(info.primary);
      expect(validRoles.has(info.role)).toBe(true);
      for (const secondary of info.secondary) {
        expect(ARCHETYPES).toContain(secondary);
      }
    }
  });

  it("clasifica los starters de arquetipo directo correctamente", () => {
    expect(RELIC_ARCHETYPES.pair_mult).toEqual({
      primary: "PAIR",
      secondary: [],
      role: "starter",
    });
    expect(RELIC_ARCHETYPES.straight_mult.primary).toBe("STRAIGHT");
    expect(RELIC_ARCHETYPES.flush_chips.primary).toBe("FLUSH");
  });

  it("GENERAL agrupa los efectos universales (Bola de Nieve, Pacto de Sangre, El Coleccionista)", () => {
    expect(RELIC_ARCHETYPES.scaling_round.primary).toBe("GENERAL");
    expect(RELIC_ARCHETYPES.blood_pact.primary).toBe("GENERAL");
    expect(RELIC_ARCHETYPES.the_collector.primary).toBe("GENERAL");
  });
});

describe("modificadores multi-arquetipo", () => {
  it("Veta Dorada (diamonds_money) es ECONOMY con FLUSH como secundario", () => {
    expect(archetypesOfRelic("diamonds_money")).toEqual(["ECONOMY", "FLUSH"]);
    expect(relicMatchesArchetype("diamonds_money", "ECONOMY")).toBe(true);
    expect(relicMatchesArchetype("diamonds_money", "FLUSH")).toBe(true);
    expect(relicMatchesArchetype("diamonds_money", "PAIR")).toBe(false);
  });

  it("Reciclaje (discard_refund) es ECONOMY con NO_DISCARD como secundario", () => {
    expect(archetypesOfRelic("discard_refund")).toEqual([
      "ECONOMY",
      "NO_DISCARD",
    ]);
  });
});

describe("archetypesOfRelic / relicMatchesArchetype", () => {
  it("un modificador sin catalogar devuelve una lista vacía", () => {
    expect(archetypesOfRelic("no-existe")).toEqual([]);
    expect(relicMatchesArchetype("no-existe", "PAIR")).toBe(false);
  });
});

describe("etiquetas de arquetipo", () => {
  it("hay una etiqueta en castellano para cada arquetipo, incluido GENERAL", () => {
    for (const archetype of ARCHETYPES) {
      expect(typeof ARCHETYPE_LABELS[archetype]).toBe("string");
      expect(ARCHETYPE_LABELS[archetype].length).toBeGreaterThan(0);
    }
  });
});
