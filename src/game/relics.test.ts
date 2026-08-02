import { describe, it, expect } from "vitest";
import { hasRelicCapacity, replaceRelic } from "./relics";
import type { Relic } from "./types";

function relic(id: string): Relic {
  return { id, name: id, desc: "", rarity: "common", icon: "•" };
}

describe("hasRelicCapacity", () => {
  it("hay hueco por debajo del máximo", () => {
    const relics = [relic("a"), relic("b"), relic("c"), relic("d"), relic("e")];
    expect(hasRelicCapacity(relics, 6)).toBe(true);
  });

  it("no hay hueco exactamente en el máximo", () => {
    const relics = [
      relic("a"), relic("b"), relic("c"),
      relic("d"), relic("e"), relic("f"),
    ];
    expect(hasRelicCapacity(relics, 6)).toBe(false);
  });

  it("no hay hueco por encima del máximo (caso defensivo)", () => {
    const relics = Array.from({ length: 7 }, (_, i) => relic(`r${i}`));
    expect(hasRelicCapacity(relics, 6)).toBe(false);
  });
});

describe("replaceRelic", () => {
  it("sustituye exactamente el modificador seleccionado, preservando el orden", () => {
    const relics = [relic("a"), relic("b"), relic("c")];
    const incoming = relic("z");
    const result = replaceRelic(relics, "b", incoming);
    expect(result.map((r) => r.id)).toEqual(["a", "z", "c"]);
  });

  it("mantiene exactamente el mismo número de modificadores", () => {
    const relics = Array.from({ length: 6 }, (_, i) => relic(`r${i}`));
    const result = replaceRelic(relics, "r3", relic("new"));
    expect(result.length).toBe(6);
  });

  it("no muta el array ni los objetos recibidos", () => {
    const relics = [relic("a"), relic("b")];
    const relicsBefore = structuredClone(relics);
    replaceRelic(relics, "a", relic("z"));
    expect(relics).toEqual(relicsBefore);
  });

  it("si el id a sustituir no existe, devuelve la lista sin cambios", () => {
    const relics = [relic("a"), relic("b")];
    const result = replaceRelic(relics, "no-existe", relic("z"));
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
