/* ============================================================
   Evaluación de manos y puntuación — Iteración 2A (docs/GAME_AUDIT.md, P0-3).
   `scorePlay` es la ÚNICA función de puntuación: la usan tanto la
   previsualización (antes de jugar) como la jugada real (al pulsar
   "Jugar mano"), con los mismos argumentos. Es pura: no toca RNG,
   no muta `played`/`heldInHand`/`gs`, no cambia dinero ni estado.
   ============================================================ */
import type { Card, GameState, HandResult, Relic, ScoreBreakdown } from "./types";

export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length === 0) return { name: "—", baseChips: 0, baseMult: 0 };
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const counts: Record<number, number> = {};
  ranks.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const countVals = Object.values(counts).sort((a, b) => b - a);
  const uniqueRanks = Object.keys(counts).length;

  const isFlush = cards.length === 5 && suits.every((s) => s === suits[0]);
  const reds = cards.filter(
    (c) => c.suit === "hearts" || c.suit === "diamonds"
  ).length;
  const isSpectrum =
    cards.length === 5 && (reds === 5 || reds === 0) && !isFlush;

  let isStraight = false;
  if (cards.length === 5 && uniqueRanks === 5) {
    const lo = ranks[0];
    isStraight = ranks.every((r, i) => r === lo + i);
    if (!isStraight) {
      const alt = [...ranks];
      if (alt[4] === 14) {
        const low = [2, 3, 4, 5, 14].sort((a, b) => a - b);
        isStraight = JSON.stringify(alt) === JSON.stringify(low);
      }
    }
  }

  if (isStraight && isFlush)
    return { name: "Escalera de color", baseChips: 100, baseMult: 8 };
  if (countVals[0] === 4) return { name: "Póker", baseChips: 60, baseMult: 7 };
  if (countVals[0] === 3 && countVals[1] === 2)
    return { name: "Full", baseChips: 40, baseMult: 4 };
  if (isFlush) return { name: "Color", baseChips: 35, baseMult: 4 };
  if (isStraight) return { name: "Escalera", baseChips: 30, baseMult: 4 };
  if (isSpectrum) return { name: "Espectro", baseChips: 45, baseMult: 5 };
  if (countVals[0] === 3) return { name: "Trío", baseChips: 30, baseMult: 3 };
  if (countVals[0] === 2 && countVals[1] === 2)
    return { name: "Doble pareja", baseChips: 20, baseMult: 2 };
  if (countVals[0] === 2) return { name: "Pareja", baseChips: 10, baseMult: 2 };
  return { name: "Carta alta", baseChips: 5, baseMult: 1 };
}

export const chipValueOfRank = (r: number): number => {
  if (r === 14) return 11;
  if (r >= 11) return 10;
  return r;
};

