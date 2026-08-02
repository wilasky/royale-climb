import { describe, it, expect } from "vitest";
import { RELIC_SUMMARIES, relicSummary } from "./relicSummaries";
import { RELIC_ARCHETYPES } from "./archetypes";

describe("RELIC_SUMMARIES (Iteración 2G, sección 2)", () => {
  it("cubre exactamente los mismos 24 modificadores que RELIC_ARCHETYPES", () => {
    expect(Object.keys(RELIC_SUMMARIES).sort()).toEqual(
      Object.keys(RELIC_ARCHETYPES).sort()
    );
  });

  it("cada resumen tiene condición y efecto no vacíos", () => {
    for (const summary of Object.values(RELIC_SUMMARIES)) {
      expect(summary.condition.length).toBeGreaterThan(0);
      expect(summary.effect.length).toBeGreaterThan(0);
    }
  });

  it("relicSummary devuelve null para un id no catalogado", () => {
    expect(relicSummary("no-existe")).toBeNull();
  });

  it("relicSummary devuelve el resumen esperado para un id conocido", () => {
    expect(relicSummary("pair_mult")).toEqual({ condition: "Pareja", effect: "+6 Mult" });
  });
});
