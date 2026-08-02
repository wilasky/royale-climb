import { describe, it, expect } from "vitest";
import { pickRelicOffer } from "./offers";
import { pickRelics } from "./rewards";
import { makeRng } from "./rng";
import type { Relic, Rarity } from "./types";
import type { RarityWeights } from "./config";
import { SYNERGY_BONUS } from "./config";

function relic(id: string, rarity: Rarity = "common"): Relic {
  return { id, name: id, desc: "", rarity, icon: "•" };
}

const UNIFORM_WEIGHTS: RarityWeights = {
  common: 100,
  rare: 100,
  epic: 100,
  legendary: 100,
};

const PHASE_1_WEIGHTS: RarityWeights = {
  common: 70,
  rare: 25,
  epic: 5,
  legendary: 0,
};

describe("synergy bias - mecanismo de peso (pickRelics + weightMultiplier)", () => {
  it("aumenta estadísticamente la aparición del candidato con bonus, sin garantizarla", () => {
    const pool = [relic("related"), relic("unrelated")];
    const multiplier = (r: Relic) => (r.id === "related" ? 1 + SYNERGY_BONUS : 1);

    let relatedCount = 0;
    const trials = 600;
    for (let seed = 0; seed < trials; seed++) {
      const rng = makeRng(seed * 9973 + 1);
      const [pick] = pickRelics(rng, pool, new Set(), 1, UNIFORM_WEIGHTS, multiplier);
      if (pick.id === "related") relatedCount++;
    }
    const proportion = relatedCount / trials;

    // Sin sesgo, la proporción esperada es 0.5. Con +30% de peso,
    // la probabilidad teórica es 1.3 / 2.3 ≈ 0.565. Tolerancia amplia
    // para evitar un test flaky, pero claramente por encima de 0.5 y
    // claramente por debajo de 1 (nunca garantizado).
    expect(proportion).toBeGreaterThan(0.52);
    expect(proportion).toBeLessThan(0.95);
  });

  it("sin bonus (weightMultiplier ausente), la proporción no se desvía del reparto uniforme", () => {
    const pool = [relic("a"), relic("b")];
    let aCount = 0;
    const trials = 600;
    for (let seed = 0; seed < trials; seed++) {
      const rng = makeRng(seed * 7919 + 3);
      const [pick] = pickRelics(rng, pool, new Set(), 1, UNIFORM_WEIGHTS);
      if (pick.id === "a") aCount++;
    }
    const proportion = aCount / trials;
    expect(proportion).toBeGreaterThan(0.42);
    expect(proportion).toBeLessThan(0.58);
  });

  it("no salta las restricciones de fase: un candidato legendario con bonus sigue en peso 0 en fase 1", () => {
    const pool = [relic("legendary_related", "legendary"), relic("common_unrelated", "common")];
    const multiplier = (r: Relic) =>
      r.id === "legendary_related" ? 1 + SYNERGY_BONUS : 1;

    for (let seed = 0; seed < 200; seed++) {
      const rng = makeRng(seed * 104729 + 5);
      const [pick] = pickRelics(
        rng,
        pool,
        new Set(),
        1,
        PHASE_1_WEIGHTS,
        multiplier
      );
      expect(pick.id).not.toBe("legendary_related");
    }
  });
});

describe("pickRelicOffer - determinismo", () => {
  it("misma seed y mismas decisiones producen el mismo resultado", () => {
    const pool = [
      relic("pair_mult"),
      relic("flush_chips"),
      relic("straight_mult"),
      relic("clubs_chip"),
      relic("diamonds_money"),
    ];
    const currentRelics = [relic("spades_chip"), relic("hearts_mult")];

    const run = () =>
      pickRelicOffer(
        makeRng(42),
        pool,
        new Set(),
        3,
        PHASE_1_WEIGHTS,
        currentRelics
      ).map((r) => r.id);

    expect(run()).toEqual(run());
  });
});

describe("pickRelicOffer - garantía de variedad (mejor esfuerzo, sección 6)", () => {
  const pool = [
    relic("flush_chips"), // FLUSH, relacionado
    relic("clubs_chip"), // FLUSH, relacionado
    relic("diamonds_money"), // FLUSH secundario, relacionado
    relic("pair_mult"), // PAIR, no relacionado
    relic("straight_mult"), // STRAIGHT, no relacionado
    relic("low_card_chip"), // LOW_CARDS, no relacionado
    relic("first_hand_mult"), // FIRST_HAND, no relacionado
  ];
  // Dominante FLUSH: 2 piezas ya poseídas (spades_chip, hearts_mult).
  const currentRelics = [relic("spades_chip"), relic("hearts_mult")];

  it("intenta incluir al menos un candidato relacionado cuando el pool lo permite", () => {
    for (let seed = 0; seed < 30; seed++) {
      const offer = pickRelicOffer(
        makeRng(seed * 31 + 1),
        pool,
        new Set(),
        3,
        UNIFORM_WEIGHTS,
        currentRelics
      );
      const relatedIds = new Set(["flush_chips", "clubs_chip", "diamonds_money"]);
      expect(offer.some((r) => relatedIds.has(r.id))).toBe(true);
    }
  });

  it("no elimina candidatos generalistas: la oferta no se vuelve 100% relacionada si hay alternativa", () => {
    for (let seed = 0; seed < 30; seed++) {
      const offer = pickRelicOffer(
        makeRng(seed * 17 + 2),
        pool,
        new Set(),
        3,
        UNIFORM_WEIGHTS,
        currentRelics
      );
      const relatedIds = new Set(["flush_chips", "clubs_chip", "diamonds_money"]);
      const allRelated = offer.every((r) => relatedIds.has(r.id));
      expect(allRelated).toBe(false);
    }
  });

  it("sin arquetipo dominante, no aplica ninguna corrección de variedad", () => {
    const offer = pickRelicOffer(
      makeRng(1),
      pool,
      new Set(),
      3,
      UNIFORM_WEIGHTS,
      [] // sin modificadores activos, sin dominante
    );
    expect(offer.length).toBe(3);
  });

  it("si no queda ningún candidato relacionado en el pool, no falla ni duplica", () => {
    const onlyUnrelated = [relic("pair_mult"), relic("straight_mult")];
    const offer = pickRelicOffer(
      makeRng(7),
      onlyUnrelated,
      new Set(),
      2,
      UNIFORM_WEIGHTS,
      currentRelics
    );
    expect(offer.length).toBe(2);
    expect(new Set(offer.map((r) => r.id)).size).toBe(2);
  });

  it("mantiene la exclusión de modificadores poseídos y ausencia de duplicados", () => {
    const owned = new Set(currentRelics.map((r) => r.id));
    for (let seed = 0; seed < 10; seed++) {
      const offer = pickRelicOffer(
        makeRng(seed),
        pool,
        owned,
        3,
        UNIFORM_WEIGHTS,
        currentRelics
      );
      expect(offer.some((r) => owned.has(r.id))).toBe(false);
      expect(new Set(offer.map((r) => r.id)).size).toBe(offer.length);
    }
  });
});
