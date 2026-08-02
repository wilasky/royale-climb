# Balance — Iteración 2B (implementado)

> **Estado: implementado (2026-08-02).** Este documento nació como plan de
> diseño completo, escrito antes de tocar código; esta versión ya refleja lo
> que realmente se implementó (ver sección 11 para los resultados reales de
> build/lint/test y el orden real de commits, que se reordenó ligeramente
> respecto al plan original por una razón técnica documentada en esa sección).

## Evidencia del playtest (Iteración 2A)

Run normal de 9 rondas completada con demasiada facilidad:

- 8-9 modificadores obtenidos en una sola run (sin límite).
- Dinero final: 31$.
- Puntuación total: 30 980. Mejor jugada: 7 152.
- Objetivo ronda 8 (curva anterior): 4 299.
- R4 Full: 3 888 · R5 Doble pareja: 2 232 · R6 Escalera: 1 215 · R7 Full: 7 152.
- Una Carta alta llegó a ~855 puntos (síntoma de un modificador "universal").
- Tiendas: se podía comprar casi todo salvo ~1 objeto de 5$.
- Sin riesgo real de derrota; sin renuncias reales al construir la build.

## Problemas identificados (causa raíz)

1. **Sin límite de modificadores** → acumulación de 8-9 en vez de una build con huecos.
2. **Recompensa de modificador en las 9 rondas** → demasiadas oportunidades gratis.
3. **Economía sin fricción** → cobro por ronda + bonus se acumulan más rápido que
   los precios de tienda, dejando dinero sobrante sistemáticamente.
4. **Curva de objetivo exponencial genérica**, no calibrada contra el poder real
   que da una build con hasta 6 modificadores + compras de tienda.
5. **Un par de modificadores actúan como "siempre correctos" e independientes del
   tipo de mano** (El Coleccionista, Equilibrio Par con el As contando como par
   por una coincidencia de `%` en JS) — inflan cualquier mano, no solo la suya.

## Objetivos de diseño de esta iteración

Ver el encargo original: progresión satisfactoria, decisiones reales entre
modificadores, identidad de build, que el dinero importe, riesgo real en rondas
finales, terminar normalmente con 4-6 modificadores activos (6 posible pero
exige comprar, no solo recompensas gratis).

---

## 1. Límite de modificadores activos

- Nueva constante `MAX_ACTIVE_RELICS = 6` en `src/game/config.ts`.
- Nuevo módulo `src/game/relics.ts`:
  - `hasRelicCapacity(relics, max): boolean`
  - `replaceRelic(relics, removeId, added): Relic[]` (pura, sin mutar).
- **Recompensa gratuita (ronda 1/4/7) con 6 espacios ocupados:** al pulsar un
  modificador de la oferta, en vez de añadirlo directamente se abre un modal
  compartido `RelicReplaceModal` (reutilizado también por la tienda) mostrando
  los 6 modificadores actuales; el jugador selecciona cuál sustituir y confirma,
  o cancela sin que se pierda nada. "Saltar" sigue disponible siempre.
- **Compra en tienda con 6 espacios ocupados:** mismo modal. Si cancela, no se
  cobra dinero ni se pierde ningún modificador (la compra simplemente no ocurre).
- Interfaz mínima: contador "X/6 modificadores" visible en el HUD de partida y
  en las pantallas de recompensa/tienda (reutilizando `rc-eyebrow`, sin
  componentes nuevos de estilo).

## 2. Cadencia de recompensas

Nueva función pura `resolveRoundReward(round, endless)` en
`src/game/progression.ts`, sustituye al `resolveAfterReward` de la 2A (que ya
no distinguía tipos de recompensa, solo tienda/victoria/siguiente):

```
ronda % ROUNDS_PER_ANTE(3):
  1 → "relic"   (rondas 1, 4, 7, 10, 13...)
  2 → "money"   (rondas 2, 5, 8, 11, 14...)
  0 → "shop"    (rondas 3, 6, 9, 12...)
salvo que sea la ronda final de "Nueva partida" (ronda 9, no endless) → "victory"
  (esto pisa el "shop" natural de la ronda 9, igual que en la 2A)
```

**Decisión documentada:** el encargo solo define la tabla para las rondas 1-9
de Nueva partida. Para Endless (que no tiene tope), extiendo el mismo ciclo de
3 rondas indefinidamente (round%3) en vez de inventar una regla distinta — es
la continuación más conservadora y menos sorprendente del patrón ya definido.

