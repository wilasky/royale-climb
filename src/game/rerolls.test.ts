import { describe, it, expect } from "vitest";
import { rerollCost, canReroll } from "./rerolls";
import {
  REWARD_REROLL_COSTS,
  REWARD_REROLL_MAX,
  SHOP_REROLL_COSTS,
  SHOP_REROLL_MAX,
} from "./config";

describe("rerollCost - recompensa (3$/5$/7$, máx 3)", () => {
  it("coste 3$ en el primer reroll", () => {
    expect(rerollCost(REWARD_REROLL_COSTS, 0)).toBe(3);
  });
  it("coste 5$ en el segundo reroll", () => {
    expect(rerollCost(REWARD_REROLL_COSTS, 1)).toBe(5);
  });
  it("coste 7$ en el tercer reroll", () => {
    expect(rerollCost(REWARD_REROLL_COSTS, 2)).toBe(7);
  });
});

describe("rerollCost - tienda (3$/5$/7$/7$, máx 4)", () => {
  it("coste 3$/5$/7$ en los tres primeros", () => {
    expect(rerollCost(SHOP_REROLL_COSTS, 0)).toBe(3);
    expect(rerollCost(SHOP_REROLL_COSTS, 1)).toBe(5);
    expect(rerollCost(SHOP_REROLL_COSTS, 2)).toBe(7);
  });
  it("el cuarto reroll reutiliza el último coste de la tabla (7$)", () => {
    expect(rerollCost(SHOP_REROLL_COSTS, 3)).toBe(7);
  });
});

describe("canReroll - máximo de intentos", () => {
  it("permite rerollear por debajo del máximo con dinero suficiente", () => {
    expect(canReroll(0, REWARD_REROLL_MAX, 100, REWARD_REROLL_COSTS)).toBe(true);
    expect(canReroll(2, REWARD_REROLL_MAX, 100, REWARD_REROLL_COSTS)).toBe(true);
  });

  it("bloquea al alcanzar el máximo de recompensa (3)", () => {
    expect(canReroll(3, REWARD_REROLL_MAX, 100, REWARD_REROLL_COSTS)).toBe(false);
  });

  it("bloquea al alcanzar el máximo de tienda (4)", () => {
    expect(canReroll(4, SHOP_REROLL_MAX, 100, SHOP_REROLL_COSTS)).toBe(false);
    expect(canReroll(3, SHOP_REROLL_MAX, 100, SHOP_REROLL_COSTS)).toBe(true);
  });
});

describe("canReroll - dinero insuficiente", () => {
  it("no permite rerollear sin dinero suficiente para el coste del siguiente intento", () => {
    expect(canReroll(0, REWARD_REROLL_MAX, 2, REWARD_REROLL_COSTS)).toBe(false);
    expect(canReroll(0, REWARD_REROLL_MAX, 3, REWARD_REROLL_COSTS)).toBe(true);
  });

  it("el segundo reroll exige el coste más alto (5$), aunque el primero costara solo 3$", () => {
    expect(canReroll(1, REWARD_REROLL_MAX, 4, REWARD_REROLL_COSTS)).toBe(false);
    expect(canReroll(1, REWARD_REROLL_MAX, 5, REWARD_REROLL_COSTS)).toBe(true);
  });
});
