import { describe, it, expect } from "vitest";
import { scorePlay, glassRisk, diamondMoneyPreview, evaluateHand } from "./scoring";
import type { Card, GameState, Relic } from "./types";

let idCounter = 0;
function card(overrides: Partial<Card>): Card {
  idCounter++;
  return {
    id: `c${idCounter}`,
    suit: "spades",
    rank: 2,
    bonusChips: 0,
    glass: false,
    steel: false,
    gold: false,
    ...overrides,
  };
}

function relic(id: string, rarity: Relic["rarity"] = "common"): Relic {
  return { id, name: id, desc: "", rarity, icon: "•" };
}

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
    target: 200,
    discardsUsedThisRound: 0,
    permaMult: 0,
    history: [],
    endless: false,
    stats: { handsPlayed: 0, bestHand: 0, totalScore: 0 },
    banishedRelicIds: [],
    ...overrides,
  };
}

describe("scorePlay - preview y ejecución son la misma función pura", () => {
  it("llamar dos veces con los mismos argumentos da el mismo resultado", () => {
    const played = [card({ rank: 5, suit: "hearts" }), card({ rank: 5, suit: "clubs" })];
    const held = [card({ rank: 9 })];
    const gs = baseGs({ relics: [relic("hearts_mult")] });

    const a = scorePlay(played, held, gs, true, false);
    const b = scorePlay(played, held, gs, true, false);
    expect(a).toEqual(b);
  });

  it("no muta played, heldInHand ni gs", () => {
    const played = [card({ rank: 5 }), card({ rank: 5 })];
    const held = [card({ rank: 9, steel: true })];
    const gs = baseGs({ relics: [relic("no_discard_mult")] });

    const playedBefore = structuredClone(played);
    const heldBefore = structuredClone(held);
    const gsBefore = structuredClone(gs);

    scorePlay(played, held, gs, true, true);

    expect(played).toEqual(playedBefore);
    expect(held).toEqual(heldBefore);
    expect(gs).toEqual(gsBefore);
  });
});

describe("scorePlay - acero mantenido en mano", () => {
  it("una carta de acero en heldInHand añade +1.5 Mult y aparece en el desglose", () => {
    const played = [card({ rank: 10 })];
    const held = [card({ rank: 3, steel: true })];
    const gs = baseGs();
    const result = scorePlay(played, held, gs, false, false);
    // Carta alta: baseMult=1, +1.5 por una carta de acero = 2.5
    expect(result.mult).toBe(2.5);
    expect(result.lines.some((l) => l.includes("Núcleo de Acero"))).toBe(true);
  });

  it("dos cartas de acero suman +3 Mult", () => {
    const played = [card({ rank: 10 })];
    const held = [card({ rank: 3, steel: true }), card({ rank: 4, steel: true })];
    const result = scorePlay(played, held, baseGs(), false, false);
    expect(result.mult).toBe(4); // 1 + 3
  });
});

describe("scorePlay - cristal", () => {
  it("una carta de cristal jugada dobla su valor de ficha sin consumir RNG", () => {
    const glassCard = card({ rank: 10, glass: true }); // valor base 10
    const plain = card({ rank: 10 });
    const withGlass = scorePlay([glassCard], [], baseGs(), false, false);
    const withoutGlass = scorePlay([plain], [], baseGs(), false, false);
    // Carta alta: base 5 fichas + valor de carta. Con cristal, el valor de
    // carta se duplica (x2 sin Maestro del Vidrio).
    expect(withGlass.chips - 5).toBe((withoutGlass.chips - 5) * 2);
    expect(withGlass.lines.some((l) => l.toLowerCase().includes("cristal"))).toBe(
      true
    );
  });

  it("con Maestro del Vidrio el multiplicador de cristal es x4, no x2", () => {
    const glassCard = card({ rank: 10, glass: true });
    const gs = baseGs({ relics: [relic("glass_master", "epic")] });
    const result = scorePlay([glassCard], [], gs, false, false);
    expect(result.chips - 5).toBe(10 * 4);
  });

  it("glassRisk no consume RNG (es determinista sin generador) y refleja inmunidad", () => {
    const glassCard = card({ rank: 10, glass: true });
    const noRelics = glassRisk([glassCard], []);
    expect(noRelics).toEqual({ count: 1, breakChancePercent: 25, immune: false });

    const withMaster = glassRisk([glassCard], [relic("glass_master", "epic")]);
    expect(withMaster).toEqual({ count: 1, breakChancePercent: 0, immune: true });
  });
});

describe("scorePlay - primera y última mano", () => {
  it("aplica Salida en Falso solo cuando isFirstHand es true", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({ relics: [relic("first_hand_mult", "rare")] });
    const first = scorePlay(played, [], gs, true, false);
    const notFirst = scorePlay(played, [], gs, false, false);
    expect(first.mult).toBe(3); // baseMult 1 * 3
    expect(notFirst.mult).toBe(1);
  });

  it("aplica Última Palabra solo cuando isLastHand es true", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({ relics: [relic("final_hand", "legendary")] });
    const last = scorePlay(played, [], gs, false, true);
    const notLast = scorePlay(played, [], gs, false, false);
    expect(last.mult).toBe(4);
    expect(notLast.mult).toBe(1);
  });
});

