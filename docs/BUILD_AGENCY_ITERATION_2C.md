# Control del azar e identidad de build — Iteración 2C

> Implementado sobre `design-overhaul`, a partir del commit `fdb0d84`
> (Iteración 2B, sección de documentación final). Esta iteración **no
> toca balance base**: ni curva de dificultad, ni objetivos de ronda,
> ni precios, ni recompensas económicas, ni el límite de 6
> modificadores, ni valores numéricos de modificadores. La 2B todavía
> no tiene un playtest humano posterior que la valide — cambiar el
> balance ahora habría mezclado dos variables a la vez.

## 1. Problema original

Tras la Iteración 2B, el jugador ya tiene rarezas reales y un tope de
modificadores, pero sigue sin ninguna herramienta para **perseguir**
una identidad de build concreta: toda la conformación de la run
depende de qué ofrezca el RNG, sin margen de maniobra. Una oferta
mala en un momento clave (p.ej. las tres opciones de la ronda 1 sin
relación entre sí) puede condicionar el resto de la partida sin que
el jugador pueda hacer nada al respecto.

## 2. Objetivos de esta iteración

- El jugador puede perseguir una build activamente (reroll, banish).
- Una mala oferta puntual ya no arruina la run entera.
- El control sobre el azar es limitado y cuesta dinero — no es gratis
  ni ilimitado.
- Las decisiones económicas (reroll/banish vs. ahorrar para tienda)
  compiten de verdad entre sí.
- Las builds emergen de forma orgánica: el sesgo de sinergia ayuda,
  no garantiza.
- Semillas distintas siguen generando runs distintas; la misma seed
  con las mismas decisiones sigue siendo 100% reproducible.

Explícitamente fuera de alcance: elegir el modificador exacto que se
quiere, rerolls gratuitos o ilimitados, builds garantizadas, garantía
de que siempre aparezca algo útil.

## 3. Arquetipos de build

12 categorías (`src/game/archetypes.ts`), la mayoría literal del
encargo más `GENERAL` para efectos universales que no definen una
identidad de build:

`PAIR`, `STRAIGHT`, `FLUSH`, `LOW_CARDS`, `HIGH_CARDS`, `SMALL_HAND`,
`FIRST_HAND`, `LAST_HAND`, `NO_DISCARD`, `ECONOMY`,
`CARD_ENHANCEMENT`, `GENERAL`.

Cada modificador tiene un arquetipo **primario**, cero o más
**secundarios**, y un **rol** funcional:

- `starter`: entrada barata y directa a un arquetipo (comunes de mano).
- `enabler`: apoya el arquetipo sin ser el pago final (bonus por palo).
- `payoff`: recompensa grande condicionada a la mano/situación objetivo.
- `utility`: efecto útil puntual, no define identidad por sí solo.
- `generalist`: funciona igual de bien en cualquier build.

### Tabla completa (24 modificadores)

| Modificador | Rareza | Arquetipo primario | Secundarios | Rol |
|---|---|---|---|---|
| Eco Gemelo (`pair_mult`) | Común | PAIR | — | starter |
| Marea Cromática (`flush_chips`) | Común | FLUSH | — | starter |
| Senda Recta (`straight_mult`) | Común | STRAIGHT | — | starter |
| Filo Negro (`spades_chip`) | Común | FLUSH | — | enabler |
| Pulso Carmesí (`hearts_mult`) | Común | FLUSH | — | enabler |
| Veta Dorada (`diamonds_money`) | Común | ECONOMY | FLUSH | enabler |
| Garrote Pesado (`clubs_chip`) | Común | FLUSH | — | enabler |
| Salida en Falso (`first_hand_mult`) | Rara | FIRST_HAND | — | payoff |
| Plebe Útil (`low_card_chip`) | Rara | LOW_CARDS | — | payoff |
| Corte Noble (`face_mult`) | Rara | HIGH_CARDS | — | payoff |
| Reciclaje (`discard_refund`) | Rara | ECONOMY | NO_DISCARD | utility |
| Mano Firme (`no_discard_mult`) | Rara | NO_DISCARD | — | payoff |
| As bajo la Manga (`ace_chip`) | Rara | HIGH_CARDS | — | payoff |
| Cadena Doble (`pair_chain`) | Rara | PAIR | — | payoff |
| Bola de Nieve (`scaling_round`) | Épica | GENERAL | — | generalist |
| Banca Privada (`interest`) | Épica | ECONOMY | — | payoff |
| Maestro del Vidrio (`glass_master`) | Épica | CARD_ENHANCEMENT | — | payoff |
| Minimalista (`small_hand`) | Épica | SMALL_HAND | — | payoff |
| Prisma Roto (`spectrum_boost`) | Épica | FLUSH | — | payoff |
| Equilibrio Par (`even_odd`) | Épica | GENERAL | — | payoff |
| Pacto de Sangre (`blood_pact`) | Legendaria | GENERAL | — | generalist |
| Desbordamiento (`overflow`) | Legendaria | ECONOMY | — | utility |
| El Coleccionista (`the_collector`) | Legendaria | GENERAL | — | generalist |
| Última Palabra (`final_hand`) | Legendaria | LAST_HAND | — | payoff |