Esto sustituye la arquitectura de disparo: `handleWinRound` (App.tsx) pasa a
decidir con `resolveRoundReward` inmediatamente al superar la puntuación de la
ronda, y despacha a: pantalla de recompensa de modificador, pantalla de
recompensa económica (nueva), tienda, o victoria. Las pantallas de
recompensa/tienda, al resolverse (elegir, sustituir, rechazar, o continuar),
simplemente avanzan a la ronda siguiente — ya no vuelven a decidir nada de
flujo ellas mismas (esa lógica ya no vive repartida en varios sitios).

## 3. Recompensa económica (nueva pantalla `MoneyRewardScreen`)

Cantidades deterministas por fase (mismo concepto de fase que las tablas de
rareza), constante `MONEY_REWARD_BY_PHASE`:

| Ronda | Fase | Cantidad | Motivo |
|---|---|---|---|
| 2 | 1 | 6$ | Pequeña, prepara la primera tienda sin financiarla entera |
| 5 | 2 | 9$ | Media, tras ya tener 2 modificadores y una compra previa |
| 8 | 3 | 12$ | Mayor — no hay tienda normal después, así que sirve de colchón para Endless; si el jugador para en la victoria, simplemente queda como dinero final "sobrante justificado" (no por comprar todo, sino porque no había dónde gastarlo) |

Decisión sobre la ronda 8 (una de las 3 opciones que planteaba el encargo):
**mantenerla como preparación para Endless**, la opción más simple y sin
sistemas nuevos. Documentado aquí explícitamente como pedía el encargo.

## 4. Rebalance de economía

| Elemento | Valor anterior | Valor nuevo | Justificación |
|---|---|---|---|
| Dinero inicial | 4$ | 4$ (sin cambio) | Contribución marginal comparado con el cobro por ronda; no es la causa del problema |
| Cobro base por ronda superada | `3 + handsLeft` (3-7$) | `2 + min(handsLeft, 2)` (2-4$) | El cobro automático de 9 rondas era el mayor contribuyente al excedente, independientemente de cualquier modificador |
| Intereses (Banca Privada) | +1$/5$ tenidos, tope +6$/ronda | +1$/6$ tenidos, tope +4$/ronda | Ya tenía tope (no crecía sin control), pero se aprieta en línea con el resto de la economía |
| Reciclaje, Oro, Desbordamiento | sin cambios | sin cambios | Ya tienen coste/condición real (no descartar, ceder un hueco de mano, doblar el objetivo) |
| Compensación por rechazar modificador ("Saltar") | 4$ fijo | 3$ fijo (`DECLINE_RELIC_COMPENSATION`) | 4$ quedaba demasiado cerca del común más barato (5$), incentivando "saltar y comprar" como estrategia sistemática |
| Precio modificador común | 5$ | 5$ (sin cambio) | Ya proporcionado a su impacto |
| Precio modificador raro | 7$ | 8$ | Ligero ajuste al alza, ahora que las rarezas altas aparecen con más frecuencia que en el sistema uniforme anterior |
| Precio modificador épico | 10$ | 12$ | Idem |
| Precio modificador legendario | 14$ | 18$ | Debe sentirse como un desembolso importante, no una compra casual |
| Cristal Frágil (mejora) | 5$ | 6$ | Riesgo/recompensa real, pero con techo alto (glass_master) |
| Núcleo de Acero (mejora) | 6$ | 7$ | Valor repetible cada mano de la ronda sin coste real más allá de un hueco de mano — de las mejoras más rentables por dinero invertido |
| Lámina de Oro, Tinta Brillante, Tintura de Palo | sin cambios | sin cambios | Ya proporcionadas |

**Dinero esperado por fase (estimación razonada, no simulada — hipótesis a
validar en el próximo playtest):**

- Entrando a la tienda 1 (tras ronda 3): ~20$ → alcanza para 1 modificador
  relevante + 1 mejora barata, o 2 mejoras baratas.
- Entrando a la tienda 2 (tras ronda 6): ~15-20$ (asumiendo que gastó la mayor
  parte en la tienda 1) → una compra potente o varias menores.
- Al terminar la ronda 9: bajo si compró activamente; solo queda dinero
  "sobrante" si conscientemente ahorró o si no había nada que le interesara
  comprar.

## 5. Curva de objetivo (tabla explícita, no fórmula global)

