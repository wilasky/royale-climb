import { describe, it, expect } from "vitest";
import { roundClearBaseReward, computeInterest, relicPrice } from "./economy";

describe("roundClearBaseReward", () => {
  it("sin manos restantes: solo el cobro base", () => {
    expect(roundClearBaseReward(0)).toBe(2);
  });

  it("crece con las manos restantes hasta el tope", () => {
    expect(roundClearBaseReward(1)).toBe(3);
    expect(roundClearBaseReward(2)).toBe(4);
  });

  it("no sigue creciendo por encima del tope de manos bonificadas", () => {
    expect(roundClearBaseReward(3)).toBe(4);
    expect(roundClearBaseReward(4)).toBe(4);
  });
});

describe("computeInterest", () => {
  it("sin dinero suficiente no da interés", () => {
    expect(computeInterest(0)).toBe(0);
    expect(computeInterest(5)).toBe(0);
  });

  it("da 1$ por cada 6$ tenidos", () => {
    expect(computeInterest(6)).toBe(1);
    expect(computeInterest(11)).toBe(1);
    expect(computeInterest(12)).toBe(2);
  });

  it("tiene un tope de 4$ por ronda, sin importar cuánto dinero se tenga", () => {
    expect(computeInterest(23)).toBe(3);
    expect(computeInterest(24)).toBe(4);
    expect(computeInterest(100)).toBe(4);
    expect(computeInterest(1000)).toBe(4);
  });
});

describe("relicPrice", () => {
  it("devuelve el precio exacto por rareza", () => {
    expect(relicPrice("common")).toBe(5);
    expect(relicPrice("rare")).toBe(8);
    expect(relicPrice("epic")).toBe(12);
    expect(relicPrice("legendary")).toBe(18);
  });
});
