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