export function scorePlay(
  played: Card[],
  heldInHand: Card[],
  gs: GameState,
  isFirstHand: boolean,
  isLastHand: boolean
): ScoreBreakdown {
  const hr = evaluateHand(played);
  const has = (id: string) => gs.relics.some((r) => r.id === id);
  let chips = hr.baseChips;
  let mult = hr.baseMult;
  const lines: string[] = [
    `${hr.name}: ${hr.baseChips} fichas × ${hr.baseMult}`,
  ];

  let bonusChipTotal = 0;
  let glassCount = 0;
  const glassMult = has("glass_master") ? 4 : 2;
  for (const c of played) {
    let v = chipValueOfRank(c.rank) + c.bonusChips;
    if (c.bonusChips > 0) bonusChipTotal += c.bonusChips;
    if (c.glass) {
      v *= glassMult;
      glassCount++;
    }
    chips += v;
  }
  if (bonusChipTotal > 0) {
    lines.push(`Mejoras de carta: +${bonusChipTotal} fichas`);
  }
  if (glassCount > 0) {
    lines.push(
      `Cristal ×${glassCount} (x${glassMult} valor de carta ya incluido arriba)`
    );
  }

  const spadeN = played.filter((c) => c.suit === "spades").length;
  const heartN = played.filter((c) => c.suit === "hearts").length;
  const clubN = played.filter((c) => c.suit === "clubs").length;

  if (has("spades_chip") && spadeN) {
    chips += spadeN * 12;
    lines.push(`Filo Negro: +${spadeN * 12} fichas`);
  }
  if (has("clubs_chip") && clubN) {
    chips += clubN * 10;
    lines.push(`Garrote Pesado: +${clubN * 10} fichas`);
  }
  if (has("hearts_mult") && heartN) {
    mult += heartN;
    lines.push(`Pulso Carmesí: +${heartN} Mult`);
  }

  if (has("pair_mult") && hr.name === "Pareja") {
    mult += 6;
    lines.push("Eco Gemelo: +6 Mult");
  }
  if (has("flush_chips") && hr.name === "Color") {
    chips += 60;
    lines.push("Marea Cromática: +60 fichas");
  }
  if (
    has("straight_mult") &&
    (hr.name === "Escalera" || hr.name === "Escalera de color")
  ) {
    mult += 5;
    lines.push("Senda Recta: +5 Mult");
  }
  if (has("pair_chain") && hr.name === "Doble pareja") {
    mult += 4;
    chips += 30;
    lines.push("Cadena Doble: +30 fichas, +4 Mult");
  }
  if (has("spectrum_boost") && hr.name === "Espectro") {
    mult *= 3;
    lines.push("Prisma Roto: ×3 Mult");
  }

  const lowN = played.filter((c) => c.rank >= 2 && c.rank <= 6).length;
  if (has("low_card_chip") && lowN) {
    chips += lowN * 18;
    lines.push(`Plebe Útil: +${lowN * 18} fichas`);
  }
  const faceN = played.filter((c) => c.rank >= 11 && c.rank <= 13).length;
  if (has("face_mult") && faceN) {
    mult += faceN * 2;
    lines.push(`Corte Noble: +${faceN * 2} Mult`);
  }
  const aceN = played.filter((c) => c.rank === 14).length;
  if (has("ace_chip") && aceN) {
    chips += aceN * 25;
    lines.push(`As bajo la Manga: +${aceN * 25} fichas`);
  }

  const steelN = heldInHand.filter((c) => c.steel).length;
  if (steelN) {
    mult += steelN * 1.5;
    lines.push(`Núcleo de Acero ×${steelN}: +${steelN * 1.5} Mult`);
  }

  if (has("small_hand") && played.length <= 2) {
    chips += 50;
    mult += 4;
    lines.push("Minimalista: +50 fichas, +4 Mult");
  }
  if (has("even_odd") && played.every((c) => c.rank % 2 === 0)) {
    mult *= 4;
    lines.push("Equilibrio Par: ×4 Mult");
  }
  if (has("first_hand_mult") && isFirstHand) {
    mult *= 3;
    lines.push("Salida en Falso: ×3 Mult");
  }
  if (has("final_hand") && isLastHand) {
    mult *= 4;
    lines.push("Última Palabra: ×4 Mult");
  }
  if (has("no_discard_mult") && gs.discardsUsedThisRound === 0) {
    mult *= 2;
    lines.push("Mano Firme: ×2 Mult");
  }

  if (has("the_collector")) {
    mult += gs.relics.length * 3;
    lines.push(`El Coleccionista: +${gs.relics.length * 3} Mult`);
  }
  if (has("blood_pact")) {
    mult *= 2.5;
    lines.push("Pacto de Sangre: ×2.5 Mult");
  }
  if (gs.permaMult > 0) {
    mult += gs.permaMult;
    lines.push(`Bola de Nieve: +${gs.permaMult.toFixed(1)} Mult`);
  }

  mult = Math.max(0, mult);
  const total = Math.round(chips * mult);
  return {
    handName: hr.name,
    chips: Math.round(chips),
    mult: Math.round(mult * 10) / 10,
    total,
    lines,
  };
}

/**
 * Riesgo de rotura de cristal para la jugada seleccionada. Informativo
 * únicamente: NO consume RNG (la tirada real ocurre al jugar la mano,
 * después de calcular la puntuación) y no afecta a `scorePlay`.
 */
export function glassRisk(
  played: Card[],
  relics: Relic[]
): { count: number; breakChancePercent: number; immune: boolean } {
  const immune = relics.some((r) => r.id === "glass_master");
  const count = played.filter((c) => c.glass).length;
  return { count, breakChancePercent: immune ? 0 : 25, immune };
}

/**
 * Dinero que se ganaría al jugar esta mano (Veta Dorada = +1$ por
 * diamante jugado). No forma parte de la puntuación - se muestra
 * aparte como "+X$ al jugar".
 */
export function diamondMoneyPreview(played: Card[], relics: Relic[]): number {
  const hasDiamondsMoney = relics.some((r) => r.id === "diamonds_money");
  if (!hasDiamondsMoney) return 0;
  return played.filter((c) => c.suit === "diamonds").length;
}
