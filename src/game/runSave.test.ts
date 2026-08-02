import { describe, it, expect } from "vitest";
import {
  RUN_SAVE_VERSION,
  RUN_SAVE_STORAGE_KEY,
  SAVEABLE_SCREENS,
  isSaveableScreen,
  emptyRunProgressCounters,
  validateRunSave,
  migrateRunSave,
  loadRunSave,
  saveRunSave,
  deleteRunSave,
} from "./runSave";
import type { RunSave, PendingRewardSave, PendingShopSave } from "./runSave";
import type { ProfileStorage } from "./profile";
import type { Card, GameState, Relic } from "./types";

function memoryStorage(initial: Record<string, string> = {}): ProfileStorage {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

let idCounter = 0;
function card(overrides: Partial<Card> = {}): Card {
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

function relic(id: string, overrides: Partial<Relic> = {}): Relic {
  return { id, name: id, desc: "", rarity: "common", icon: "•", ...overrides };
}

function baseGs(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    round: 1,
    ante: 1,
    money: 4,
    deck: [card(), card()],
    drawPile: [card()],
    hand: [card(), card()],
    discardPile: [],
    relics: [relic("straight_mult")],
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

function baseSave(overrides: Partial<RunSave> = {}): RunSave {
  return {
    version: RUN_SAVE_VERSION,
    savedAt: "2026-08-16T00:00:00.000Z",
    screen: "play",
    gameState: baseGs(),
    runProgress: emptyRunProgressCounters(),
    pendingReward: null,
    pendingShop: null,
    pendingRelicReplace: null,
    pendingLegacy: null,
    ...overrides,
  };
}

describe("isSaveableScreen / SAVEABLE_SCREENS", () => {
  it("play, reward, money-reward, shop y win son guardables", () => {
    for (const s of ["play", "reward", "money-reward", "shop", "win"] as const) {
      expect(isSaveableScreen(s)).toBe(true);
      expect(SAVEABLE_SCREENS.has(s)).toBe(true);
    }
  });

  it("menu y defeat no son guardables", () => {
    expect(isSaveableScreen("menu")).toBe(false);
    expect(isSaveableScreen("defeat")).toBe(false);
  });
});

describe("validateRunSave — save nuevo válido", () => {
  it("acepta un save recién construido tal cual", () => {
    const save = baseSave();
    expect(validateRunSave(save)).toEqual(save);
  });

  it("acepta pendingReward/pendingShop/pendingRelicReplace/pendingLegacy poblados", () => {
    const save = baseSave({
      screen: "shop",
      pendingReward: { offers: [relic("straight_mult")], rerollCount: 1 },
      pendingShop: {
        stock: {
          relics: [{ relic: relic("straight_mult"), price: 5 }],
          specials: [
            { kind: "glass", name: "Cristal Frágil", desc: "", price: 6, rarity: "rare", icon: "🔮" },
          ],
        },
        usedSpecialKinds: ["glass"],
        rerollCount: 2,
      },
      pendingRelicReplace: { incoming: relic("interest"), context: "shop", price: 12 },
      pendingLegacy: { step: "legacy", claimedLegacyId: null },
    });
    expect(validateRunSave(save)).toEqual(save);
  });
});

describe("serialización / deserialización", () => {
  it("round-trip vía JSON.stringify/JSON.parse conserva el save exacto", () => {
    const save = baseSave({
      gameState: baseGs({ activeBossId: "split_throne", bossState: { phase: 2 } }),
    });
    const roundTripped = JSON.parse(JSON.stringify(save));
    expect(validateRunSave(roundTripped)).toEqual(save);
  });
});

describe("restauración completa (loadRunSave/saveRunSave)", () => {
  it("guardar y cargar reproduce el mismo save", () => {
    const storage = memoryStorage();
    const save = baseSave({ gameState: baseGs({ round: 4, money: 22 }) });
    saveRunSave(save, storage);
    const result = loadRunSave(storage);
    expect(result).toEqual({ status: "valid", save });
  });

  it("sin nada guardado, loadRunSave devuelve status 'none'", () => {
    const storage = memoryStorage();
    expect(loadRunSave(storage)).toEqual({ status: "none" });
  });

  it("con storage null, loadRunSave devuelve status 'none'", () => {
    expect(loadRunSave(null)).toEqual({ status: "none" });
  });

  it("guarda bajo la clave de storage documentada", () => {
    const storage = memoryStorage();
    saveRunSave(baseSave(), storage);
    expect(storage.getItem(RUN_SAVE_STORAGE_KEY)).not.toBeNull();
  });

  it("saveRunSave con storage null no lanza", () => {
    expect(() => saveRunSave(baseSave(), null)).not.toThrow();
  });
});

describe("versión", () => {
  it("migrateRunSave acepta la versión actual", () => {
    const save = baseSave();
    expect(migrateRunSave(save)).toEqual(save);
  });

  it("migrateRunSave rechaza una versión futura desconocida de forma segura", () => {
    const save = { ...baseSave(), version: 999 };
    expect(migrateRunSave(save)).toBeNull();
  });

  it("migrateRunSave rechaza la ausencia de version", () => {
    const save: Record<string, unknown> = { ...baseSave() };
    delete save.version;
    expect(migrateRunSave(save)).toBeNull();
  });
});

describe("save corrupto", () => {
  it("JSON inválido en storage se reporta como 'corrupt', no lanza", () => {
    const storage = memoryStorage({ [RUN_SAVE_STORAGE_KEY]: "{esto no es json" });
    expect(loadRunSave(storage)).toEqual({ status: "corrupt" });
  });

  it("un valor JSON válido pero de forma incorrecta (array) se reporta como 'corrupt'", () => {
    const storage = memoryStorage({ [RUN_SAVE_STORAGE_KEY]: JSON.stringify([1, 2, 3]) });
    expect(loadRunSave(storage)).toEqual({ status: "corrupt" });
  });

  it("un GameState con campos faltantes es rechazado", () => {
    const save = baseSave();
    const broken = { ...save, gameState: { ...save.gameState, money: undefined } };
    expect(validateRunSave(broken)).toBeNull();
  });

  it("un screen no guardable (p.ej. 'menu') es rechazado", () => {
    const save = { ...baseSave(), screen: "menu" };
    expect(validateRunSave(save)).toBeNull();
  });
});

describe("ids inexistentes", () => {
  it("activeBossId apuntando a un boss inexistente es rechazado", () => {
    const save = baseSave({ gameState: baseGs({ activeBossId: "boss_que_no_existe" }) });
    expect(validateRunSave(save)).toBeNull();
  });

  it("oathId apuntando a un juramento inexistente es rechazado", () => {
    const save = baseSave({ gameState: baseGs({ oathId: "juramento_que_no_existe" }) });
    expect(validateRunSave(save)).toBeNull();
  });

  it("un activeBossId real (split_throne) es aceptado", () => {
    const save = baseSave({ gameState: baseGs({ activeBossId: "split_throne", bossState: { phase: 1 } }) });
    expect(validateRunSave(save)).not.toBeNull();
  });

  it("pendingLegacy.claimedLegacyId apuntando a un Legado inexistente es rechazado", () => {
    const save = baseSave({
      screen: "win",
      pendingLegacy: { step: "confirm", claimedLegacyId: "legado_que_no_existe" },
    });
    expect(validateRunSave(save)).toBeNull();
  });

  it("pendingLegacy.claimedLegacyId con un Legado real (forbidden_echo) es aceptado", () => {
    const save = baseSave({
      screen: "win",
      pendingLegacy: { step: "confirm", claimedLegacyId: "forbidden_echo" },
    });
    expect(validateRunSave(save)).not.toBeNull();
  });
});

describe("versión futura/incompatible vía loadRunSave", () => {
  it("una versión futura desconocida se reporta como 'corrupt'", () => {
    const storage = memoryStorage({
      [RUN_SAVE_STORAGE_KEY]: JSON.stringify({ ...baseSave(), version: 2 }),
    });
    expect(loadRunSave(storage)).toEqual({ status: "corrupt" });
  });
});

describe("eliminación", () => {
  it("deleteRunSave borra un save existente", () => {
    const storage = memoryStorage();
    saveRunSave(baseSave(), storage);
    expect(loadRunSave(storage).status).toBe("valid");
    deleteRunSave(storage);
    expect(loadRunSave(storage)).toEqual({ status: "none" });
  });

  it("deleteRunSave sin nada guardado no lanza", () => {
    const storage = memoryStorage();
    expect(() => deleteRunSave(storage)).not.toThrow();
  });

  it("deleteRunSave con storage null no lanza", () => {
    expect(() => deleteRunSave(null)).not.toThrow();
  });
});

describe("tipos auxiliares (smoke test de forma)", () => {
  it("PendingRewardSave/PendingShopSave tienen la forma esperada", () => {
    const reward: PendingRewardSave = { offers: [relic("straight_mult")], rerollCount: 0 };
    const shop: PendingShopSave = {
      stock: { relics: [], specials: [] },
      usedSpecialKinds: [],
      rerollCount: 0,
    };
    expect(reward.offers).toHaveLength(1);
    expect(shop.stock.relics).toEqual([]);
  });
});
