/* ============================================================
   Resúmenes compactos de modificador — Iteración 2G
   (docs/GAME_FEEL_2G.md, sección 2). Puramente presentacional: una
   condición y un efecto reducidos a un par de palabras cada uno, para
   mostrar siempre visibles ("Pareja → +6 Mult") en vez de obligar al
   jugador a abrir un tooltip para leer la frase completa de `Relic.desc`
   (que sigue existiendo tal cual y se muestra en el tooltip completo).
   No cambia ningún valor de modificador — es una segunda redacción del
   mismo texto que ya está en RELIC_POOL (App.tsx), no una fuente de
   verdad nueva sobre el efecto.
   ============================================================ */

export interface RelicSummary {
  condition: string;
  effect: string;
}

export const RELIC_SUMMARIES: Record<string, RelicSummary> = {
  pair_mult: { condition: "Pareja", effect: "+6 Mult" },
  flush_chips: { condition: "Color", effect: "+60 fichas" },
  straight_mult: { condition: "Escalera", effect: "+5 Mult" },
  spades_chip: { condition: "♠ jugada", effect: "+12 fichas/♠" },
  hearts_mult: { condition: "♥ jugada", effect: "+1 Mult/♥" },
  diamonds_money: { condition: "♦ jugada", effect: "+1$/♦" },
  clubs_chip: { condition: "♣ jugada", effect: "+10 fichas/♣" },
  first_hand_mult: { condition: "1ª mano de la ronda", effect: "×3 Mult" },
  low_card_chip: { condition: "Cartas 2-6", effect: "+18 fichas/carta" },
  face_mult: { condition: "Figura (J/Q/K)", effect: "+2 Mult/figura" },
  discard_refund: { condition: "Fin de ronda", effect: "+2$/descarte sin usar" },
  no_discard_mult: { condition: "Sin descartes en la ronda", effect: "×2 Mult" },
  ace_chip: { condition: "As jugado", effect: "+25 fichas/As" },
  pair_chain: { condition: "Doble pareja", effect: "+4 Mult, +30 fichas" },
  scaling_round: { condition: "Ronda superada", effect: "+0.5 Mult permanente" },
  interest: { condition: "Fin de ronda", effect: "+1$/6$ (máx 4$)" },
  glass_master: { condition: "Cartas de cristal", effect: "×4 en vez de ×2, inmune" },
  small_hand: { condition: "1-2 cartas jugadas", effect: "+50 fichas, +4 Mult" },
  spectrum_boost: { condition: "Espectro", effect: "×3 Mult" },
  even_odd: { condition: "Todo par (sin Ases)", effect: "×3 Mult" },
  blood_pact: { condition: "Siempre", effect: "×2.5 Mult, -1 mano/ronda" },
  overflow: { condition: "Objetivo ×2", effect: "+8$" },
  the_collector: { condition: "Por modificador poseído", effect: "+2 Mult c/u" },
  final_hand: { condition: "Última mano de la ronda", effect: "×4 Mult" },
};

/** Resumen compacto de un modificador por id, o null si no está catalogado. */
export function relicSummary(id: string): RelicSummary | null {
  return RELIC_SUMMARIES[id] ?? null;
}
