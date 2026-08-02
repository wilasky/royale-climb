import { describe, it, expect } from "vitest";
import { buildCoronationRecord, finalBossNameOf } from "./coronation";
import type { GameState, Relic } from "./types";

function relic(id: string, rarity: Relic["rarity"] = "common"): Relic {
  return { id, name: id, desc: "", rarity, icon: "•" };
}

function baseGs(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 42,
    round: 9,
    ante: 3,
    money: 20,
    deck: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    relics: [],
    handsLeft: 4,
    discardsLeft: 3,
    handsPerRound: 4,
    discardsPerRound: 3,
    handSize: 8,
    scoreThisRound: 8500,
    target: 8500,
    discardsUsedThisRound: 0,
    permaMult: 0,
    history: [],
    endless: false,
    stats: { handsPlayed: 30, bestHand: 4200, totalScore: 30000 },
    banishedRelicIds: [],
    activeBossId: "split_throne",
    bossState: {},
    oathId: null,
    ...overrides,
  };
}

describe("buildCoronationRecord", () => {
  it("extrae seed, puntuación, boss final y juramento del GameState", () => {
    const gs = baseGs({ seed: 777, oathId: "veil_of_the_throne" });
    const record = buildCoronationRecord(gs);
    expect(record.seed).toBe(777);
    expect(record.score).toBe(30000);
    expect(record.finalBossId).toBe("split_throne");
    expect(record.oathId).toBe("veil_of_the_throne");
    expect(record.continuedEndless).toBe(false);
    expect(typeof record.date).toBe("string");
    expect(() => new Date(record.date).toISOString()).not.toThrow();
  });

  it("recoge los ids de los modificadores activos", () => {
    const gs = baseGs({ relics: [relic("straight_mult"), relic("interest")] });
    const record = buildCoronationRecord(gs);
    expect(record.activeModifierIds).toEqual(["straight_mult", "interest"]);
  });

  it("sin arquetipo dominante claro, dominantBuild es null", () => {
    const gs = baseGs({ relics: [relic("straight_mult")] }); // 1 sola pieza: no llega a SYNERGY_MIN_AFFINITY
    const record = buildCoronationRecord(gs);
    expect(record.dominantBuild).toBeNull();
  });

  it("con solo 1 pieza de cada arquetipo distinto, ninguno domina (dominantBuild null)", () => {
    const gs = baseGs({
      relics: [relic("straight_mult"), relic("flush_chips")],
    });
    // straight_mult -> STRAIGHT, flush_chips -> FLUSH: 1 cada uno, ninguno llega a SYNERGY_MIN_AFFINITY.
    const record = buildCoronationRecord(gs);
    expect(record.dominantBuild).toBeNull();
  });

  it("no muta el GameState recibido", () => {
    const gs = baseGs({ relics: [relic("straight_mult")] });
    const before = structuredClone(gs);
    buildCoronationRecord(gs);
    expect(gs).toEqual(before);
  });
});

describe("finalBossNameOf", () => {
  it("resuelve el nombre legible de un boss conocido", () => {
    const record = buildCoronationRecord(baseGs({ activeBossId: "split_throne" }));
    expect(finalBossNameOf(record)).toBe("El Trono Partido");
  });

  it("devuelve null si no hay boss final registrado", () => {
    const record = buildCoronationRecord(baseGs({ activeBossId: null }));
    expect(finalBossNameOf(record)).toBeNull();
  });
});
