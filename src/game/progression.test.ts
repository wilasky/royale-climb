import { describe, it, expect } from "vitest";
import {
  targetForRound,
  anteOfRound,
  isShopRound,
  phaseForRound,
  resolveAfterReward,
  resolveAfterShop,
  beginEndlessContinuation,
} from "./progression";
import { ROUNDS_PER_RUN } from "./config";

describe("flujo de una run - Nueva partida (no endless)", () => {
  it("no termina tras la ronda 3 (abre tienda)", () => {
    expect(resolveAfterReward(3, false)).toEqual({ type: "shop" });
  });

  it("no termina tras la ronda 6 (abre tienda)", () => {
    expect(resolveAfterReward(6, false)).toEqual({ type: "shop" });
  });

  it("termina en victoria tras la ronda 9", () => {
    expect(resolveAfterReward(ROUNDS_PER_RUN, false)).toEqual({
      type: "victory",
    });
  });

  it("continúa a la siguiente ronda en las rondas que no son de tienda ni la final", () => {
    for (const round of [1, 2, 4, 5, 7, 8]) {
      expect(resolveAfterReward(round, false)).toEqual({
        type: "next-round",
      });
    }
  });

  it("tras la tienda, continúa siempre a la ronda siguiente (nunca fuerza victoria)", () => {
    expect(resolveAfterShop(3)).toEqual({ nextRound: 4 });
    expect(resolveAfterShop(6)).toEqual({ nextRound: 7 });
  });

  it("continuar tras la victoria activa Endless y comienza en la ronda 10", () => {
    expect(beginEndlessContinuation(ROUNDS_PER_RUN)).toEqual({
      round: 10,
      endless: true,
    });
  });
});

describe("flujo de una run - Modo Endless", () => {
  it("no termina (nunca victoria) en las rondas 3, 6 o 9 - abre tienda en su lugar", () => {
    for (const round of [3, 6, 9]) {
      expect(resolveAfterReward(round, true)).toEqual({ type: "shop" });
    }
  });

  it("sigue sin terminar más allá de la ronda 9 en múltiplos de 3", () => {
    for (const round of [12, 15, 30]) {
      expect(resolveAfterReward(round, true)).toEqual({ type: "shop" });
    }
  });

  it("nunca devuelve 'victory' en modo endless, para ninguna ronda razonable", () => {
    for (let round = 1; round <= 40; round++) {
      expect(resolveAfterReward(round, true).type).not.toBe("victory");
    }
  });

  it("continúa a la siguiente ronda en rondas normales", () => {
    expect(resolveAfterReward(10, true)).toEqual({ type: "next-round" });
    expect(resolveAfterReward(11, true)).toEqual({ type: "next-round" });
  });
});

describe("tiendas en las rondas correctas", () => {
  it("isShopRound es true exactamente en múltiplos de 3", () => {
    expect(isShopRound(3)).toBe(true);
    expect(isShopRound(6)).toBe(true);
    expect(isShopRound(9)).toBe(true);
    expect(isShopRound(12)).toBe(true);
    for (const round of [1, 2, 4, 5, 7, 8, 10, 11]) {
      expect(isShopRound(round)).toBe(false);
    }
  });
});

describe("ante y fase de rareza", () => {
  it("agrupa 3 rondas por ante", () => {
    expect(anteOfRound(1)).toBe(1);
    expect(anteOfRound(3)).toBe(1);
    expect(anteOfRound(4)).toBe(2);
    expect(anteOfRound(6)).toBe(2);
    expect(anteOfRound(7)).toBe(3);
    expect(anteOfRound(9)).toBe(3);
    expect(anteOfRound(10)).toBe(4);
  });

  it("la fase de rareza tiene tope en 3 (ante 3 en adelante, incluido endless)", () => {
    expect(phaseForRound(1)).toBe(1);
    expect(phaseForRound(3)).toBe(1);
    expect(phaseForRound(4)).toBe(2);
    expect(phaseForRound(6)).toBe(2);
    expect(phaseForRound(7)).toBe(3);
    expect(phaseForRound(9)).toBe(3);
    expect(phaseForRound(20)).toBe(3);
  });
});

describe("curva de objetivo de puntuación", () => {
  it("coincide con los valores documentados para las rondas 1-9", () => {
    const expected = [200, 310, 481, 745, 1154, 1789, 2773, 4299, 6663];
    expected.forEach((value, i) => {
      expect(targetForRound(i + 1)).toBe(value);
    });
  });

  it("es estrictamente creciente (incluido más allá de la ronda 9, para endless)", () => {
    for (let round = 1; round < 15; round++) {
      expect(targetForRound(round + 1)).toBeGreaterThan(targetForRound(round));
    }
  });
});
