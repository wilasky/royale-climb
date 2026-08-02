import { describe, it, expect } from "vitest";
import { canBanish, banishCost, applyBanish, isBanished } from "./banish";
import { BANISH_MAX, BANISH_COSTS } from "./config";

describe("canBanish - máximo por run", () => {
  it("permite desterrar por debajo del máximo (2)", () => {
    expect(canBanish([], BANISH_MAX)).toBe(true);
    expect(canBanish(["a"], BANISH_MAX)).toBe(true);
  });
  it("bloquea al alcanzar el máximo", () => {
    expect(canBanish(["a", "b"], BANISH_MAX)).toBe(false);
  });
});

describe("banishCost - primero gratis, segundo 5$", () => {
  it("el primer destierro es gratis", () => {
    expect(banishCost([], BANISH_COSTS)).toBe(0);
  });
  it("el segundo destierro cuesta 5$", () => {
    expect(banishCost(["a"], BANISH_COSTS)).toBe(5);
  });
  it("reutiliza el último coste de la tabla si se superara su longitud", () => {
    expect(banishCost(["a", "b", "c"], BANISH_COSTS)).toBe(5);
  });
});

describe("applyBanish - no muta y no duplica", () => {
  it("añade el id a una lista nueva sin mutar la original", () => {
    const original = ["a"];
    const result = applyBanish(original, "b");
    expect(result).toEqual(["a", "b"]);
    expect(original).toEqual(["a"]); // sin mutar
    expect(result).not.toBe(original);
  });

  it("desterrar el mismo id dos veces no lo duplica", () => {
    const once = applyBanish([], "a");
    const twice = applyBanish(once, "a");
    expect(twice).toEqual(["a"]);
  });
});

describe("isBanished", () => {
  it("detecta si un id está en la lista de desterrados", () => {
    expect(isBanished(["a", "b"], "a")).toBe(true);
    expect(isBanished(["a", "b"], "c")).toBe(false);
    expect(isBanished([], "a")).toBe(false);
  });
});

describe("un modificador desterrado no vuelve a aparecer en ofertas futuras", () => {
  it("excluir el id desterrado del pool impide que vuelva a salir seleccionado", async () => {
    const { pickRelics } = await import("./rewards");
    const { makeRng } = await import("./rng");
    const pool = [
      { id: "a", name: "A", desc: "", rarity: "common" as const, icon: "•" },
      { id: "b", name: "B", desc: "", rarity: "common" as const, icon: "•" },
    ];
    const weights = { common: 100, rare: 0, epic: 0, legendary: 0 };
    const banished = applyBanish([], "a");
    const excludeIds = new Set(banished);
    for (let seed = 0; seed < 20; seed++) {
      const rng = makeRng(seed);
      const picks = pickRelics(rng, pool, excludeIds, 1, weights);
      expect(picks.every((r) => r.id !== "a")).toBe(true);
    }
  });
});
