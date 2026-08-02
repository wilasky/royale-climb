import { describe, it, expect } from "vitest";
import {
  affinityStrength,
  computeArchetypeCounts,
  computeBuildIdentity,
  dominantArchetypes,
  topAffinities,
} from "./buildIdentity";
import type { Relic } from "./types";

function relic(id: string): Relic {
  return { id, name: id, desc: "", rarity: "common", icon: "•" };
}

describe("affinityStrength", () => {
  it("0 piezas = sin afinidad, 1 = débil, 2 = afinidad, 3+ = orientada", () => {
    expect(affinityStrength(0)).toBe("none");
    expect(affinityStrength(1)).toBe("weak");
    expect(affinityStrength(2)).toBe("moderate");
    expect(affinityStrength(3)).toBe("strong");
    expect(affinityStrength(5)).toBe("strong");
  });
});

describe("computeArchetypeCounts", () => {
  it("cuenta piezas por arquetipo, incluidos los secundarios", () => {
    const relics = [relic("pair_mult"), relic("pair_chain"), relic("diamonds_money")];
    const counts = computeArchetypeCounts(relics);
    expect(counts.PAIR).toBe(2);
    expect(counts.ECONOMY).toBe(1);
    expect(counts.FLUSH).toBe(1); // secundario de diamonds_money
  });

  it("sin modificadores no hay ningún conteo", () => {
    expect(computeArchetypeCounts([])).toEqual({});
  });
});

describe("computeBuildIdentity - detección de build dominante", () => {
  it("detecta el arquetipo con más piezas como dominante", () => {
    const relics = [
      relic("pair_mult"),
      relic("pair_chain"),
      relic("straight_mult"),
    ];
    const identity = computeBuildIdentity(relics);
    expect(identity.dominant).toBe("PAIR");
    const pairAffinity = identity.affinities.find((a) => a.archetype === "PAIR");
    expect(pairAffinity).toEqual({ archetype: "PAIR", count: 2, strength: "moderate" });
  });

  it("sin modificadores no hay arquetipo dominante", () => {
    expect(computeBuildIdentity([]).dominant).toBeNull();
    expect(computeBuildIdentity([]).affinities).toEqual([]);
  });

  it("GENERAL nunca domina una build, aunque tenga más piezas que el resto", () => {
    const relics = [
      relic("scaling_round"), // GENERAL
      relic("blood_pact"), // GENERAL
      relic("the_collector"), // GENERAL
      relic("even_odd"), // GENERAL
      relic("pair_mult"), // PAIR, una sola pieza
    ];
    const identity = computeBuildIdentity(relics);
    // GENERAL tiene 4 piezas, más que cualquier otro arquetipo presente,
    // pero no puede ser el dominante.
    const generalAffinity = identity.affinities.find((a) => a.archetype === "GENERAL");
    expect(generalAffinity?.count).toBe(4);
    expect(identity.dominant).toBe("PAIR");
  });

  it("si solo hay piezas GENERAL, no hay arquetipo dominante", () => {
    const relics = [relic("scaling_round"), relic("blood_pact")];
    expect(computeBuildIdentity(relics).dominant).toBeNull();
  });
});

describe("dominantArchetypes", () => {
  it("solo devuelve arquetipos con al menos minCount piezas, excluyendo GENERAL", () => {
    const relics = [
      relic("pair_mult"),
      relic("pair_chain"),
      relic("straight_mult"), // 1 sola pieza de STRAIGHT
      relic("scaling_round"), // GENERAL
    ];
    expect(dominantArchetypes(relics, 2, 2)).toEqual(["PAIR"]);
  });

  it("respeta el máximo de etiquetas devueltas", () => {
    const relics = [
      relic("pair_mult"),
      relic("pair_chain"),
      relic("straight_mult"),
      relic("first_hand_mult"),
      relic("flush_chips"),
      relic("spades_chip"),
    ];
    // PAIR:2, STRAIGHT:1, FIRST_HAND:1, FLUSH:2 -> con minCount=1 hay 4
    // candidatos, pero max=2 limita el resultado.
    expect(dominantArchetypes(relics, 1, 2).length).toBe(2);
  });
});

describe("topAffinities (Iteración 2G, sección 1: panel de build)", () => {
  it("coincide exactamente con las afinidades que calcula computeBuildIdentity", () => {
    const relics = [relic("pair_mult"), relic("pair_chain"), relic("straight_mult")];
    const { affinities } = computeBuildIdentity(relics);
    const expected = affinities.filter((a) => a.archetype !== "GENERAL").slice(0, 2);
    expect(topAffinities(relics, 2)).toEqual(expected);
  });

  it("GENERAL nunca aparece, aunque tenga más piezas que el resto", () => {
    const relics = [
      relic("scaling_round"),
      relic("blood_pact"),
      relic("the_collector"),
      relic("pair_mult"),
    ];
    const shown = topAffinities(relics, 2);
    expect(shown.every((a) => a.archetype !== "GENERAL")).toBe(true);
    expect(shown).toEqual([{ archetype: "PAIR", count: 1, strength: "weak" }]);
  });

  it("respeta el máximo — nunca devuelve más de `max` arquetipos", () => {
    const relics = [
      relic("pair_mult"),
      relic("straight_mult"),
      relic("flush_chips"),
      relic("first_hand_mult"),
    ];
    expect(topAffinities(relics, 2).length).toBe(2);
    expect(topAffinities(relics, 1).length).toBe(1);
  });

  it("sin modificadores, no muestra ninguna afinidad", () => {
    expect(topAffinities([], 2)).toEqual([]);
  });

  it("no tiene umbral mínimo de piezas — una sola pieza ya se muestra (a diferencia de dominantArchetypes)", () => {
    const relics = [relic("pair_mult")];
    expect(topAffinities(relics, 2)).toEqual([
      { archetype: "PAIR", count: 1, strength: "weak" },
    ]);
    expect(dominantArchetypes(relics, 2, 2)).toEqual([]);
  });
});
