import { describe, it, expect } from "vitest";
import {
  BOSSES_BY_ANTE,
  getBossById,
  selectBossForAnte,
  initBossState,
  scoreWithBoss,
  advanceBossState,
  describeBossState,
  bossHandWarning,
} from "./bosses";
import { scorePlay } from "./scoring";
import type { Card, GameState } from "./types";

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

function baseGs(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    round: 3,
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
    activeBossId: null,
    bossState: {},
    oathId: null,
    ...overrides,
  };
}

describe("estructura del catálogo de bosses", () => {
  it("cada ante tiene al menos un boss cuya propiedad `ante` coincide con la clave", () => {
    for (const ante of [1, 2, 3] as const) {
      const candidates = BOSSES_BY_ANTE[ante];
      expect(candidates.length).toBeGreaterThan(0);
      for (const boss of candidates) {
        expect(boss.ante).toBe(ante);
      }
    }
  });

  it("getBossById encuentra los 3 bosses de la 2D y devuelve null para un id desconocido", () => {
    expect(getBossById("unstable_mirror")?.name).toBe("El Espejo Inestable");
    expect(getBossById("the_accountant")?.name).toBe("El Contable Implacable");
    expect(getBossById("split_throne")?.name).toBe("El Trono Partido");
    expect(getBossById("no_existe")).toBeNull();
  });

  it("getBossById también encuentra el boss desbloqueable, aunque esté bloqueado por defecto", () => {
    const boss = getBossById("thrones_echo");
    expect(boss?.name).toBe("El Eco del Trono");
    expect(boss?.locked).toBe(true);
  });

  it("Ante 2 tiene dos candidatos: uno siempre disponible y uno bloqueado", () => {
    const candidates = BOSSES_BY_ANTE[2];
    expect(candidates.map((b) => b.id).sort()).toEqual(["the_accountant", "thrones_echo"]);
    expect(candidates.find((b) => b.id === "the_accountant")?.locked).toBe(false);
    expect(candidates.find((b) => b.id === "thrones_echo")?.locked).toBe(true);
  });
});

describe("selección determinista de boss por ante", () => {
  it("misma seed + mismo ante -> mismo boss, de forma repetible", () => {
    const a = selectBossForAnte(12345, 1);
    const b = selectBossForAnte(12345, 1);
    expect(a?.id).toBe(b?.id);
  });

  it("con un único candidato por ante, cualquier seed devuelve el mismo boss", () => {
    for (const seed of [1, 2, 999, 424242]) {
      expect(selectBossForAnte(seed, 1)?.id).toBe("unstable_mirror");
      expect(selectBossForAnte(seed, 2)?.id).toBe("the_accountant");
      expect(selectBossForAnte(seed, 3)?.id).toBe("split_throne");
    }
  });

  it("seeds distintas no rompen el determinismo por-seed (cada una sigue siendo estable)", () => {
    const seeds = [7, 42, 100];
    for (const seed of seeds) {
      const first = selectBossForAnte(seed, 2);
      const second = selectBossForAnte(seed, 2);
      expect(first?.id).toBe(second?.id);
    }
  });
});