### Dos decisiones de encaje forzado (documentadas explícitamente)

- **Prisma Roto (`spectrum_boost`) → FLUSH.** Espectro (5 cartas del
  mismo color, sin ser Color) no es literalmente un palo, pero es la
  misma familia conceptual — "concentración de color/suits" — que ya
  cubre FLUSH según la lista de arquetipos del encargo. No se creó un
  arquetipo `SPECTRUM` aparte para no ampliar la lista pedida.
- **Equilibrio Par (`even_odd`) → GENERAL.** Depende de la paridad de
  rango de las cartas jugadas (todas pares, sin contar el As desde la
  2B), no de ningún arquetipo de mano de la lista. No encaja de forma
  honesta en ninguno de los 11 arquetipos concretos, así que queda en
  GENERAL en vez de forzarlo en uno equivocado (p.ej. HIGH_CARDS o
  LOW_CARDS, ninguno de los cuales describe realmente su condición).

Este paso es puramente declarativo: `src/game/archetypes.ts` no
cambia el comportamiento de ningún modificador.

## 4. Medir la identidad de la build

`src/game/buildIdentity.ts::computeBuildIdentity(relics)`:

- Cuenta piezas por arquetipo (un modificador con secundarios suma a
  cada arquetipo que toca).
- Traduce el conteo a intensidad: 0 = sin afinidad, 1 = débil,
  2 = afinidad, 3+ = build claramente orientada
  (`affinityStrength`).
- Calcula el arquetipo **dominante**: el de más piezas, **excluyendo
  GENERAL siempre**, aunque GENERAL tenga más piezas que cualquier
  otro arquetipo presente. Una build con Bola de Nieve + Pacto de
  Sangre + El Coleccionista + Equilibrio Par (4 piezas GENERAL) y un
  solo Eco Gemelo (1 pieza PAIR) tiene dominante `PAIR`, no `GENERAL`.

`dominantArchetypes(relics, minCount, max)` es el helper de más alto
nivel, usado tanto por el sesgo de sinergia (`minCount=2`) como por
la etiqueta del HUD (`minCount=2, max=2`).

## 5. Reroll de recompensa

`RewardScreen` — botón "Volver a tirar":

| Intento | Coste |
|---|---|
| 1º | 3$ |
| 2º | 5$ |
| 3º | 7$ |

Máximo 3 rerolls por recompensa (`REWARD_REROLL_MAX`,
`REWARD_REROLL_COSTS`, `src/game/config.ts`). El contador vive en el
propio componente (no en `gs`), así que se reinicia solo en la
siguiente recompensa. El coste se descuenta al confirmar, nunca
antes; la nueva oferta solo se calcula (y por tanto solo consume RNG)
dentro del propio handler de clic, nunca especulativamente.

`pickRelicsAvoidingRepeat` (`src/game/rewards.ts`): si el reroll
produce exactamente la misma oferta que la anterior y el pool tiene
margen para una alternativa real, vuelve a tirar una vez más — no es
una garantía (con pool muy reducido puede no haber alternativa), solo
evita el caso más chocante.

Todas las opciones previas se mantienen intactas: elegir un
modificador, saltar (+3$, sin cambios de la 2B), y el modal de
reemplazo si ya hay 6/6.

## 6. Reroll de tienda

`ShopScreen` — botón "Volver a tirar tienda":

| Intento | Coste |
|---|---|
| 1º | 3$ |
| 2º | 5$ |
| 3º y 4º | 7$ |

Máximo 4 rerolls por tienda (`SHOP_REROLL_MAX=4`,
`SHOP_REROLL_COSTS=[3,5,7]`, el índice se limita al último valor de
la tabla). Al rerollear se regeneran únicamente los objetos todavía
disponibles para compra:

- Los modificadores ya comprados no reaparecen porque ya están en
  `gs.relics` y `pickRelicOffer` los excluye automáticamente (misma
  lógica que excluye poseídos en general).
- Las mejoras de carta ya aplicadas tampoco reaparecen. Para esto,
  el tracking de "usado" pasó de índice de array (`usedSpecials`,
  se habría roto con cualquier reordenación al rerollear) a
  identificarse por `kind` estable (`usedSpecialKinds: Set<SpecialCardKind>`).
- Las probabilidades ponderadas por rareza de la 2A se mantienen sin
  cambios; los precios no se tocan.

## 7. Sesgo de sinergia (synergy bias)

`src/game/offers.ts::pickRelicOffer` sustituye a las llamadas
directas a `pickRelics` en `RewardScreen`/`ShopScreen` (oferta
inicial y reroll). Orden de aplicación, tal como pide el encargo:

1. **Restricciones de rareza** — pesos existentes de la 2A, sin
   cambios.
2. **Exclusión de poseídos y desterrados** — `excludeIds` es la unión
   de `gs.relics` y `gs.banishedRelicIds`.
3. **Cálculo de afinidades actuales** — `computeBuildIdentity(gs.relics)`.
4. **Bonus moderado de peso** — si hay un arquetipo dominante con al
   menos `SYNERGY_MIN_AFFINITY=2` piezas, los candidatos que
   pertenecen a ese arquetipo (primario o secundario) reciben un
   multiplicador `1 + SYNERGY_BONUS` (`SYNERGY_BONUS=0.3`, +30%)
   sobre su **peso de rareza**, nunca lo sustituyen. `pickRelics`
   ganó un parámetro opcional `weightMultiplier` para esto,
   retrocompatible (todas las llamadas existentes sin ese argumento
   siguen funcionando exactamente igual).
5. **Sorteo final determinista** — mismo algoritmo de muestreo
   ponderado sin reemplazo de la 2A, solo con los pesos ya ajustados.

**Por qué esto no salta las restricciones de fase**: el multiplicador
se aplica multiplicando el peso de rareza, nunca sustituyéndolo. Un
legendario en fase 1 tiene peso `0`; `0 × 1.3 = 0`. Sigue excluido
pase lo que pase. Verificado con test dedicado (`offers.test.ts`).

**Por qué esto no es "elige lo que quieras"**: +30% de peso sobre un
candidato entre varios de la misma rareza sigue dejando una
probabilidad mayoritaria de que el sorteo caiga en otro. Con un
ejemplo mínimo de 2 candidatos de igual peso (1 relacionado, 1 no), la
probabilidad teórica del relacionado pasa de 50% a ≈56.5% — una
inclinación real pero lejos de una garantía.

### Best-effort de variedad (sección 6 del encargo)

Tras generar la oferta con sesgo, si existe un arquetipo dominante:

- Si **ningún** candidato de la oferta pertenece al arquetipo
  dominante, intenta sustituir el último hueco por un candidato
  relacionado disponible en el pool restante.
- Si **todos** los candidatos de la oferta pertenecen al arquetipo
  dominante, intenta sustituir el último hueco por un candidato
  generalista/no relacionado disponible.
- Si el pool no tiene alternativa en ninguno de los dos casos, la
  oferta se deja tal cual salió del sorteo ponderado — es una
  preferencia, no una garantía absoluta, exactamente como pide el
  encargo ("si el pool lo permite").

Esta corrección solo toca **un** hueco de la oferta como máximo; el
resto sigue viniendo del sorteo ponderado normal, así que una oferta
de 3 nunca queda 100% forzada por esta lógica.

## 8. Destierro limitado (banish)

Botón "Desterrar" en cada modificador ofrecido (recompensa) o en
stock (tienda), nunca sobre modificadores ya comprados/poseídos.

| Destierro | Coste |
|---|---|
| 1º | Gratis |
| 2º | 5$ |

Máximo 2 destierros por run (`BANISH_MAX=2`, `BANISH_COSTS=[0,5]`).
Reglas (`src/game/banish.ts`, puras, sin mutar arrays):

- `canBanish`/`banishCost`/`applyBanish`/`isBanished`.
- El modificador desterrado se quita de la oferta visible al
  instante (estado local del componente) y se excluye de toda
  generación de oferta futura de esa run (`gs.banishedRelicIds` se
  une a `excludeIds` en `pickRelicOffer`).
