import { describe, it, expect } from "vitest";
import {
  defaultProfile,
  migrateProfile,
  loadProfile,
  saveProfile,
  recordRunStart,
  recordCoronation,
  markLastCoronationEndless,
  PROFILE_VERSION,
  PROFILE_STORAGE_KEY,
} from "./profile";
import type { ProfileStorage } from "./profile";
import type { CoronationRecord } from "./coronation";

/** Storage en memoria para no depender de localStorage/jsdom en tests. */
function memoryStorage(initial: Record<string, string> = {}): ProfileStorage {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
  };
}

function record(overrides: Partial<CoronationRecord> = {}): CoronationRecord {
  return {
    seed: 1,
    score: 1000,
    dominantBuild: "Escaleras",
    activeModifierIds: ["straight_mult"],
    finalBossId: "split_throne",
    oathId: null,
    date: "2026-08-09T00:00:00.000Z",
    continuedEndless: false,
    ...overrides,
  };
}

describe("defaultProfile", () => {
  it("empieza en cero, sin legados ni coronaciones", () => {
    const p = defaultProfile();
    expect(p.version).toBe(PROFILE_VERSION);
    expect(p.runsStarted).toBe(0);
    expect(p.runsWon).toBe(0);
    expect(p.bossesDefeated).toEqual({});
    expect(p.bestRound).toBe(0);
    expect(p.bestTotalScore).toBe(0);
    expect(p.bestHand).toBe(0);
    expect(p.maxDifficultyUnlocked).toBe(0);
    expect(p.claimedLegacyIds).toEqual([]);
    expect(p.coronations).toEqual([]);
  });
});

describe("persistencia: guardar y cargar", () => {
  it("loadProfile sin storage disponible devuelve el perfil por defecto", () => {
    expect(loadProfile(null)).toEqual(defaultProfile());
  });

  it("loadProfile sin nada guardado todavía devuelve el perfil por defecto", () => {
    const storage = memoryStorage();
    expect(loadProfile(storage)).toEqual(defaultProfile());
  });

  it("guardar y volver a cargar reproduce el mismo perfil", () => {
    const storage = memoryStorage();
    const p = recordRunStart(recordRunStart(defaultProfile()));
    saveProfile(p, storage);
    expect(loadProfile(storage)).toEqual(p);
  });

  it("saveProfile con storage null no lanza", () => {
    expect(() => saveProfile(defaultProfile(), null)).not.toThrow();
  });

  it("guarda bajo la clave de storage documentada", () => {
    const storage = memoryStorage();
    saveProfile(defaultProfile(), storage);
    expect(storage.getItem(PROFILE_STORAGE_KEY)).not.toBeNull();
  });
});

describe("recuperación ante datos corruptos", () => {
  it("JSON inválido en storage se recupera con el perfil por defecto", () => {
    const storage = memoryStorage({ [PROFILE_STORAGE_KEY]: "{esto no es json" });
    expect(loadProfile(storage)).toEqual(defaultProfile());
  });

  it("un valor JSON válido pero de forma incorrecta (array) se recupera con el perfil por defecto", () => {
    const storage = memoryStorage({ [PROFILE_STORAGE_KEY]: JSON.stringify([1, 2, 3]) });
    expect(loadProfile(storage)).toEqual(defaultProfile());
  });

  it("un valor JSON válido pero primitivo (número) se recupera con el perfil por defecto", () => {
    const storage = memoryStorage({ [PROFILE_STORAGE_KEY]: "42" });
    expect(loadProfile(storage)).toEqual(defaultProfile());
  });

  it("un objeto con campos parcialmente corruptos rellena solo esos campos con el valor por defecto", () => {
    const raw = {
      version: 1,
      runsStarted: 5,
      runsWon: "no-es-un-numero", // corrupto
      bossesDefeated: { split_throne: 2 },
      bestRound: 9,
      bestTotalScore: 9000,
      bestHand: 500,
      maxDifficultyUnlocked: 1,
      claimedLegacyIds: ["forbidden_echo"],
      coronations: "esto-deberia-ser-un-array", // corrupto
    };
    const migrated = migrateProfile(raw);
    expect(migrated.runsStarted).toBe(5);
    expect(migrated.bossesDefeated).toEqual({ split_throne: 2 });
    expect(migrated.bestRound).toBe(9);
    expect(migrated.claimedLegacyIds).toEqual(["forbidden_echo"]);
    // Campos corruptos, recuperados con el valor por defecto:
    expect(migrated.runsWon).toBe(0);
    expect(migrated.coronations).toEqual([]);
  });
});