describe("El Eco del Trono (thrones_echo) — boss desbloqueable, Iteración 2E", () => {
  it("nunca sale seleccionado sin desbloquear, para ninguna seed", () => {
    for (const seed of [1, 2, 999, 424242, 7, 42, 100]) {
      expect(selectBossForAnte(seed, 2)?.id).not.toBe("thrones_echo");
      expect(selectBossForAnte(seed, 2, new Set())?.id).not.toBe("thrones_echo");
    }
  });

  it("una vez desbloqueado, puede salir seleccionado para alguna seed", () => {
    const unlocked = new Set(["thrones_echo"]);
    const results = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => selectBossForAnte(seed, 2, unlocked)?.id)
    );
    expect(results.has("thrones_echo")).toBe(true);
    expect(results.has("the_accountant")).toBe(true); // sigue pudiendo salir el otro candidato
  });

  it("la selección sigue siendo determinista con el boss desbloqueado", () => {
    const unlocked = new Set(["thrones_echo"]);
    const a = selectBossForAnte(555, 2, unlocked);
    const b = selectBossForAnte(555, 2, unlocked);
    expect(a?.id).toBe(b?.id);
  });

  it("desbloquear un boss de otro ante no afecta a la selección de Ante 2", () => {
    const unlocked = new Set(["algun_boss_de_otro_ante"]);
    for (const seed of [1, 2, 999]) {
      expect(selectBossForAnte(seed, 2, unlocked)?.id).toBe("the_accountant");
    }
  });

  it("la primera mano puntúa a ×0.7 Mult y fija el eco a partir de su Mult base", () => {
    const played = [card({ rank: 10 }), card({ rank: 10 }), card({ rank: 10 })]; // Trío
    const gs = baseGs({ activeBossId: "thrones_echo", bossState: { echoBonus: 0 } });
    const base = scorePlay(played, [], gs, true, false);
    const bd = scoreWithBoss(played, [], gs, true, false);

    expect(bd.chips).toBe(base.chips);
    expect(bd.mult).toBe(Math.round(base.mult * 0.7 * 10) / 10);
    expect(bd.total).toBe(Math.round(bd.chips * bd.mult));
    expect(bd.lines.some((l) => l.includes("fija el eco"))).toBe(true);

    const state2 = advanceBossState(gs, played, [], bd, true, false);
    // Ya no hace falta reconstruir el Mult original dividiendo entre
    // 0.7 (Iteración 2F): `base` (calculado arriba con scorePlay
    // directamente) ES ese valor original.
    const expectedEcho = Math.round(base.mult * 0.2 * 10) / 10;
    expect(state2).toEqual({ echoBonus: expectedEcho });
  });

  it("las manos siguientes suman el eco fijado, sin tocar las fichas", () => {
    const first = [card({ rank: 10 }), card({ rank: 10 }), card({ rank: 10 })]; // Trío
    const gs1 = baseGs({ activeBossId: "thrones_echo", bossState: { echoBonus: 0 } });
    const bd1 = scoreWithBoss(first, [], gs1, true, false);
    const state2 = advanceBossState(gs1, first, [], bd1, true, false);

    const second = [card({ rank: 4 })]; // Carta alta
    const gs2 = baseGs({ activeBossId: "thrones_echo", bossState: state2 });
    const base2 = scorePlay(second, [], gs2, false, false);
    const bd2 = scoreWithBoss(second, [], gs2, false, false);
    const echoBonus = (state2 as { echoBonus: number }).echoBonus;

    expect(bd2.chips).toBe(base2.chips);
    expect(bd2.mult).toBe(Math.round((base2.mult + echoBonus) * 10) / 10);
    expect(bd2.total).toBe(Math.round(bd2.chips * bd2.mult));
    expect(bd2.lines.some((l) => l.includes("Eco del Trono"))).toBe(true);
  });

  it("describeBossState distingue antes y después de fijar el eco", () => {
    const before = baseGs({ activeBossId: "thrones_echo", bossState: { echoBonus: 0 } });
    expect(describeBossState(before)).toMatch(/sin jugar/i);

    const after = baseGs({ activeBossId: "thrones_echo", bossState: { echoBonus: 2.4 } });
    expect(describeBossState(after)).toMatch(/Eco fijado/);
  });

  it("preview (scoreWithBoss) y ejecución son la misma llamada, determinista", () => {
    const played = [card({ rank: 7 }), card({ rank: 7 })];
    const gs = baseGs({ activeBossId: "thrones_echo", bossState: { echoBonus: 1.2 } });
    const a = scoreWithBoss(played, [], gs, false, false);
    const b = scoreWithBoss(played, [], gs, false, false);
    expect(a).toEqual(b);
  });

  it("Iteración 2F: leer ctx.preBossBreakdown.mult da exactamente el mismo eco que la reconstrucción por división que reemplaza (regresión)", () => {
    // Antes de la 2F, THRONES_ECHO.afterHand calculaba
    // `breakdown.mult / 0.7` para reconstruir el Mult original de la
    // primera mano. Este test fija ese cálculo aquí, por fuera del
    // motor, y comprueba que coincide con lo que ahora produce
    // advanceBossState leyendo ctx.preBossBreakdown.mult directamente
    // — la limpieza técnica no cambió ningún resultado numérico.
    for (const rankSet of [[10, 10, 10], [3, 3], [14], [7, 7, 7, 7]]) {
      const played = rankSet.map((rank) => card({ rank }));
      const gs = baseGs({ activeBossId: "thrones_echo", bossState: { echoBonus: 0 } });
      const bd = scoreWithBoss(played, [], gs, true, false);

      const echoViaOldDivision = Math.round((bd.mult / 0.7) * 0.2 * 10) / 10;
      const newState = advanceBossState(gs, played, [], bd, true, false) as {
        echoBonus: number;
      };

      expect(newState.echoBonus).toBe(echoViaOldDivision);
    }
  });
});