- `gs.banishedRelicIds` es parte de `GameState`: `startRound` y
  `beginEndlessContinuation` ya lo arrastran vía *spread* sin lógica
  extra, así que persiste entre rondas/tiendas de la run y **entre
  rondas de Endless** (que parte del mismo `gs`) sin código adicional.
  Una partida nueva (`newGame`) siempre inicializa la lista vacía.
- No se puede desterrar un modificador ya poseído (comprobado en
  `handleBanish`, App.tsx, antes de mutar `gs`).
- No hay forma de recuperar un modificador desterrado en esta
  iteración (explícitamente fuera de alcance).

## 9. Información de build en el HUD

Línea discreta bajo las estadísticas de `PlayScreen`, solo si hay
afinidad suficiente (≥2 piezas de un arquetipo, mismo umbral que el
sesgo de sinergia):

- 1 arquetipo con afinidad suficiente → `Build: Escaleras`
- 2 arquetipos → `Afinidad: Escaleras · Economía`
- 0 → no se muestra nada.

Máximo 2 etiquetas. GENERAL nunca se muestra (ya excluido por
`dominantArchetypes`). No se muestran números, pesos ni porcentajes
— `ARCHETYPE_LABELS` (`src/game/archetypes.ts`) traduce cada
arquetipo a un nombre legible en castellano.

## 10. Debug local

`src/game/debug.ts::logRelicOfferDebug(gs, info)`, gateado por
`import.meta.env.DEV` (Vite; `false` en cualquier build de
producción). Se llama desde `RewardScreen`/`ShopScreen` cada vez que
se genera una oferta (inicial o reroll) y vuelca a `console.debug`:
afinidades actuales, arquetipo dominante, modificadores desterrados,
rerolls usados, seed, ronda, y el listado de ids/rarezas ofrecidos.
Sin interfaz nueva, sin servicios externos — solo logging
condicionado, tal como pedía el encargo.

## 11. Decisiones de diseño

- El reroll de recompensa y el de tienda comparten las mismas
  funciones puras (`rerollCost`, `canReroll`, `src/game/rerolls.ts`)
  pero tablas de coste/máximo independientes en `config.ts`, para que
  ajustar una no afecte a la otra sin querer.
- El "reroll evita repetir la oferta anterior" (sección 3) solo se
  implementó para recompensa, tal como pide el encargo — la sección 4
  (tienda) no lo menciona explícitamente y no se amplió sin que se
  pidiera.
- El corrector de variedad (sección 6) vive en `offers.ts`, no dentro
  de `pickRelics` — mantiene `pickRelics` como la primitiva de
  muestreo puro de la 2A, sin acoplarla a la noción de "arquetipo".
- Se reutilizó el patrón de `RelicReplaceModal`/estado local por
  pantalla ya establecido en la 2B para el reroll y el banish: cada
  pantalla gestiona su propia oferta en estado local, y solo llama a
  `App` para las mutaciones de `gs` (dinero, `banishedRelicIds`,
  `relics`). Los rerolls no tocan `gs.relics` en ningún momento.

## 12. Riesgos pendientes

- El sesgo de sinergia (+30%) y el corrector de variedad no se han
  validado con un playtest humano: la iteración se limitó
  explícitamente a no tocar balance, así que estos números son un
  punto de partida razonado, no calibrado por simulación.
- El coste de reroll/banish no se ha probado contra la economía
  ajustada de la 2B en una run completa jugada de principio a fin con
  esta iteración activa — es posible que 3-4 rerolls de tienda
  consuman una fracción del presupuesto mayor de lo previsto.
- La regla "GENERAL no domina" es una decisión de diseño limpia, pero
  implica que builds centradas en El Coleccionista/Bola de
  Nieve/Pacto de Sangre (fuertes y válidas) nunca reciben sesgo de
  sinergia ni etiqueta de build en el HUD — es intencional, pero
  conviene confirmarlo con el próximo playtest.

## 13. Qué debe validar el siguiente playtest

- Si el sesgo de sinergia se nota como "la build tira hacia algo" sin
  sentirse determinista.
- Si los costes de reroll (3/5/7$) son lo bastante baratos para
  usarse alguna vez y lo bastante caros para no usarse siempre.
- Si desterrar 1-2 modificadores realmente evita las peores rachas de
  oferta sin sentirse una mecánica ignorada.
- Si la etiqueta de build en el HUD aparece con la frecuencia
  esperada (ni siempre, ni casi nunca) a lo largo de una run de 9
  rondas.
- Si `even_odd` (GENERAL) sentirse "huérfano" de sesgo es un problema
  real o no se nota en la práctica.
