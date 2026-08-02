import { describe, it, expect } from "vitest";
import {
  VARIANT_EMPTY_POCKETS,
  getStartVariant,
  applyStartVariant,
} from "./variants";
import type { GameState } from "./types";

function baseGs(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    round: 1,
    ante: 1,
    money: 4,
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
    scoreThisRound: 0,
    target: 180,
    discardsUsedThisRound: 0,
    permaMult: 0,
    history: [],
    endless: false,
    stats: { handsPlayed: 0, bestHand: 0, totalScore: 0 },
    banishedRelicIds: [],
    activeBossId: null,
    bossState: {},
    oathId: null,
    ...overrides,
  };
}

describe("getStartVariant", () => {
  it("resuelve Bolsillos Vacíos por id", () => {
    expect(getStartVariant(VARIANT_EMPTY_POCKETS)?.name).toBe("Bolsillos Vacíos");
  });

  it("devuelve null para null y para un id desconocido", () => {
    expect(getStartVariant(null)).toBeNull();
    expect(getStartVariant("no_existe")).toBeNull();
  });
});

describe("Bolsillos Vacíos — efecto real", () => {
  it("resta 2$ al dinero inicial y suma 1 descarte por ronda", () => {
    const base = baseGs({ money: 4, discardsPerRound: 3 });
    const result = applyStartVariant(base, VARIANT_EMPTY_POCKETS);
    expect(result.money).toBe(2);
    expect(result.discardsPerRound).toBe(4);
  });

  it("no deja el dinero en negativo si el inicial fuera menor que 2", () => {
    const base = baseGs({ money: 1 });
    const result = applyStartVariant(base, VARIANT_EMPTY_POCKETS);
    expect(result.money).toBe(0);
  });

  it("no modifica ningún otro campo del GameState", () => {
    const base = baseGs({ money: 4, discardsPerRound: 3, handsPerRound: 4, target: 180 });
    const result = applyStartVariant(base, VARIANT_EMPTY_POCKETS);
    expect(result.handsPerRound).toBe(base.handsPerRound);
    expect(result.target).toBe(base.target); // objetivos de ronda intactos
    expect(result.handSize).toBe(base.handSize);
  });

  it("no muta el GameState recibido", () => {
    const base = baseGs({ money: 4, discardsPerRound: 3 });
    const before = structuredClone(base);
    applyStartVariant(base, VARIANT_EMPTY_POCKETS);
    expect(base).toEqual(before);
  });
});

describe("sin variante (id null) no afecta a las runs normales", () => {
  it("applyStartVariant con id null devuelve el GameState sin cambios", () => {
    const base = baseGs({ money: 4, discardsPerRound: 3 });
    const result = applyStartVariant(base, null);
    expect(result).toEqual(base);
  });

  it("un id desconocido tampoco cambia nada (no lanza)", () => {
    const base = baseGs({ money: 4, discardsPerRound: 3 });
    expect(applyStartVariant(base, "variante_futura_no_implementada")).toEqual(base);
  });
});