describe("initBossState", () => {
  it("bossId null devuelve un objeto vacío", () => {
    expect(initBossState(null)).toEqual({});
  });

  it("cada boss implementado devuelve su estado inicial documentado", () => {
    expect(initBossState("unstable_mirror")).toEqual({ lastHandName: null });
    expect(initBossState("the_accountant")).toEqual({ previousTotal: null });
    expect(initBossState("split_throne")).toEqual({ phase: 1 });
  });
});

describe("scoreWithBoss - sin boss activo", () => {
  it("es exactamente igual a scorePlay cuando activeBossId es null", () => {
    const played = [card({ rank: 5 }), card({ rank: 5 })];
    const gs = baseGs({ activeBossId: null, bossState: {} });
    expect(scoreWithBoss(played, [], gs, false, false)).toEqual(
      scorePlay(played, [], gs, false, false)
    );
  });
});

describe("El Espejo Inestable (unstable_mirror) - Ante 1", () => {
  it("la primera mano de la ronda nunca se penaliza", () => {
    const played = [card({ rank: 5 }), card({ rank: 5 })]; // Pareja
    const gs = baseGs({ activeBossId: "unstable_mirror", bossState: { lastHandName: null } });
    const withBoss = scoreWithBoss(played, [], gs, true, false);
    const withoutBoss = scorePlay(played, [], gs, true, false);
    expect(withBoss).toEqual(withoutBoss);
  });

  it("repetir el mismo tipo de mano dos veces seguidas reduce el Mult a ×0.75", () => {
    const handA = [card({ rank: 5 }), card({ rank: 5 })]; // Pareja
    const handB = [card({ rank: 8 }), card({ rank: 8 })]; // también Pareja
    const gs1 = baseGs({ activeBossId: "unstable_mirror", bossState: { lastHandName: null } });

    const bd1 = scoreWithBoss(handA, [], gs1, true, false);
    expect(bd1.handName).toBe("Pareja");

    const state2 = advanceBossState(gs1, handA, [], bd1, true, false);
    expect(state2).toEqual({ lastHandName: "Pareja" });

    const gs2 = baseGs({ activeBossId: "unstable_mirror", bossState: state2 });
    const base2 = scorePlay(handB, [], gs2, false, false);
    const bd2 = scoreWithBoss(handB, [], gs2, false, false);

    expect(bd2.chips).toBe(base2.chips); // las fichas no cambian, solo el Mult
    expect(bd2.mult).toBe(Math.round(base2.mult * 0.75 * 10) / 10);
    expect(bd2.total).toBe(Math.round(bd2.chips * bd2.mult));
    expect(bd2.lines.some((l) => l.includes("Espejo Inestable"))).toBe(true);
  });

  it("cambiar de tipo de mano evita la penalización", () => {
    const handA = [card({ rank: 5 }), card({ rank: 5 })]; // Pareja
    const handB = [card({ rank: 9 })]; // Carta alta
    const gs1 = baseGs({ activeBossId: "unstable_mirror", bossState: { lastHandName: null } });
    const bd1 = scoreWithBoss(handA, [], gs1, true, false);
    const state2 = advanceBossState(gs1, handA, [], bd1, true, false);
    const gs2 = baseGs({ activeBossId: "unstable_mirror", bossState: state2 });

    const withBoss = scoreWithBoss(handB, [], gs2, false, false);
    const withoutBoss = scorePlay(handB, [], gs2, false, false);
    expect(withBoss).toEqual(withoutBoss);
  });

  it("modifyScore no muta el breakdown ni el bossState recibidos", () => {
    const handA = [card({ rank: 5 }), card({ rank: 5 })];
    const handB = [card({ rank: 8 }), card({ rank: 8 })];
    const gs1 = baseGs({ activeBossId: "unstable_mirror", bossState: { lastHandName: null } });
    const bd1 = scoreWithBoss(handA, [], gs1, true, false);
    const state2 = advanceBossState(gs1, handA, [], bd1, true, false);
    const gs2 = baseGs({ activeBossId: "unstable_mirror", bossState: state2 });

    const stateBefore = structuredClone(gs2.bossState);
    scoreWithBoss(handB, [], gs2, false, false);
    expect(gs2.bossState).toEqual(stateBefore);
  });

  it("describeBossState refleja la última mano jugada", () => {
    const gs = baseGs({ activeBossId: "unstable_mirror", bossState: { lastHandName: null } });
    expect(describeBossState(gs)).toMatch(/todavía no has jugado/i);

    const gs2 = baseGs({ activeBossId: "unstable_mirror", bossState: { lastHandName: "Pareja" } });
    expect(describeBossState(gs2)).toMatch(/Pareja/);
  });
});