| Ronda | Objetivo anterior | Objetivo nuevo | Razonamiento |
|---|---|---|---|
| 1 | 200 | 180 | Accesible, 1 mano decente la supera |
| 2 | 310 | 280 | Aún 1-2 manos |
| 3 | 481 | 450 | Primera tienda ya pasada en la ronda anterior; 2 manos típicas |
| 4 | 745 | 700 | 2-3 manos, primer modificador ya en juego |
| 5 | 1 154 | 1 050 | 2-3 manos, necesita algo de sinergia |
| 6 | 1 789 | 1 900 | Punto de inflexión: exige empezar a tener una build coherente |
| 7 | 2 773 | 3 200 | Build real necesaria; una mano fuerte podría resolverla sola |
| 8 | 4 299 | 5 200 | Reto serio con 3-6 modificadores |
| 9 | 6 663 | 8 500 | Riesgo real de derrota para una build mediocre |

Endless (`ENDLESS_TARGET_GROWTH = 1.6`, continúa desde la ronda 9):
`target(r) = target(9) * 1.6^(r-9)` para r > 9. Ejemplos: r10≈13 600,
r11≈21 760, r12≈34 816. Sin salto discontinuo en la ronda 10 (la tasa de
crecimiento ronda 8→9 ya era ~1.63, similar).

**Nota honesta:** estos números son una estimación razonada a partir de la
matemática de `scorePlay` y de los datos reales del playtest (que sirven como
cota superior de lo alcanzable con una build sobrecargada), no el resultado de
una simulación exhaustiva — explícitamente fuera de alcance de esta iteración.
Quedan marcados como hipótesis a validar en el próximo playtest.

## 6. Clasificación y ajustes de los 24 modificadores

### Clasificación por categoría (8 categorías pedidas)

| Modificador | Categoría |
|---|---|
| Eco Gemelo (`pair_mult`) | Mejoras de arquetipo (parejas) |
| Marea Cromática (`flush_chips`) | Mejoras de arquetipo (color/mono-palo) |
| Senda Recta (`straight_mult`) | Mejoras de arquetipo (escalera) |
| Filo Negro (`spades_chip`) | Bonus de fichas (mono-palo ♠) |
| Pulso Carmesí (`hearts_mult`) | Bonus aditivo de Mult (mono-palo ♥) |
| Veta Dorada (`diamonds_money`) | Economía (mono-palo ♦) |
| Garrote Pesado (`clubs_chip`) | Bonus de fichas (mono-palo ♣) |
| Salida en Falso (`first_hand_mult`) | Condicionales (1ª mano) |
| Plebe Útil (`low_card_chip`) | Bonus de fichas (rango bajo) |
| Corte Noble (`face_mult`) | Bonus aditivo de Mult (figuras) |
| Reciclaje (`discard_refund`) | Economía (descartes no usados) |
| Mano Firme (`no_discard_mult`) | Condicionales (0 descartes, riesgo real) |
| As bajo la Manga (`ace_chip`) | Bonus de fichas (Ases) |
| Cadena Doble (`pair_chain`) | Mejoras de arquetipo (doble pareja) |
| Bola de Nieve (`scaling_round`) | Mejoras universales (pasivo, crece con la run) |
| Banca Privada (`interest`) | Economía — **cambiado** (ver tabla abajo) |
| Maestro del Vidrio (`glass_master`) | Utilidad-consistencia (elimina riesgo de cristal) |
| Minimalista (`small_hand`) | Condicionales (≤2 cartas) |
| Prisma Roto (`spectrum_boost`) | Mejoras de arquetipo (espectro, arquetipo débil) |
| Equilibrio Par (`even_odd`) | Multiplicador final, condicional — **cambiado** (ver tabla abajo) |
| Pacto de Sangre (`blood_pact`) | Multiplicador final, universal (con riesgo: −1 mano) |
| Desbordamiento (`overflow`) | Economía (condicional a superar x2) |
| El Coleccionista (`the_collector`) | Multiplicador final, universal — **cambiado** (ver tabla abajo) |
| Última Palabra (`final_hand`) | Condicionales (última mano) |

Reparto por categoría: Bonus de fichas (4), Bonus aditivo de Mult (2),
Multiplicador final (3), Economía (4), Condicionales (4),
Utilidad-consistencia (1), Mejoras universales (1), Mejoras de arquetipo (5).
Las 8 categorías pedidas quedan todas representadas.

