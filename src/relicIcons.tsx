/* ============================================================
   Iconos de modificadores y mejoras — trazo neón propio.
   Sustituye a los emoji nativos (inconsistentes entre sistemas,
   look "sticker de chat"). Un solo path simple por icono, mismo
   grosor de trazo, para que la baraja de iconos se sienta como
   un set diseñado y no como una colección suelta.
   ============================================================ */

import type { ReactNode } from "react";

type IconDef = { viewBox?: string; content: ReactNode };

const ICONS: Record<string, IconDef> = {
  pair_mult: {
    content: (
      <>
        <circle cx="9" cy="12" r="6" />
        <circle cx="15" cy="12" r="6" />
      </>
    ),
  },
  flush_chips: {
    content: (
      <>
        <path d="M2 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        <path d="M2 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        <path d="M2 20c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      </>
    ),
  },
  straight_mult: {
    content: <path d="M3 20h4v-4h4v-4h4v-4h4V4" />,
  },
  spades_chip: {
    content: (
      <path d="M12 3c4 4 8 8 8 12a4 4 0 0 1-7 2.5c.3 2 1 3 2 3.5H9c1-.5 1.7-1.5 2-3.5A4 4 0 0 1 4 15c0-4 4-8 8-12Z" />
    ),
  },
  hearts_mult: {
    content: (
      <path d="M12 20s-7-4.5-9.5-9C.8 7.7 3 4.2 6.4 4.2 9 4.2 11 6.2 12 7.7c1-1.5 3-3.5 5.6-3.5 3.4 0 5.6 3.5 3.9 6.8C19 15.5 12 20 12 20Z" />
    ),
  },
  diamonds_money: {
    content: (
      <>
        <path d="M12 2 20 12 12 22 4 12Z" />
        <path d="M9 12h6" />
      </>
    ),
  },
  clubs_chip: {
    content: (
      <>
        <circle cx="12" cy="8" r="3.3" />
        <circle cx="8" cy="13.2" r="3.3" />
        <circle cx="16" cy="13.2" r="3.3" />
        <path d="M12 14v7" />
      </>
    ),
  },
  first_hand_mult: {
    content: (
      <>
        <path d="M12 2c3 2 4 6 4 10 0 2-1 4-2 5l-2 3-2-3c-1-1-2-3-2-5 0-4 1-8 4-10Z" />
        <path d="M9 15l-3 2 1-4" />
        <path d="M15 15l3 2-1-4" />
        <circle cx="12" cy="10" r="1.5" />
      </>
    ),
  },
  low_card_chip: {
    content: (
      <>
        <circle cx="5" cy="19" r="1.6" />
        <circle cx="10.3" cy="14.7" r="1.6" />
        <circle cx="15.6" cy="9.3" r="1.6" />
        <circle cx="20" cy="5" r="1.6" />
      </>
    ),
  },
  face_mult: {
    content: (
      <>
        <path d="M4 18h16l-1-8-4 4-3-6-3 6-4-4Z" />
        <path d="M4 20.5h16" />
      </>
    ),
  },
  discard_refund: {
    content: (
      <>
        <path d="M12 3a9 9 0 0 1 8 4.7" />
        <path d="M20 3v5h-5" />
        <path d="M21 15a9 9 0 0 1-15 5.3" />
        <path d="M2 21v-5h5" />
      </>
    ),
  },
  no_discard_mult: {
    content: (
      <>
        <path d="M7 11V7a2 2 0 1 1 4 0v4" />
        <path d="M11 11V6a2 2 0 1 1 4 0v5" />
        <path d="M15 11V8a2 2 0 1 1 4 0v6.5A6.5 6.5 0 0 1 12.5 21H11a5 5 0 0 1-4-2l-3.2-4.3a1.8 1.8 0 0 1 2.6-2.4L7 14" />
      </>
    ),
  },
  ace_chip: {
    content: (
      <>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M12 8l-2.4 6h4.8L12 8Z" />
      </>
    ),
  },
  pair_chain: {
    content: (
      <>
        <rect x="3" y="8" width="9" height="8" rx="4" />
        <rect x="12" y="8" width="9" height="8" rx="4" />
      </>
    ),
  },
  scaling_round: {
    content: (
      <path d="M12 2v20M4 7l16 10M20 7 4 17M7 4l10 16M17 4 7 20" />
    ),
  },
  interest: {
    content: (
      <>
        <path d="M3 10l9-6 9 6" />
        <path d="M5 10v9M9.3 10v9M14.7 10v9M19 10v9" />
        <path d="M3 21h18" />
      </>
    ),
  },
  glass_master: {
    content: (
      <>
        <path d="M12 2 20 8l-3 12H7L4 8Z" />
        <path d="M12 2v18M4 8h16" />
      </>
    ),
  },
  small_hand: {
    content: (
      <>
        <path d="M8 6l-3.2 6L8 18" />
        <path d="M16 6l3.2 6L16 18" />
      </>
    ),
  },
  spectrum_boost: {
    content: (
      <>
        <path d="M12 3 19 9l-2 10H7L5 9Z" />
        <path d="M2 5l3 3M22 5l-3 3M12 3v4" />
      </>
    ),
  },
  even_odd: {
    content: (
      <>
        <path d="M12 3v18" />
        <path d="M5 7h14" />
        <path d="M5 7 2 13a3 3 0 0 0 6 0Z" />
        <path d="M19 7l-3 6a3 3 0 0 0 6 0Z" />
      </>
    ),
  },
  blood_pact: {
    content: <path d="M12 3s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13Z" />,
  },
  overflow: {
    content: (
      <path d="M12 2l2 6 6-2-4 5 4 5-6-2-2 6-2-6-6 2 4-5-4-5 6 2Z" />
    ),
  },
  the_collector: {
    content: (
      <>
        <rect x="3" y="9" width="18" height="11" rx="2" />
        <path d="M3 13.5h18" />
        <path d="M8 9V7a4 4 0 0 1 8 0v2" />
      </>
    ),
  },
  final_hand: {
    content: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      </>
    ),
  },
  /* --- mejoras de carta (SPECIAL_DEFS, keyed por "kind") --- */
  bonus: {
    content: (
      <path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4Z" />
    ),
  },
  glass: {
    content: (
      <>
        <path d="M12 2 18 9l-6 13L6 9Z" />
        <path d="M12 2v20" />
      </>
    ),
  },
  steel: {
    content: <path d="M12 2l7 3v6c0 5-3 8-7 11-4-3-7-6-7-11V5Z" />,
  },
  gold: {
    content: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.2 9.6a3 3 0 0 1 5.6 1.4c0 2.6-5.6 1.3-5.6 4a3 3 0 0 0 5.6 1.4" />
      </>
    ),
  },
  suitconv: {
    content: (
      <>
        <path d="M12 21a9 9 0 1 1 0-18c4 0 8 2 8 6 0 2-1.5 3-3.5 3H14a2 2 0 0 0 0 4h.5a1.5 1.5 0 0 1 0 3A9 9 0 0 1 12 21Z" />
        <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
        <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
        <circle cx="12.3" cy="7.6" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
};

const FALLBACK: ReactNode = <circle cx="12" cy="12" r="7" />;

export function RelicGlyph({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const def = ICONS[id];
  return (
    <svg
      viewBox={def?.viewBox ?? "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {def?.content ?? FALLBACK}
    </svg>
  );
}

/* ---- insignia circular con glow, reutilizada en tienda/recompensa/HUD ---- */
export function RelicBadge({
  id,
  size = 40,
  ringClass,
}: {
  id: string;
  size?: number;
  ringClass: string;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full border-2 bg-black/30 ${ringClass}`}
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 14px -2px currentColor, inset 0 0 8px -2px currentColor",
      }}
    >
      <RelicGlyph id={id} className="h-[58%] w-[58%]" />
    </div>
  );
}
