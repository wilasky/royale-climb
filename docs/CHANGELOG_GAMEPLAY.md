# Changelog de gameplay — Iteración 2A

Referencia: `docs/GAME_AUDIT.md` (problemas P0-1, P0-2, P0-3). Esta iteración corrige
exclusivamente esos tres problemas críticos de flujo, rareza y previsualización,
más el refactor mínimo necesario para hacerlo de forma testeable. No se ha tocado
el balance individual de los 24 modificadores, ni la economía, ni el diseño visual.

## 1. Flujo de una run

### Flujo anterior (roto — ver P0-1)

```
Ronda 3/6/9 → Recompensa → Tienda → "Continuar" → SIEMPRE Pantalla de Victoria
                                                     ├─ "Seguir escalando" → fuerza endless=true
                                                     └─ "Menú principal" → abandona la run
```
La condición `round % 3 === 0` se comprobaba dos veces seguidas (al entrar a la
tienda y al salir de ella), así que salir de la tienda llevaba *siempre* a la
pantalla de victoria — no existía forma de jugar una partida "normal" que no
acabara volviéndose Endless en la ronda 3.

### Flujo nuevo

**Nueva partida** (`endless: false`):
```
Ronda 1 → Recompensa → Ronda 2 → Recompensa
Ronda 3 → Recompensa → Tienda → Ronda 4 (directo, sin pantalla de victoria)
Ronda 4 → Recompensa → Ronda 5 → Recompensa
Ronda 6 → Recompensa → Tienda → Ronda 7 (directo)
Ronda 7 → Recompensa → Ronda 8 → Recompensa
Ronda 9 → Recompensa → PANTALLA DE VICTORIA
                          ├─ "Seguir escalando" → activa Endless, comienza en ronda 10
                          └─ "Menú principal"
```

**Modo Endless** (`endless: true`, desde el menú o tras la victoria):
```
Ronda 1 → Recompensa → Ronda 2 → Recompensa
Ronda 3 → Recompensa → Tienda → Ronda 4 (directo)
... se repite cada 3 rondas indefinidamente, sin pantalla de victoria nunca ...
```

La decisión de qué pasa tras cada ronda ahora vive en una única función pura,
`resolveAfterReward(round, endless)` (`src/game/progression.ts`), con tres
resultados posibles: `"victory"` (solo Nueva partida, exactamente en la ronda 9),
`"shop"` (múltiplos de 3), `"next-round"` (el resto). La rama muerta que existía
en `handleContinueFromShop` ha desaparecido: salir de la tienda ahora *siempre*
continúa a la siguiente ronda, sin volver a comprobar nada.

### Duración de una run normal

Con este cambio, una partida "Nueva partida" tiene ahora un final propio y
predecible: **9 rondas exactas**, con 2 paradas de tienda (rondas 3 y 6) antes de
la pantalla de victoria. Antes de este cambio no había respuesta posible a "¿cuánto
dura una partida normal?", porque el modo normal no completaba nunca su propio ciclo.

## 2. Configuración de progresión centralizada

Nuevo módulo `src/game/config.ts` con todas las constantes de flujo/curva/rareza.
Nada de esto estaba disperso en muchos sitios distintos antes, pero sí mezclado
directamente en los componentes de React; ahora vive en un solo lugar sin JSX.

## 3. Curva de objetivo de puntuación

Se mantiene la fórmula original exacta (`200 * 1.55^(ronda-1)`) — `GAME_AUDIT.md`
no propuso una curva alternativa concreta, así que la opción que menos modifica
el balance actual es no tocar la fórmula, solo centralizarla en
`src/game/progression.ts::targetForRound`.

### Objetivos exactos, rondas 1-9

| Ronda | Objetivo |
|---|---|
| 1 | 200 |
| 2 | 310 |
| 3 | 481 |
| 4 | 745 |
| 5 | 1 154 |
| 6 | 1 789 |
| 7 | 2 773 |
| 8 | 4 299 |
| 9 | 6 663 |

(Nota: los valores de `docs/GAME_AUDIT.md` para las rondas 5-9 tenían un pequeño
error de redondeo manual — 1155/1790/2775/4302/6669 en vez de los valores
correctos de arriba, calculados con la fórmula real. La fórmula en sí no cambia,
solo se corrige la documentación.)