### Cambios aplicados (conservadores, 3 de 24)

| Modificador | Rareza | Categoría | Valor anterior | Valor nuevo | Motivo | Build afectada | Riesgo |
|---|---|---|---|---|---|---|---|
| Equilibrio Par (`even_odd`) | Épica | Multiplicador final, condicional | ×4, cuenta el As como par (`14 % 2 === 0`, artefacto de JS no documentado — ver `GAME_AUDIT.md` P2-5) | ×3, el As deja de contar como par | El As contando como par hacía la condición más fácil de lo que parecía (7 de 13 rangos, incluido el más valioso); además es de los multiplicadores finales más grandes del juego | Builds "todo par" | Bajo — se mantiene la identidad, solo dos números |
| El Coleccionista (`the_collector`) | Legendaria | Multiplicador final, universal | +3 Mult por modificador poseído (sin condición de tipo de mano) | +2 Mult por modificador poseído | Es el candidato más claro a "beneficia cualquier mano" y "siempre es la elección correcta" — probablemente el responsable directo de la Carta Alta de ~855 puntos del playtest. Con el nuevo tope de 6 modificadores, su techo ya baja solo de +18 (6×3, antes hasta +27 con 9) a +12 (6×2) | Ninguna build específica (por diseño) | Medio — sigue siendo fuerte, pero dominaba antes por ser universal y sin techo real |
| Banca Privada (`interest`) | Épica | Economía | +1$/5$, tope +6$/ronda | +1$/6$, tope +4$/ronda | Ver tabla de economía (sección 4) | Builds económicas | Bajo |

### Modificadores sin cambios (21 de 24) — motivo breve

- **Comunes de palo** (Filo Negro, Pulso Carmesí, Veta Dorada, Garrote Pesado):
  ya proporcionados a su rareza, requieren inclinación de mazo hacia un palo
  (coste real de deckbuilding).
- **Eco Gemelo, Senda Recta, Marea Cromática, Cadena Doble, Plebe Útil, Corte
  Noble, As bajo la Manga:** arquetipos ya identificados como "delgados" en
  `GAME_AUDIT.md` (P1-3) — necesitan más apoyo, no menos. Tocarlos a la baja
  iría en contra del objetivo de la propia auditoría.
- **Salida en Falso, Última Palabra:** multiplicadores fuertes pero limitados a
  1 de 4 manos por ronda — condición real ya presente.
- **Mano Firme:** `GAME_AUDIT.md` lo señala explícitamente como de los pocos
  modificadores con riesgo/recompensa real (no poder pulir manos malas en toda
  la ronda); se mantiene.
- **Reciclaje, Lámina de Oro, Desbordamiento:** coste/condición real ya
  existente (ceder huecos de mano, no descartar, doblar objetivo).
- **Bola de Nieve:** crece de forma aditiva y gradual con las rondas
  superadas, ya autolimitado por el ritmo de la partida.
- **Maestro del Vidrio, Prisma Roto, Minimalista, Pacto de Sangre,
  Espectro/Equilibrio del resto:** ya identificados con coste/condición real o
  arquetipo débil que necesita apoyo, no recorte.

## 7. Decisiones interesantes (rechazo de recompensa)

- `DECLINE_RELIC_COMPENSATION = 3$` (ver sección 4), constante única, no
  escala con la rareza rechazada.
- Con 6 espacios ocupados: reemplazar, rechazar, o cancelar — nunca se pierde
  un modificador de forma automática.

## 8. Arquitectura implementada (archivos)

Nuevos: `src/game/relics.ts`, `src/game/relics.test.ts`, `src/game/economy.ts`,
`src/game/economy.test.ts`.
Modificados: `src/game/config.ts`, `src/game/progression.ts`,
`src/game/progression.test.ts`, `src/game/scoring.ts`, `src/game/scoring.test.ts`,
`src/game/types.ts` (union `Screen` con `"money-reward"`), `src/App.tsx`
(`RelicReplaceModal` y `MoneyRewardScreen` nuevos, `handleWinRound` despacha
según `resolveRoundReward`, `advanceToNextRound` sustituye a
`proceedAfterReward`, precios de tienda vía `relicPrice`, contador X/6 en HUD
y pantallas de recompensa/tienda, fix del bug de `boughtRelics` en
`ShopScreen`).

## 9. Plan de commits — orden real ejecutado