describe("El Contable Implacable (the_accountant) - Ante 2", () => {
  it("la primera mano de la ronda nunca se penaliza (no hay listón todavía)", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({ activeBossId: "the_accountant", bossState: { previousTotal: null } });
    expect(scoreWithBoss(played, [], gs, true, false)).toEqual(
      scorePlay(played, [], gs, true, false)
    );
  });

  it("una mano que no supera a la anterior reduce las fichas a la mitad (Mult intacto)", () => {
    const handA = [card({ rank: 10 }), card({ rank: 10 }), card({ rank: 10 })]; // Trío, alto total
    const gs1 = baseGs({ activeBossId: "the_accountant", bossState: { previousTotal: null } });
    const bd1 = scoreWithBoss(handA, [], gs1, true, false);
    const state2 = advanceBossState(gs1, handA, [], bd1, true, false);
    expect(state2).toEqual({ previousTotal: bd1.total });

    const handB = [card({ rank: 3 })]; // Carta alta, total bajo
    const gs2 = baseGs({ activeBossId: "the_accountant", bossState: state2 });
    const base2 = scorePlay(handB, [], gs2, false, false);
    const bd2 = scoreWithBoss(handB, [], gs2, false, false);

    expect(bd2.chips).toBe(Math.round(base2.chips * 0.5));
    expect(bd2.mult).toBe(base2.mult);
    expect(bd2.total).toBe(Math.round(bd2.chips * bd2.mult));
    expect(bd2.lines.some((l) => l.includes("Contable Implacable"))).toBe(true);
  });

  it("una mano que sí supera a la anterior no se penaliza", () => {
    const handA = [card({ rank: 3 })]; // Carta alta, total bajo
    const gs1 = baseGs({ activeBossId: "the_accountant", bossState: { previousTotal: null } });
    const bd1 = scoreWithBoss(handA, [], gs1, true, false);
    const state2 = advanceBossState(gs1, handA, [], bd1, true, false);

    const handB = [card({ rank: 10 }), card({ rank: 10 }), card({ rank: 10 })]; // Trío, total alto
    const gs2 = baseGs({ activeBossId: "the_accountant", bossState: state2 });
    const withBoss = scoreWithBoss(handB, [], gs2, false, false);
    const withoutBoss = scorePlay(handB, [], gs2, false, false);
    expect(withBoss).toEqual(withoutBoss);
  });
});

describe("El Trono Partido (split_throne) - Ante 3 (final)", () => {
  it("en Fase 1 no altera la puntuación", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({
      activeBossId: "split_throne",
      bossState: { phase: 1 },
      target: 200,
      scoreThisRound: 0,
    });
    expect(scoreWithBoss(played, [], gs, false, false)).toEqual(
      scorePlay(played, [], gs, false, false)
    );
  });

  it("la mano que cruza el 50% del objetivo puntúa todavía en Fase 1 (sin penalización retroactiva)", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({
      activeBossId: "split_throne",
      bossState: { phase: 1 },
      target: 200,
      scoreThisRound: 95, // 95 + total de esta mano cruzará 100
    });
    const withBoss = scoreWithBoss(played, [], gs, false, false);
    const withoutBoss = scorePlay(played, [], gs, false, false);
    expect(withBoss).toEqual(withoutBoss);

    const newState = advanceBossState(gs, played, [], withBoss, false, false);
    expect(newState).toEqual({ phase: 2 });
  });

  it("no cruzar el 50% mantiene la Fase 1", () => {
    const played = [card({ rank: 4 })];
    const gs = baseGs({
      activeBossId: "split_throne",
      bossState: { phase: 1 },
      target: 200,
      scoreThisRound: 0,
    });
    const bd = scoreWithBoss(played, [], gs, false, false);
    const newState = advanceBossState(gs, played, [], bd, false, false);
    expect(newState).toEqual({ phase: 1 });
  });

  it("en Fase 2, cada mano suma +40 fichas planas pero el Mult baja a ×0.7", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({
      activeBossId: "split_throne",
      bossState: { phase: 2 },
      target: 200,
      scoreThisRound: 110,
    });
    const base = scorePlay(played, [], gs, false, false);
    const bd = scoreWithBoss(played, [], gs, false, false);

    expect(bd.chips).toBe(base.chips + 40);
    expect(bd.mult).toBe(Math.round(base.mult * 0.7 * 10) / 10);
    expect(bd.total).toBe(Math.round(bd.chips * bd.mult));
    expect(bd.lines.some((l) => l.includes("Trono Partido"))).toBe(true);
  });

  it("una vez en Fase 2, no vuelve a Fase 1", () => {
    const played = [card({ rank: 2 })];
    const gs = baseGs({
      activeBossId: "split_throne",
      bossState: { phase: 2 },
      target: 200,
      scoreThisRound: 500, // muy por encima del objetivo, no debería importar
    });
    const bd = scoreWithBoss(played, [], gs, false, false);
    const newState = advanceBossState(gs, played, [], bd, false, false);
    expect(newState).toEqual({ phase: 2 });
  });

  it("describeBossState distingue Fase 1 de Fase 2", () => {
    const gs1 = baseGs({ activeBossId: "split_throne", bossState: { phase: 1 } });
    const gs2 = baseGs({ activeBossId: "split_throne", bossState: { phase: 2 } });
    expect(describeBossState(gs1)).toMatch(/Fase 1/);
    expect(describeBossState(gs2)).toMatch(/Fase 2/);
  });
});