describe("scorePlay - modificadores dependientes de no haber descartado", () => {
  it("Mano Firme solo aplica si discardsUsedThisRound es 0", () => {
    const played = [card({ rank: 10 })];
    const relics = [relic("no_discard_mult", "rare")];
    const clean = scorePlay(played, [], baseGs({ relics, discardsUsedThisRound: 0 }), false, false);
    const dirty = scorePlay(played, [], baseGs({ relics, discardsUsedThisRound: 1 }), false, false);
    expect(clean.mult).toBe(2);
    expect(dirty.mult).toBe(1);
  });
});

describe("scorePlay - multiplicador permanente", () => {
  it("Bola de Nieve (permaMult) se suma y aparece en el desglose", () => {
    const played = [card({ rank: 10 })];
    const result = scorePlay(played, [], baseGs({ permaMult: 2.5 }), false, false);
    expect(result.mult).toBe(3.5); // 1 + 2.5
    expect(result.lines.some((l) => l.includes("Bola de Nieve"))).toBe(true);
  });
});

describe("scorePlay - desglose de modificadores activos", () => {
  it("cada modificador activo aparece como línea en el desglose", () => {
    const played = [
      card({ rank: 10, suit: "spades" }),
      card({ rank: 10, suit: "spades" }),
    ];
    const gs = baseGs({ relics: [relic("spades_chip"), relic("pair_mult")] });
    const result = scorePlay(played, [], gs, false, false);
    expect(result.lines.some((l) => l.includes("Filo Negro"))).toBe(true);
    expect(result.lines.some((l) => l.includes("Eco Gemelo"))).toBe(true);
  });

  it("las mejoras de carta (bonusChips) se reflejan en una línea propia", () => {
    const played = [card({ rank: 5, bonusChips: 30 })];
    const result = scorePlay(played, [], baseGs(), false, false);
    expect(result.lines.some((l) => l.includes("Mejoras de carta"))).toBe(true);
  });
});

describe("diamondMoneyPreview", () => {
  it("devuelve 0 sin el modificador Veta Dorada", () => {
    const played = [card({ suit: "diamonds", rank: 5 })];
    expect(diamondMoneyPreview(played, [])).toBe(0);
  });

  it("cuenta diamantes jugados con Veta Dorada, sin afectar a la puntuación", () => {
    const played = [
      card({ suit: "diamonds", rank: 5 }),
      card({ suit: "diamonds", rank: 6 }),
      card({ suit: "spades", rank: 7 }),
    ];
    const relics = [relic("diamonds_money")];
    expect(diamondMoneyPreview(played, relics)).toBe(2);

    const withMoney = scorePlay(played, [], baseGs({ relics }), false, false);
    const withoutRelic = scorePlay(played, [], baseGs(), false, false);
    // El dinero no debe alterar chips/mult/total.
    expect(withMoney.total).toBe(withoutRelic.total);
  });
});

describe("scorePlay - Equilibrio Par (even_odd)", () => {
  it("todas las cartas pares sin As: ×3 Mult", () => {
    const played = [card({ rank: 4 }), card({ rank: 8 })];
    const gs = baseGs({ relics: [relic("even_odd", "epic")] });
    const result = scorePlay(played, [], gs, false, false);
    // Pareja no aplica (rangos distintos): Carta alta, baseMult=1 * 3 = 3.
    expect(result.mult).toBe(3);
    expect(result.lines.some((l) => l.includes("Equilibrio Par"))).toBe(true);
  });

  it("con un As presente ya no se activa (el As deja de contar como par)", () => {
    const played = [card({ rank: 14 }), card({ rank: 8 })];
    const gs = baseGs({ relics: [relic("even_odd", "epic")] });
    const result = scorePlay(played, [], gs, false, false);
    expect(result.mult).toBe(1);
    expect(result.lines.some((l) => l.includes("Equilibrio Par"))).toBe(false);
  });

  it("con una carta impar tampoco se activa", () => {
    const played = [card({ rank: 4 }), card({ rank: 5 })];
    const gs = baseGs({ relics: [relic("even_odd", "epic")] });
    const result = scorePlay(played, [], gs, false, false);
    expect(result.mult).toBe(1);
  });
});

describe("scorePlay - El Coleccionista (the_collector)", () => {
  it("suma +2 Mult por cada modificador poseído", () => {
    const played = [card({ rank: 10 })];
    const relics = [
      relic("the_collector", "legendary"),
      relic("spades_chip"),
      relic("hearts_mult"),
    ];
    const result = scorePlay(played, [], baseGs({ relics }), false, false);
    // baseMult 1 + 3 relics * 2 = 7
    expect(result.mult).toBe(7);
    expect(result.lines.some((l) => l.includes("El Coleccionista: +6 Mult"))).toBe(
      true
    );
  });

  it("con un solo modificador (él mismo) suma +2", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({ relics: [relic("the_collector", "legendary")] });
    const result = scorePlay(played, [], gs, false, false);
    expect(result.mult).toBe(3); // 1 + 1*2
  });
});

describe("evaluateHand - sigue disponible como utilidad de tipo de mano", () => {
  it("detecta una pareja simple", () => {
    const cards = [card({ rank: 7 }), card({ rank: 7 })];
    expect(evaluateHand(cards).name).toBe("Pareja");
  });
});