describe("versión y migración básica", () => {
  it("un objeto sin campo version se trata igualmente como perfil recuperable", () => {
    const migrated = migrateProfile({ runsStarted: 3 });
    expect(migrated.version).toBe(PROFILE_VERSION);
    expect(migrated.runsStarted).toBe(3);
  });

  it("migrateProfile siempre normaliza la version al valor actual", () => {
    const migrated = migrateProfile({ version: 0, runsStarted: 1 });
    expect(migrated.version).toBe(PROFILE_VERSION);
  });

  it("un registro de Coronación con forma inválida dentro del array se filtra sin descartar el resto", () => {
    const raw = {
      version: 1,
      coronations: [record({ seed: 2 }), { not: "a coronation" }, record({ seed: 3 })],
    };
    const migrated = migrateProfile(raw);
    expect(migrated.coronations).toHaveLength(2);
    expect(migrated.coronations.map((c) => c.seed)).toEqual([2, 3]);
  });
});

describe("recordRunStart", () => {
  it("incrementa runsStarted sin tocar el resto del perfil", () => {
    const p = defaultProfile();
    const next = recordRunStart(p);
    expect(next.runsStarted).toBe(1);
    expect(next).not.toBe(p);
    expect(p.runsStarted).toBe(0); // no muta el original
  });
});

describe("recordCoronation", () => {
  it("una victoria incrementa runsWon, guarda el registro y actualiza mejores marcas", () => {
    const p = defaultProfile();
    const r = record({ score: 12000 });
    const next = recordCoronation(p, r, 9, 850);
    expect(next.runsWon).toBe(1);
    expect(next.coronations).toEqual([r]);
    expect(next.bestRound).toBe(9);
    expect(next.bestTotalScore).toBe(12000);
    expect(next.bestHand).toBe(850);
    expect(next.bossesDefeated).toEqual({ split_throne: 1 });
  });

  it("las mejores marcas usan el máximo histórico, no el último valor", () => {
    let p = recordCoronation(defaultProfile(), record({ score: 5000 }), 9, 300);
    p = recordCoronation(p, record({ score: 3000 }), 9, 900);
    expect(p.bestTotalScore).toBe(5000); // no baja
    expect(p.bestHand).toBe(900); // sí sube
    expect(p.runsWon).toBe(2);
    expect(p.bossesDefeated).toEqual({ split_throne: 2 });
  });

  it("distintos bosses finales se cuentan por separado", () => {
    let p = recordCoronation(defaultProfile(), record({ finalBossId: "split_throne" }), 9, 100);
    p = recordCoronation(p, record({ finalBossId: "other_boss" }), 9, 100);
    expect(p.bossesDefeated).toEqual({ split_throne: 1, other_boss: 1 });
  });

  it("no muta el perfil recibido", () => {
    const p = defaultProfile();
    recordCoronation(p, record(), 9, 100);
    expect(p).toEqual(defaultProfile());
  });
});

describe("markLastCoronationEndless", () => {
  it("marca continuedEndless en la última Coronación", () => {
    let p = recordCoronation(defaultProfile(), record({ continuedEndless: false }), 9, 100);
    p = markLastCoronationEndless(p);
    expect(p.coronations[0].continuedEndless).toBe(true);
  });

  it("sin coronaciones no hace nada (no lanza)", () => {
    const p = defaultProfile();
    expect(markLastCoronationEndless(p)).toEqual(p);
  });

  it("solo afecta a la última, no a coronaciones anteriores", () => {
    let p = recordCoronation(defaultProfile(), record({ seed: 1 }), 9, 100);
    p = recordCoronation(p, record({ seed: 2 }), 9, 100);
    p = markLastCoronationEndless(p);
    expect(p.coronations[0].continuedEndless).toBe(false);
    expect(p.coronations[1].continuedEndless).toBe(true);
  });
});