describe("preview y ejecución real usan la misma función (paridad P0-3, extendida a bosses)", () => {
  it("llamar dos veces con los mismos argumentos da el mismo resultado, con cualquier boss activo", () => {
    const played = [card({ rank: 7 }), card({ rank: 7 })];
    for (const bossId of ["unstable_mirror", "the_accountant", "split_throne"]) {
      const gs = baseGs({ activeBossId: bossId, bossState: initBossState(bossId) });
      const a = scoreWithBoss(played, [], gs, false, false);
      const b = scoreWithBoss(played, [], gs, false, false);
      expect(a).toEqual(b);
    }
  });
});

describe("describeBossState sin boss activo", () => {
  it("devuelve null cuando activeBossId es null", () => {
    expect(describeBossState(baseGs({ activeBossId: null }))).toBeNull();
  });
});

describe("bossHandWarning (Iteración 2G, docs/GAME_FEEL_2G.md sección 9)", () => {
  it("devuelve null sin boss activo", () => {
    const played = [card({ rank: 5 })];
    expect(bossHandWarning(baseGs({ activeBossId: null }), played, [], true, false)).toBeNull();
  });

  it("devuelve null sin cartas seleccionadas", () => {
    const gs = baseGs({ activeBossId: "the_accountant", bossState: { previousTotal: 500 } });
    expect(bossHandWarning(gs, [], [], false, false)).toBeNull();
  });

  it("devuelve null si el boss no penaliza esta jugada concreta", () => {
    const played = [card({ rank: 10 })];
    const gs = baseGs({ activeBossId: "the_accountant", bossState: { previousTotal: null } });
    // Primera mano de la ronda: El Contable nunca penaliza sin listón previo.
    expect(bossHandWarning(gs, played, [], true, false)).toBeNull();
  });

  it("advierte cuando El Contable Implacable va a reducir las fichas a la mitad", () => {
    const played = [card({ rank: 3 })]; // Carta alta, total bajo
    const gs = baseGs({ activeBossId: "the_accountant", bossState: { previousTotal: 999 } });
    const warning = bossHandWarning(gs, played, [], false, false);
    expect(warning).not.toBeNull();
    expect(warning).toMatch(/Contable Implacable/);
  });

  it("advierte cuando El Espejo Inestable repite el tipo de mano y penaliza el Mult", () => {
    const played = [card({ rank: 6 }), card({ rank: 6 })]; // Pareja, igual que la última
    const gs = baseGs({ activeBossId: "unstable_mirror", bossState: { lastHandName: "Pareja" } });
    const warning = bossHandWarning(gs, played, [], false, false);
    expect(warning).not.toBeNull();
    expect(warning).toMatch(/Espejo Inestable/);
  });

  it("El Eco del Trono en manos posteriores a la primera SUMA Mult: nunca es una advertencia", () => {
    const played = [card({ rank: 8 })];
    const gs = baseGs({ activeBossId: "thrones_echo", bossState: { echoBonus: 2 } });
    expect(bossHandWarning(gs, played, [], false, false)).toBeNull();
  });

  it("el texto de advertencia coincide con la línea añadida por el propio boss (misma fuente de verdad)", () => {
    const played = [card({ rank: 2 })];
    const gs = baseGs({ activeBossId: "the_accountant", bossState: { previousTotal: 999 } });
    const pre = scorePlay(played, [], gs, false, false);
    const post = scoreWithBoss(played, [], gs, false, false);
    const expectedLine = post.lines[post.lines.length - 1];
    expect(pre.lines.includes(expectedLine)).toBe(false);
    expect(bossHandWarning(gs, played, [], false, false)).toBe(expectedLine);
  });
});
