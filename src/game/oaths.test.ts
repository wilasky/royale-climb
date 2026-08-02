import { describe, it, expect } from "vitest";
import {
  OATH_I_VEIL_OF_THE_THRONE,
  getOathById,
  shouldShowBossTelegraph,
} from "./oaths";

describe("getOathById", () => {
  it("resuelve el Juramento I por id", () => {
    expect(getOathById(OATH_I_VEIL_OF_THE_THRONE)?.name).toBe("El Velo del Trono");
  });

  it("devuelve null para null y para un id desconocido", () => {
    expect(getOathById(null)).toBeNull();
    expect(getOathById("no_existe")).toBeNull();
  });
});

describe("shouldShowBossTelegraph — efecto real del Juramento I", () => {
  it("sin Juramento (oathId null), el telegraph se muestra", () => {
    expect(shouldShowBossTelegraph(null)).toBe(true);
  });

  it("con un Juramento distinto (futuro), el telegraph sigue mostrándose", () => {
    expect(shouldShowBossTelegraph("otro_juramento_futuro")).toBe(true);
  });

  it("con El Velo del Trono activo, el telegraph se oculta", () => {
    expect(shouldShowBossTelegraph(OATH_I_VEIL_OF_THE_THRONE)).toBe(false);
  });
});
