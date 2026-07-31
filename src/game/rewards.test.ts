import { describe, it, expect } from "vitest";
import { pickRelics } from "./rewards";
import { makeRng } from "./rng";
import { REWARD_WEIGHTS, SHOP_WEIGHTS } from "./config";
import type { Relic } from "./types";

/** Pool sintético de prueba: 6 común, 6 rara, 6 épica, 6 legendaria. */
function makePool(): Relic[] {
  const pool: Relic[] = [];
  (["common", "rare", "epic", "legendary"] as const).forEach((rarity) => {
    for (let i = 0; i < 6; i++) {
      pool.push({
        id: `${rarity}-${i}`,
        name: `${rarity} ${i}`,
        desc: "",
        rarity,
        icon: "•",
      });
    }
  });
  return pool;
}

describe("pickRelics - reglas estructurales", () => {
  it("nunca devuelve duplicados en una misma oferta", () => {
    const pool = makePool();
    const rng = makeRng(42);
    const picks = pickRelics(rng, pool, new Set(), 3, REWARD_WEIGHTS[3]);
    const ids = picks.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nunca ofrece un modificador ya poseído", () => {
    const pool = makePool();
    const owned = new Set(["common-0", "rare-0", "epic-0"]);
    const rng = makeRng(7);
    for (let trial = 0; trial < 20; trial++) {
      const picks = pickRelics(rng, pool, owned, 3, REWARD_WEIGHTS[3]);
      for (const p of picks) {
        expect(owned.has(p.id)).toBe(false);
      }
    }
  });

  it("no ofrece más elementos de los disponibles si el pool restante es menor que count", () => {
    const pool = makePool();
    const owned = new Set(pool.slice(1).map((r) => r.id)); // solo queda 1
    const rng = makeRng(1);
    const picks = pickRelics(rng, pool, owned, 3, REWARD_WEIGHTS[1]);
    expect(picks.length).toBe(1);
  });
});

describe("pickRelics - restricción de legendarios en rondas iniciales", () => {
  it("la fase 1 (peso legendario = 0) nunca entrega un legendario en muchas tiradas", () => {
    const pool = makePool();
    const rng = makeRng(123);
    let sawLegendary = false;
    for (let trial = 0; trial < 500; trial++) {
      const picks = pickRelics(rng, pool, new Set(), 3, REWARD_WEIGHTS[1]);
      if (picks.some((p) => p.rarity === "legendary")) sawLegendary = true;
    }
    expect(sawLegendary).toBe(false);
  });
});

describe("pickRelics - los pesos cambian según la fase", () => {
  it("la fase 3 entrega legendarios con frecuencia notable, a diferencia de la fase 1", () => {
    const pool = makePool();
    const rngPhase1 = makeRng(9);
    const rngPhase3 = makeRng(9);
    let legendaryCountPhase1 = 0;
    let legendaryCountPhase3 = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const p1 = pickRelics(rngPhase1, pool, new Set(), 3, REWARD_WEIGHTS[1]);
      const p3 = pickRelics(rngPhase3, pool, new Set(), 3, REWARD_WEIGHTS[3]);
      if (p1.some((r) => r.rarity === "legendary")) legendaryCountPhase1++;
      if (p3.some((r) => r.rarity === "legendary")) legendaryCountPhase3++;
    }
    expect(legendaryCountPhase1).toBe(0);
    // tolerancia razonable: con peso 13/100 aprox por slot y 3 slots,
    // se espera una fracción notable de tiradas con al menos un legendario.
    expect(legendaryCountPhase3).toBeGreaterThan(trials * 0.15);
  });

  it("los pesos de tienda son un objeto distinto de los de recompensa (tabla propia)", () => {
    expect(SHOP_WEIGHTS).not.toBe(REWARD_WEIGHTS);
  });
});

describe("pickRelics - determinismo", () => {
  it("la misma semilla y las mismas decisiones producen las mismas ofertas", () => {
    const pool = makePool();
    const owned = new Set(["common-1"]);
    const runOnce = () => {
      const rng = makeRng(777);
      const first = pickRelics(rng, pool, owned, 3, REWARD_WEIGHTS[2]);
      const second = pickRelics(rng, pool, owned, 2, SHOP_WEIGHTS[2]);
      return [first.map((r) => r.id), second.map((r) => r.id)];
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it("semillas distintas pueden (no necesariamente siempre) producir ofertas distintas", () => {
    const pool = makePool();
    const a = pickRelics(makeRng(1), pool, new Set(), 3, REWARD_WEIGHTS[3]);
    const b = pickRelics(makeRng(2), pool, new Set(), 3, REWARD_WEIGHTS[3]);
    // No exigimos que sean distintas (podría coincidir por azar), solo
    // que ambas sean válidas y deterministas por separado.
    expect(a.length).toBe(3);
    expect(b.length).toBe(3);
  });
});

describe("pickRelics - distribución compatible con los pesos (muestra grande, tolerancia amplia)", () => {
  it("con pesos iguales, cada rareza aparece con frecuencia similar en muchas tiradas", () => {
    const pool = makePool();
    const equalWeights = { common: 25, rare: 25, epic: 25, legendary: 25 };
    const rng = makeRng(555);
    const counts: Record<string, number> = {
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      const [pick] = pickRelics(rng, pool, new Set(), 1, equalWeights);
      counts[pick.rarity]++;
    }
    const expectedShare = trials / 4;
    for (const rarity of Object.keys(counts)) {
      // tolerancia amplia (+-30%) - no exigimos porcentajes exactos
      // en una muestra finita, solo que sea del orden esperado.
      expect(counts[rarity]).toBeGreaterThan(expectedShare * 0.7);
      expect(counts[rarity]).toBeLessThan(expectedShare * 1.3);
    }
  });
});