El plan original (sección de "commits" del encargo) proponía el orden
límite→cadencia→economía→curva→balance→tests. Se reordenó **curva de
dificultad primero**: al iniciar la implementación, `config.ts` ya tenía
`ROUND_TARGETS`/`ENDLESS_TARGET_GROWTH` aplicados de una edición previa que
había eliminado `TARGET_BASE`/`TARGET_GROWTH`, dejando el build roto (import
muerto en `progression.ts`). Arreglar la curva era el único cambio que
restauraba un `build`/`test` en verde, así que pasó a ser el primer commit;
el resto mantiene el orden conceptual del plan original. Cada bloque de
tests se incluyó en el commit que introduce el cambio que testea, no todos
al final, para que cada commit individual deje `build`+`test` en verde.

1. Curva de dificultad por tabla explícita (arregla el build).
2. Límite de 6 modificadores y reemplazo (`relics.ts` + integración UI).
3. Cadencia de recompensas (`resolveRoundReward` + `MoneyRewardScreen`).
4. Economía y precios (`economy.ts` + tabla de precios).
5. Balance conservador de modificadores (even_odd, the_collector; interest ya
   cubierto en el commit de economía).
6. Documentación (este documento + `CHANGELOG_GAMEPLAY.md`).

## 10. Decisiones de implementación no explícitas en el plan original

- `resolveAfterReward`/`RoundOutcome` (2A) se eliminaron sin dejar alias:
  respondían a una pregunta distinta ("qué pasa después de la recompensa")
  de la nueva `resolveRoundReward` ("qué tipo de recompensa toca antes de
  mostrarla"). `resolveAfterShop` se mantuvo igual, reutilizada dentro de un
  nuevo `advanceToNextRound(g)` en `App.tsx`.
- `MONEY_REWARD_BY_PHASE` se indexa por `phaseForRound(round)` (tope en
  fase 3), no por número de ronda literal, para que Endless (rondas 11, 14,
  17...) herede el mismo importe que la fase 3 sin caso especial.
- Se eliminó el estado local `boughtRelics` de `ShopScreen` (bug latente: se
  habría marcado "comprado" en el clic aunque el jugador cancelara un
  reemplazo) y se derivó de `gs.relics.some(r => r.id === relic.id)`.
- Confirmar un reemplazo desde la pantalla de recompensa avanza de ronda
  automáticamente; desde la tienda no avanza (el jugador sigue comprando
  hasta pulsar "Continuar"). Cancelar nunca cobra ni pierde nada, en ningún
  contexto.

## 11. Verificación final y resultados reales

- `npm run build`: **correcto**, 24 módulos, sin errores de tipos. Único
  warning preexistente (P2-1 del audit, orden de `@import` de Google Fonts
  en `src/index.css`), no relacionado con esta iteración.
- `npm run lint` (`oxlint`): **correcto**, sin errores.
- `npm test` (`vitest run`): **correcto**, 5 archivos de test, 63 pruebas
  (`progression`/`rewards`/`scoring`/`relics`/`economy`), todas en verde tras
  cada commit.
- Verificación manual: ver checklist en la sección "Verificación final" del
  encargo original — completada tras el último commit de esta iteración
  (reinicio limpio de `npm run dev`, run completa de 9 rondas, límite y
  reemplazo de modificadores, precios, Endless desde ronda 10).

## 12. Riesgos pendientes e hipótesis a validar en el próximo playtest

- La curva de objetivo (sección 5) y las cantidades de dinero esperado por
  fase (sección 4) son estimaciones razonadas a partir de la matemática de
  `scorePlay`, no de una simulación exhaustiva — quedan como hipótesis.
- Con el límite de 6 modificadores, comprobar en el próximo playtest si:
  - la run termina normalmente con 4-6 modificadores (objetivo de diseño),
    no con 8-9 como antes ni sistemáticamente con solo 2-3 (demasiado
    restrictivo);
  - el dinero disponible en cada tienda obliga a elegir (no sobra
    sistemáticamente, no se queda corto sistemáticamente);
  - la ronda 9 presenta riesgo real de derrota para una build mediocre, sin
    que una build fuerte deje de poder superarla de una sola mano;
  - `even_odd` sin el As sigue siendo una identidad de build viable (no se
    ha vuelto demasiado débil al perder 1 de 13 rangos);
  - `the_collector` sigue siendo una elección válida sin dominar como
    "siempre correcta" independientemente de la mano.
