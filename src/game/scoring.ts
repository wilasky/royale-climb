/* ============================================================
   Evaluación de manos y puntuación — Iteración 2A (docs/GAME_AUDIT.md, P0-3).
   `scorePlay` es la ÚNICA función de puntuación: la usan tanto la
   previsualización (antes de jugar) como la jugada real (al pulsar
   "Jugar mano"), con los mismos argumentos. Es pura: no toca RNG,
   no muta `played`/`heldInHand`/`gs`, no cambia dinero ni estado.

   Iteración 2G (docs/GAME_FEEL_2G.md): además de chips/mult/total,
   `scorePlay` computa `activations` (estado de cada modificador
   poseído respecto a ESTA jugada) y `linesDetailed` (las mismas
   líneas de `lines`, categorizadas). Es la única fuente de verdad:
   se calcula inline, en las mismas ramas `if (has(id) && condición)`
   que ya determinaban chips/mult, así que preview y ejecución real
   (que llaman a la misma función) nunca pueden divergir sobre si un
   modificador activó. Ningún resultado numérico cambia por esto.
   ============================================================ */
import type {
  Card,
  GameState,
  HandResult,
  Relic,
  RelicActivation,
  ScoreBreakdown,
  ScoreLine,
  ScoreLineCategory,
} from "./types";

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

  const lines: string[] = [];
  const linesDetailed: ScoreLine[] = [];
  const push = (text: string, category: ScoreLineCategory) => {
    lines.push(text);
    linesDetailed.push({ text, category });
  };
  push(`${hr.name}: ${hr.baseChips} fichas × ${hr.baseMult}`, "base");

  // Estado de cada modificador poseído respecto a esta jugada — ver
  // docs/GAME_FEEL_2G.md. Solo se registra una entrada por modificador
  // que el jugador posee de verdad (nunca por el catálogo completo).
  const activationById = new Map<string, RelicActivation>();
  const record = (
    id: string,
    active: boolean,
    reason: string,
    contribution: string | null
  ) => {
    if (!has(id)) return;
    activationById.set(id, { id, active, reason, contribution });
  };

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
    push(`Mejoras de carta: +${bonusChipTotal} fichas`, "card");
  }
  if (glassCount > 0) {
    push(
      `Cristal ×${glassCount} (x${glassMult} valor de carta ya incluido arriba)`,
      "card"
    );
  }
  if (has("glass_master")) {
    if (glassCount > 0) {
      record(
        "glass_master",
        true,
        `${glassCount} carta(s) de cristal en la jugada`,
        "Cristal ×4, inmune a rotura"
      );
    } else {
      record("glass_master", false, "No hay cartas de cristal en la jugada", null);
    }
  }

  const spadeN = played.filter((c) => c.suit === "spades").length;
  const heartN = played.filter((c) => c.suit === "hearts").length;
  const clubN = played.filter((c) => c.suit === "clubs").length;
  const diamondN = played.filter((c) => c.suit === "diamonds").length;

  if (has("spades_chip")) {
    if (spadeN > 0) {
      chips += spadeN * 12;
      push(`Filo Negro: +${spadeN * 12} fichas`, "relic");
      record("spades_chip", true, `${spadeN} ♠ en la jugada`, `+${spadeN * 12} fichas`);
    } else {
      record("spades_chip", false, "No hay ♠ en la jugada", null);
    }
  }
  if (has("clubs_chip")) {
    if (clubN > 0) {
      chips += clubN * 10;
      push(`Garrote Pesado: +${clubN * 10} fichas`, "relic");
      record("clubs_chip", true, `${clubN} ♣ en la jugada`, `+${clubN * 10} fichas`);
    } else {
      record("clubs_chip", false, "No hay ♣ en la jugada", null);
    }
  }
  if (has("hearts_mult")) {
    if (heartN > 0) {
      mult += heartN;
      push(`Pulso Carmesí: +${heartN} Mult`, "relic");
      record("hearts_mult", true, `${heartN} ♥ en la jugada`, `+${heartN} Mult`);
    } else {
      record("hearts_mult", false, "No hay ♥ en la jugada", null);
    }
  }
  if (has("diamonds_money")) {
    if (diamondN > 0) {
      // No toca chips/mult — el dinero lo calcula diamondMoneyPreview() aparte.
      record("diamonds_money", true, `${diamondN} ♦ en la jugada`, `+${diamondN}$`);
    } else {
      record("diamonds_money", false, "No hay ♦ en la jugada", null);
    }
  }

  if (has("pair_mult")) {
    if (hr.name === "Pareja") {
      mult += 6;
      push("Eco Gemelo: +6 Mult", "relic");
      record("pair_mult", true, "Pareja jugada", "+6 Mult");
    } else {
      record("pair_mult", false, "No has jugado una Pareja", null);
    }
  }
  if (has("flush_chips")) {
    if (hr.name === "Color") {
      chips += 60;
      push("Marea Cromática: +60 fichas", "relic");
      record("flush_chips", true, "Color jugado", "+60 fichas");
    } else {
      record("flush_chips", false, "No has jugado un Color", null);
    }
  }
  if (has("straight_mult")) {
    if (hr.name === "Escalera" || hr.name === "Escalera de color") {
      mult += 5;
      push("Senda Recta: +5 Mult", "relic");
      record("straight_mult", true, `${hr.name} jugada`, "+5 Mult");
    } else {
      record("straight_mult", false, "No has jugado una Escalera", null);
    }
  }
  if (has("pair_chain")) {
    if (hr.name === "Doble pareja") {
      mult += 4;
      chips += 30;
      push("Cadena Doble: +30 fichas, +4 Mult", "relic");
      record("pair_chain", true, "Doble pareja jugada", "+30 fichas, +4 Mult");
    } else {
      record("pair_chain", false, "No has jugado una Doble pareja", null);
    }
  }
  if (has("spectrum_boost")) {
    if (hr.name === "Espectro") {
      mult *= 3;
      push("Prisma Roto: ×3 Mult", "relic");
      record("spectrum_boost", true, "Espectro jugado", "×3 Mult");
    } else {
      record("spectrum_boost", false, "No has jugado un Espectro", null);
    }
  }

  const lowN = played.filter((c) => c.rank >= 2 && c.rank <= 6).length;
  if (has("low_card_chip")) {
    if (lowN > 0) {
      chips += lowN * 18;
      push(`Plebe Útil: +${lowN * 18} fichas`, "relic");
      record("low_card_chip", true, `${lowN} carta(s) 2-6 en la jugada`, `+${lowN * 18} fichas`);
    } else {
      record("low_card_chip", false, "No hay cartas 2-6 en la jugada", null);
    }
  }
  const faceN = played.filter((c) => c.rank >= 11 && c.rank <= 13).length;
  if (has("face_mult")) {
    if (faceN > 0) {
      mult += faceN * 2;
      push(`Corte Noble: +${faceN * 2} Mult`, "relic");
      record("face_mult", true, `${faceN} figura(s) en la jugada`, `+${faceN * 2} Mult`);
    } else {
      record("face_mult", false, "No hay figuras (J/Q/K) en la jugada", null);
    }
  }
  const aceN = played.filter((c) => c.rank === 14).length;
  if (has("ace_chip")) {
    if (aceN > 0) {
      chips += aceN * 25;
      push(`As bajo la Manga: +${aceN * 25} fichas`, "relic");
      record("ace_chip", true, `${aceN} As en la jugada`, `+${aceN * 25} fichas`);
    } else {
      record("ace_chip", false, "No hay Ases en la jugada", null);
    }
  }

  const steelN = heldInHand.filter((c) => c.steel).length;
  if (steelN) {
    mult += steelN * 1.5;
    push(`Núcleo de Acero ×${steelN}: +${steelN * 1.5} Mult`, "card");
  }

  if (has("small_hand")) {
    // Condición idéntica a la original (sin guardia de played.length>0):
    // preserva el resultado numérico exacto para cualquier entrada.
    if (played.length <= 2) {
      chips += 50;
      mult += 4;
      push("Minimalista: +50 fichas, +4 Mult", "relic");
      record("small_hand", true, `${played.length} carta(s) jugadas`, "+50 fichas, +4 Mult");
    } else {
      record("small_hand", false, "Juega 2 cartas o menos para activarlo", null);
    }
  }
  if (has("even_odd")) {
    const allEven = played.every((c) => c.rank !== 14 && c.rank % 2 === 0);
    if (allEven) {
      mult *= 3;
      push("Equilibrio Par: ×3 Mult", "relic");
      record("even_odd", true, "Todas las cartas son pares (sin Ases)", "×3 Mult");
    } else {
      record("even_odd", false, "No todas las cartas son pares (el As no cuenta)", null);
    }
  }
  if (has("first_hand_mult")) {
    if (isFirstHand) {
      mult *= 3;
      push("Salida en Falso: ×3 Mult", "relic");
      record("first_hand_mult", true, "Primera mano de la ronda", "×3 Mult");
    } else {
      record("first_hand_mult", false, "No es la primera mano de la ronda", null);
    }
  }
  if (has("final_hand")) {
    if (isLastHand) {
      mult *= 4;
      push("Última Palabra: ×4 Mult", "relic");
      record("final_hand", true, "Última mano de la ronda", "×4 Mult");
    } else {
      record("final_hand", false, "No es la última mano de la ronda", null);
    }
  }
  if (has("no_discard_mult")) {
    if (gs.discardsUsedThisRound === 0) {
      mult *= 2;
      push("Mano Firme: ×2 Mult", "relic");
      record("no_discard_mult", true, "Sin descartes esta ronda", "×2 Mult");
    } else {
      record("no_discard_mult", false, "Ya has descartado en esta ronda", null);
    }
  }

  if (has("the_collector")) {
    const bonus = gs.relics.length * 2;
    mult += bonus;
    push(`El Coleccionista: +${bonus} Mult`, "relic");
    record("the_collector", true, "Siempre activo mientras lo poseas", `+${bonus} Mult`);
  }
  if (has("blood_pact")) {
    mult *= 2.5;
    push("Pacto de Sangre: ×2.5 Mult", "relic");
    record("blood_pact", true, "Siempre activo mientras lo poseas", "×2.5 Mult");
  }
  if (gs.permaMult > 0) {
    mult += gs.permaMult;
    push(`Bola de Nieve: +${gs.permaMult.toFixed(1)} Mult`, "relic");
  }
  if (has("scaling_round")) {
    if (gs.permaMult > 0) {
      record(
        "scaling_round",
        true,
        "Bono acumulado de rondas anteriores",
        `+${gs.permaMult.toFixed(1)} Mult`
      );
    } else {
      record(
        "scaling_round",
        false,
        "Aún no has superado ninguna ronda con este modificador",
        null
      );
    }
  }

  // Modificadores que no dependen de la jugada seleccionada — resuelven
  // al terminar la ronda (dinero de reciclaje, interés, desbordamiento).
  // Se registran igualmente para que el panel de "activos en esta mano"
  // los muestre explícitamente como inactivos, con el motivo, en vez de
  // omitirlos en silencio.
  const ROUND_END_REASON: Record<string, string> = {
    discard_refund: "Se aplica al terminar la ronda (descartes sin usar)",
    interest: "Se aplica al terminar la ronda (interés sobre tu dinero)",
    overflow: "Se aplica si duplicas el objetivo al terminar la ronda",
  };
  for (const [id, reason] of Object.entries(ROUND_END_REASON)) {
    if (has(id) && !activationById.has(id)) {
      record(id, false, reason, null);
    }
  }

  mult = Math.max(0, mult);
  const total = Math.round(chips * mult);

  // Orden final: el mismo orden en que el jugador tiene los
  // modificadores (gs.relics), no el orden de las ramas de arriba —
  // así el panel de UI y el HUD de modificadores se leen coherentes.
  const activations: RelicActivation[] = gs.relics
    .map((r) => activationById.get(r.id))
    .filter((a): a is RelicActivation => a !== undefined);

  return {
    handName: hr.name,
    chips: Math.round(chips),
    mult: Math.round(mult * 10) / 10,
    total,
    lines,
    linesDetailed,
    activations,
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
