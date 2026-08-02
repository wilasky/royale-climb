import { describe, it, expect } from "vitest";
import {
  targetForRound,
  anteOfRound,
  isShopRound,
  phaseForRound,
  resolveRoundReward,
  resolveAfterShop,
  beginEndlessContinuation,
  isBossRound,
  isFinalBossRound,
} from "./progression";
import { ROUNDS_PER_RUN } from "./config";

describe("cadencia de recompensas - Nueva partida (no endless)", () => {
  it("ronda 1: modificador", () => {
    expect(resolveRoundReward(1, false)).toEqual({ type: "relic" });
  });

  it("ronda 2: recompensa económica (fase 1, 6$)", () => {
    expect(resolveRoundReward(2, false)).toEqual({ type: "money", amount: 6 });
  });

  it("ronda 3: tienda", () => {
    expect(resolveRoundReward(3, false)).toEqual({ type: "shop" });
  });

  it("ronda 4: modificador", () => {
    expect(resolveRoundReward(4, false)).toEqual({ type: "relic" });
  });

  it("ronda 5: recompensa económica (fase 2, 9$)", () => {
    expect(resolveRoundReward(5, false)).toEqual({ type: "money", amount: 9 });
  });

  it("ronda 6: tienda", () => {
    expect(resolveRoundReward(6, false)).toEqual({ type: "shop" });
  });

  it("ronda 7: modificador", () => {
    expect(resolveRoundReward(7, false)).toEqual({ type: "relic" });
  });

  it("ronda 8: recompensa económica (fase 3, 12$)", () => {
    expect(resolveRoundReward(8, false)).toEqual({ type: "money", amount: 12 });
  });

  it("ronda 9: victoria (pisa el shop natural de round % 3 === 0)", () => {
    expect(resolveRoundReward(ROUNDS_PER_RUN, false)).toEqual({
      type: "victory",
    });
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

describe("cadencia de recompensas - Modo Endless", () => {
  it("extiende el mismo ciclo de 3 rondas indefinidamente más allá de la 9", () => {
    expect(resolveRoundReward(10, true)).toEqual({ type: "relic" });
    expect(resolveRoundReward(11, true)).toEqual({ type: "money", amount: 12 }); // fase 3
    expect(resolveRoundReward(12, true)).toEqual({ type: "shop" });
    expect(resolveRoundReward(13, true)).toEqual({ type: "relic" });
    expect(resolveRoundReward(14, true)).toEqual({ type: "money", amount: 12 });
    expect(resolveRoundReward(15, true)).toEqual({ type: "shop" });
  });

  it("no termina (nunca victoria) en las rondas 3, 6 o 9 - abre tienda en su lugar", () => {
    for (const round of [3, 6, 9]) {
      expect(resolveRoundReward(round, true)).toEqual({ type: "shop" });
    }
  });

  it("nunca devuelve 'victory' en modo endless, para ninguna ronda razonable", () => {
    for (let round = 1; round <= 40; round++) {
      expect(resolveRoundReward(round, true).type).not.toBe("victory");
    }
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

describe("rondas de boss - Iteración 2D", () => {
  it("las rondas 3, 6 y 9 son de boss en Nueva partida; las demás no", () => {
    expect(isBossRound(3, false)).toBe(true);
    expect(isBossRound(6, false)).toBe(true);
    expect(isBossRound(9, false)).toBe(true);
    for (const round of [1, 2, 4, 5, 7, 8]) {
      expect(isBossRound(round, false)).toBe(false);
    }
  });

  it("en Endless nunca hay boss, ni siquiera en múltiplos de 3", () => {
    for (const round of [3, 6, 9, 12, 15]) {
      expect(isBossRound(round, true)).toBe(false);
    }
  });

  it("solo la ronda 9 de Nueva partida es el boss final", () => {
    expect(isFinalBossRound(9, false)).toBe(true);
    for (const round of [3, 6, 8, 10]) {
      expect(isFinalBossRound(round, false)).toBe(false);
    }
    expect(isFinalBossRound(9, true)).toBe(false);
  });

  it("cada ronda de boss cae en el ante correcto (1, 2 y 3 respectivamente)", () => {
    expect(anteOfRound(3)).toBe(1);
    expect(anteOfRound(6)).toBe(2);
    expect(anteOfRound(9)).toBe(3);
  });

  it("las rondas de boss siguen abriendo tienda al superarlas", () => {
    for (const round of [3, 6, 9]) {
      expect(resolveRoundReward(round, false).type).toBe(
        round === 9 ? "victory" : "shop"
      );
    }
  });

  it("la ronda 9 sigue llevando a victoria (no queda atrapada como boss)", () => {
    expect(resolveRoundReward(9, false)).toEqual({ type: "victory" });
  });
});

describe("curva de objetivo de puntuación", () => {
  it("coincide con los valores documentados para las rondas 1-9", () => {
    const expected = [180, 280, 450, 700, 1050, 1900, 3200, 5200, 8500];
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