**Endless más allá de la ronda 9:** no hace falta una fórmula nueva — la misma
fórmula exponencial se sigue aplicando tal cual para ronda 10, 11, 12... (p.ej.
ronda 10 → 10 328, ronda 12 → 24 813). "Continuar en Endless" simplemente empieza
a llamar a `targetForRound` con rondas mayores que 9, que ya estaba definida para
cualquier número.

## 4. Rarezas ponderadas

Nueva función pura y reutilizable `pickRelics(rng, pool, ownedIds, count, weights)`
(`src/game/rewards.ts`), usada tanto por `RewardScreen` como por `ShopScreen` para
elegir **modificadores** (no las mejoras de carta de tienda — ver "Decisiones
aplazadas"). Reglas garantizadas:

- Nunca duplicados en una misma oferta (muestreo sin reemplazo).
- Nunca se ofrece un modificador ya poseído (se filtra antes de muestrear).
- Un peso de `0` para una rareza la **excluye por completo**, no solo la hace
  improbable — así la fase 1 nunca puede entregar un legendario, es garantía
  estructural, no solo una probabilidad baja.
- Determinista: mismo `rng` (misma semilla + mismo orden de llamadas) → mismo
  resultado.

### Tabla de pesos — Recompensa (`REWARD_WEIGHTS`)

| Fase (ante) | Común | Rara | Épica | Legendaria |
|---|---|---|---|---|
| 1 (rondas 1-3) | 70 | 25 | 5 | 0 |
| 2 (rondas 4-6) | 45 | 35 | 16 | 4 |
| 3 (rondas 7-9 y todo Endless posterior) | 30 | 32 | 25 | 13 |

### Tabla de pesos — Tienda (`SHOP_WEIGHTS`)

| Fase (ante) | Común | Rara | Épica | Legendaria |
|---|---|---|---|---|
| 1 | 55 | 35 | 10 | 0 |
| 2 | 35 | 35 | 22 | 8 |
| 3 | 22 | 30 | 28 | 20 |

La tienda es algo más generosa con rarezas altas que la recompensa gratuita,
ya que cuesta dinero. Ambas tablas son un punto de partida razonable, no un
resultado de simulación exhaustiva — quedan abiertas a ajuste en la iteración
de balance (ver roadmap en `GAME_AUDIT.md`).

## 5. Previsualización de puntuación real

`PlayScreen` ya no llama a `evaluateHand` (que ignoraba todos los modificadores)
para la vista previa. Ahora llama a **la misma función `scorePlay`** que se usa
al pulsar "Jugar mano", con los mismos argumentos (`played`, `held`, `gs`,
`isFirstHand`, `isLastHand`). El panel de vista previa ahora muestra:

- Nombre de la combinación.
- Fichas finales, multiplicador final y puntuación total prevista
  (`fichas × mult = total`).
- El desglose completo de líneas activas (mismas líneas que ya generaba
  `scorePlay`: figuras, ases, primera/última mano, Mano Firme, Bola de Nieve,
  Núcleo de Acero mantenido en mano, etc.)
- **Nuevo:** una línea agregada para mejoras de carta (`bonusChips`) y otra para
  cristal, que antes se calculaban silenciosamente dentro del bucle de fichas
  sin aparecer como línea propia en el desglose.
- Riesgo de rotura de cristal **por separado**, sin tirar dados (`glassRisk`,
  puramente informativo — la tirada real solo ocurre al ejecutar la jugada).
- Dinero previsto por Veta Dorada, mostrado como "+X$ al jugar", fuera de la
  puntuación (no se suma a fichas/mult/total).

`scorePlay` sigue siendo una función pura sin efectos secundarios — no se ha
duplicado la lógica de puntuación en ningún sitio; `playHand` (ejecución real) y
la vista previa llaman literalmente a la misma función.

## 6. Refactor aplicado

Nuevos módulos en `src/game/` (sin JSX, sin estado de React):

- `types.ts` — tipos de dominio (`Card`, `Relic`, `GameState`, etc.), movidos
  desde `App.tsx`.
- `rng.ts` — `makeRng`/`shuffle`, sin cambios de comportamiento.
- `config.ts` — constantes de progresión y tablas de pesos de rareza.
- `progression.ts` — flujo de rondas/antes/tienda/victoria, curva de objetivo.
- `rewards.ts` — `pickRelics`.
- `scoring.ts` — `evaluateHand`, `scorePlay`, `glassRisk`, `diamondMoneyPreview`.

`App.tsx` importa todo esto; no se ha tocado ningún nombre de componente React
ni la estructura visual existente, salvo los cambios mínimos en el panel de vista
previa de `PlayScreen` (más líneas de información, mismo estilo/clases ya
existentes) y el texto de `WinScreen` (que ahora solo aparece para la victoria
real de Nueva partida, así que su copy ya no necesitaba la rama "Endless").

## 7. Pruebas añadidas

Vitest configurado en `vitest.config.ts` (separado de `vite.config.ts` a
propósito, para no tocar la config de build de la app solo por añadir tests).
`npm test` → `vitest run`. 40 tests en 3 archivos, todos en `src/game/`:

- **`progression.test.ts`** (flujo): Nueva partida no termina en ronda 3 ni 6,
  termina en ronda 9; continuar tras victoria activa Endless en ronda 10;
  Endless no termina nunca en 3/6/9 (ni más allá); tiendas en las rondas
  correctas; ante y fase de rareza; valores exactos de la curva de objetivo
  para las rondas 1-9.
- **`rewards.test.ts`** (rarezas): sin duplicados, sin poseídos ya elegidos,
  fase 1 nunca entrega legendario (500 tiradas), fase 3 sí con frecuencia
  notable, determinismo con la misma semilla, distribución compatible con
  pesos iguales en muestra grande (tolerancia ±30%, sin exigir porcentajes
  exactos).
- **`scoring.test.ts`** (puntuación): misma llamada → mismo resultado;
  `scorePlay` no muta `played`/`heldInHand`/`gs`; acero mantenido en mano se
  incluye (una y dos cartas); cristal se incluye en la puntuación y
  `glassRisk` no depende de ningún generador aleatorio; primera y última mano
  se activan solo cuando corresponde; Mano Firme depende de
  `discardsUsedThisRound`; Bola de Nieve (`permaMult`) se suma; los
  modificadores activos y las mejoras de carta aparecen como líneas en el
  desglose; el dinero de Veta Dorada no altera la puntuación.

## 8. Decisiones aplazadas para iteraciones posteriores

- **Mensaje de hito en Endless al cruzar cada ante** (mencionado como opcional
  en el encargo, "puede mostrar... pero no debe obligar"): no implementado en
  esta iteración para no tocar más superficie visual de la necesaria. El juego
  simplemente continúa sin interrupción cada 3 rondas en Endless.
- **Mejoras de carta de tienda (`SPECIAL_DEFS`: cristal, acero, oro, tinta,
  tintura) no usan `pickRelics`** — el encargo especificaba "seleccionar
  *modificadores* mediante pesos"; las mejoras de carta son un catálogo
  distinto (solo 5 elementos, de los que la tienda ya muestra 3 = 60% cada
  vez) y no estaban en la evidencia de P0-2 del audit. Se han dejado con su
  selección uniforme original a propósito, para no ampliar el alcance sin que
  se haya pedido explícitamente.
- Todo lo que la iteración 2A excluye explícitamente por encargo: jefes,
  nuevos modificadores, reroll/banish, simulador masivo, telemetría, guardado
  local, metaprogresión, rediseño visual, refactor arquitectónico completo,
  cambios grandes de economía, rebalanceo individual de los 24 modificadores.
  Todo esto sigue en el roadmap de `GAME_AUDIT.md`, sin tocar.
- El warning de build preexistente sobre el orden del `@import` de Google
  Fonts en `src/index.css` (P2-1 del audit) sigue sin corregir — es un asunto
  visual/de build, fuera del alcance de esta iteración de gameplay.

# Changelog de gameplay — Iteración 2B

Referencia: `docs/BALANCE_ITERATION_2B.md` (plan completo, playtest real de la
2A y resultados finales). Esta iteración ataca el balance de progresión,
economía y acumulación de modificadores que la 2A dejó explícitamente fuera
de alcance — no toca jefes, encuentros especiales, nuevos modificadores,
reroll/banish, metaprogresión, telemetría, guardado ni rediseño visual.

## 1. Límite de 6 modificadores activos y reemplazo explícito

Nueva constante `MAX_ACTIVE_RELICS = 6` (`src/game/config.ts`) y nuevo módulo
`src/game/relics.ts` con dos funciones puras:

- `hasRelicCapacity(relics, max)`: si hay hueco libre.
- `replaceRelic(relics, removeId, added)`: sustituye un modificador por otro
  preservando el orden, sin mutar la lista recibida.

Con el cupo lleno, obtener un modificador nuevo (recompensa gratuita o
compra en tienda) abre `RelicReplaceModal` en vez de añadirlo directo: el
jugador ve el modificador entrante, elige explícitamente cuál de los 6
actuales sustituir, confirma o cancela. Cancelar no cobra dinero ni pierde
ningún modificador, en ningún contexto. El contador "X/6" es visible siempre
en el HUD de partida (aside de escritorio y chips en móvil) y en las
pantallas de recompensa y tienda.

De paso se corrigió un bug latente en `ShopScreen`: el estado local
`boughtRelics` marcaba un modificador como "comprado" en el clic, no en la
confirmación real — con el modal de reemplazo, esto habría marcado el
check ✓ aunque el jugador cancelara sin comprar nada. Ahora el estado de
compra se deriva directamente de `gs.relics`.

## 2. Cadencia de recompensas: modificador / dinero / tienda

Nueva función pura `resolveRoundReward(round, endless)`
(`src/game/progression.ts`), que sustituye a `resolveAfterReward`/
`RoundOutcome` de la 2A. Antes, las 9 rondas de una run ofrecían un
modificador gratuito; ahora cada ronda ofrece exactamente un tipo de
recompensa:

```
Ronda 1 → Modificador   Ronda 4 → Modificador   Ronda 7 → Modificador
Ronda 2 → Dinero        Ronda 5 → Dinero        Ronda 8 → Dinero
Ronda 3 → Tienda        Ronda 6 → Tienda        Ronda 9 → VICTORIA (pisa la tienda natural)
```

Endless (ronda 10+) extiende el mismo ciclo de 3 rondas indefinidamente
(`round % ROUNDS_PER_ANTE`), sin caso especial ni salto de comportamiento.

Nueva pantalla `MoneyRewardScreen` y nuevo valor `"money-reward"` en el
union `Screen` (`src/game/types.ts`). `handleWinRound` en `App.tsx` decide
de entrada, al ganar la ronda, qué pantalla mostrar; un nuevo
`advanceToNextRound(g)` sustituye a `proceedAfterReward` para avanzar
siempre a la ronda siguiente una vez resuelta la recompensa, la tienda o el
reemplazo de modificador.

## 3. Recompensa económica

Cantidad determinista por fase (mismo concepto que las tablas de rareza),
`MONEY_REWARD_BY_PHASE`: fase 1 → 6$, fase 2 → 9$, fase 3 → 12$. En Nueva
partida corresponde a las rondas 2/5/8; en Endless se indexa por
`phaseForRound`, así que hereda 12$ indefinidamente (fase 3 tiene tope).

## 4. Economía y precios

| Elemento | Antes | Ahora |
|---|---|---|
| Cobro base por ronda superada | `3 + handsLeft` (3-7$) | `2 + min(handsLeft, 2)` (2-4$) |
| Interés (Banca Privada) | +1$/5$, tope +6$/ronda | +1$/6$, tope +4$/ronda |
| Precio modificador común | 5$ | 5$ (sin cambio) |
| Precio modificador raro | 7$ | 8$ |
| Precio modificador épico | 10$ | 12$ |
| Precio modificador legendario | 14$ | 18$ |
| Cristal Frágil (mejora) | 5$ | 6$ |
| Núcleo de Acero (mejora) | 6$ | 7$ |
| Compensación por rechazar modificador | 4$ fijo | 3$ fijo (`DECLINE_RELIC_COMPENSATION`) |

Nuevo módulo `src/game/economy.ts` con `roundClearBaseReward`,
`computeInterest`, `relicPrice` — funciones puras, constantes en
`config.ts`. Ver `docs/BALANCE_ITERATION_2B.md` sección 4 para la
justificación completa y el dinero esperado por fase.

## 5. Curva de dificultad por tabla explícita

`targetForRound` deja de usar la fórmula exponencial genérica de la 2A
(`200 * 1.55^(ronda-1)`) y pasa a una tabla explícita para las rondas 1-9,
calibrada contra el poder real de una build con hasta 6 modificadores:

| Ronda | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Objetivo | 180 | 280 | 450 | 700 | 1 050 | 1 900 | 3 200 | 5 200 | 8 500 |

Endless (ronda 10+) continúa desde el objetivo de la ronda 9 con
`ENDLESS_TARGET_GROWTH = 1.6`: `target(r) = target(9) * 1.6^(r-9)`.

## 6. Balance conservador de 3 modificadores

- **Equilibrio Par (`even_odd`)**: ×4 → ×3 Mult, y el As deja de contar
  como par (antes `14 % 2 === 0` lo colaba, un artefacto de JS no
  documentado — `GAME_AUDIT.md` P2-5).
- **El Coleccionista (`the_collector`)**: +3 → +2 Mult por modificador
  poseído. Candidato más claro a "beneficia cualquier mano" y "siempre es
  la elección correcta" — con el nuevo tope de 6 modificadores su techo baja
  de +27 (9×3, sin límite) a +12 (6×2).
- **Banca Privada (`interest`)**: ver economía (sección 4 arriba).

Los otros 21 modificadores se mantienen sin cambios — ver la clasificación
completa en las 8 categorías pedidas (bonus de fichas, bonus aditivo de
Mult, multiplicador final, economía, condicionales, utilidad-consistencia,
mejoras universales, mejoras de arquetipo) en
`docs/BALANCE_ITERATION_2B.md` sección 6.

## 7. Pruebas añadidas

63 tests en 5 archivos (antes 40 en 3): nuevo `relics.test.ts` (capacidad,
reemplazo puro sin mutar), nuevo `economy.test.ts` (cobro base, interés con
tope, precios por rareza), `progression.test.ts` ampliado/reescrito para
`resolveRoundReward`, `scoring.test.ts` ampliado con casos de `even_odd`
(con y sin As) y `the_collector` (múltiplos exactos de +2). Los 40 tests de
la Iteración 2A y `rewards.test.ts` siguen pasando sin cambios.

## 8. Riesgos pendientes

Ver `docs/BALANCE_ITERATION_2B.md` sección 12 — la curva de objetivo y el
dinero esperado por fase son estimaciones razonadas, no el resultado de una
simulación exhaustiva; quedan como hipótesis a validar en el próximo
playtest real.

# Changelog de gameplay — Iteración 2C

Referencia: `docs/BUILD_AGENCY_ITERATION_2C.md` (plan y detalle completos).
Esta iteración da al jugador herramientas para perseguir una identidad de
build sin volver a tocar el balance base de la 2B (curva de dificultad,
objetivos de ronda, precios, recompensas económicas, límite de 6
modificadores y valores numéricos de modificadores quedan exactamente
igual, salvo el caso de bug demostrado — no hubo ninguno).

## 1. Arquetipos de build

Nuevo `src/game/archetypes.ts`: clasifica los 24 modificadores existentes
en 12 arquetipos (`PAIR`, `STRAIGHT`, `FLUSH`, `LOW_CARDS`, `HIGH_CARDS`,
`SMALL_HAND`, `FIRST_HAND`, `LAST_HAND`, `NO_DISCARD`, `ECONOMY`,
`CARD_ENHANCEMENT`, `GENERAL`) con rol funcional
(starter/enabler/payoff/utility/generalist). Puramente declarativo, sin
cambios de comportamiento. Nuevo `src/game/buildIdentity.ts`:
`computeBuildIdentity(relics)` calcula afinidad por arquetipo (número de
piezas + intensidad none/weak/moderate/strong) y el arquetipo dominante,
excluyendo GENERAL explícitamente de poder dominar una build.

## 2. Reroll de recompensa y de tienda

`RewardScreen` ("Volver a tirar", 3$/5$/7$, máximo 3 por recompensa) y
`ShopScreen` ("Volver a tirar tienda", 3$/5$/7$/7$, máximo 4 por tienda),
costes centralizados en `config.ts`
(`REWARD_REROLL_COSTS`/`MAX`, `SHOP_REROLL_COSTS`/`MAX`) y funciones puras
compartidas en `src/game/rerolls.ts`. El coste se paga al confirmar, nunca
antes; la oferta solo se recalcula (y por tanto solo consume RNG) dentro
del propio clic. `pickRelicsAvoidingRepeat` evita repetir exactamente la
oferta anterior en un reroll de recompensa cuando el pool tiene margen
para una alternativa real. El reroll de tienda regenera solo lo que sigue
disponible para comprar — los modificadores comprados y las mejoras de
carta ya aplicadas (ahora identificadas por `kind` estable, no por índice
de array) no reaparecen. Ninguna opción existente se eliminó: elegir,
saltar (+3$), reemplazar con 6/6, comprar, vender cartas.

## 3. Sesgo de sinergia (synergy bias)

Nuevo `src/game/offers.ts::pickRelicOffer`, que sustituye a las llamadas
directas a `pickRelics` en ambas pantallas. Si el jugador ya tiene 2+
piezas del mismo arquetipo (`SYNERGY_MIN_AFFINITY`), los candidatos
relacionados reciben un +30% de peso (`SYNERGY_BONUS`) sobre su peso de
rareza existente — nunca lo sustituyen, así un legendario en fase 1 (peso
0) sigue excluido pase lo que pase. `pickRelics` ganó un
`weightMultiplier` opcional, retrocompatible. Tras el sorteo, un
corrector de mejor esfuerzo (no garantía) intenta que la oferta contenga
al menos un candidato relacionado con la build y al menos una opción para
pivotar, solo si el pool restante lo permite.

## 4. Destierro limitado (banish)

Botón "Desterrar" en cada modificador ofrecido (no en los ya poseídos).
Primer destierro gratis, segundo 5$ (`BANISH_MAX=2`, `BANISH_COSTS`,
`src/game/banish.ts`, puro). Nuevo campo `GameState.banishedRelicIds`,
inicializado vacío en cada partida nueva y persistido tal cual entre
rondas/tiendas/Endless de la misma run (es parte del propio estado, sin
lógica adicional). Un modificador desterrado se excluye de inmediato de
la oferta visible y de toda generación futura de esa run.

## 5. Información de build en el HUD y debug local

Línea discreta en `PlayScreen` ("Build: Escaleras" o "Afinidad: Escaleras
· Economía", máximo 2 etiquetas), visible solo con afinidad suficiente,
nunca para GENERAL, sin números ni pesos internos. Nuevo
`src/game/debug.ts::logRelicOfferDebug`, gateado por
`import.meta.env.DEV` (nunca en producción): vuelca a consola afinidades,
dominante, desterrados, rerolls usados y seed en cada generación de
oferta.

## 6. Pruebas añadidas

108 tests en 10 archivos (antes 63 en 5): nuevos `archetypes.test.ts`,
`buildIdentity.test.ts`, `rerolls.test.ts`, `offers.test.ts` y
`banish.test.ts`. Cubren clasificación de los 24 modificadores,
multi-arquetipo, exclusión de GENERAL como dominante, costes de reroll
3/5/7 (y 7 repetido en tienda a partir del tercero), límites de intentos,
bloqueo sin dinero suficiente, sesgo de sinergia medido estadísticamente
con tolerancias amplias (sin muestras minúsculas), restricción de fase
mantenida bajo sesgo, determinismo de `pickRelicOffer`, y las reglas de
banish (máximo 2, primero gratis, sin mutar arrays, exclusión futura). Los
63 tests de las iteraciones 2A/2B siguen pasando sin cambios de
comportamiento (solo se amplió el fixture `baseGs` de `scoring.test.ts`
con el nuevo campo `banishedRelicIds`).

## 7. Riesgos pendientes

Ver `docs/BUILD_AGENCY_ITERATION_2C.md` secciones 12-13 — el sesgo de
sinergia y los costes de reroll/banish no se han validado contra una run
completa jugada de principio a fin ni contra un playtest humano; quedan
como hipótesis documentadas para el próximo playtest.
