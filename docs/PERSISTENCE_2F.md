# Persistencia de run — Iteración 2F

Esta iteración es exclusivamente de robustez: persistencia de la run activa,
recuperación tras cierre/refresco del navegador y hardening del estado
guardado. No toca diseño artístico, HUD, balance, objetivos, economía,
modificadores, bosses, Legados, Juramentos ni variantes.

## 1. Separación Profile / RunSave

Son dos sistemas de almacenamiento independientes, con claves de
`localStorage` distintas:

- **`PlayerProfile`** (`src/game/profile.ts`, clave `royale-climb:profile`):
  progresión que sobrevive **entre** runs — desbloqueos, Coronaciones,
  estadísticas acumuladas. Ya existía desde la 2E.
- **`RunSave`** (`src/game/runSave.ts`, clave `royale-climb:run`): el estado
  de **una** run activa, en curso. Se crea al empezar a jugar, se actualiza en
  cada transición estable y se borra cuando la run termina (derrota, vuelta al
  menú tras victoria, o sustitución explícita por una run nueva).

Ninguna operación de `RunSave` escribe en `PlayerProfile` y viceversa, salvo
los puntos explícitos donde una run terminada alimenta las estadísticas del
perfil (`recordRunEnd`, `recordCoronation` — ver sección 8).

## 2. Formato del RunSave

```ts
interface RunSave {
  version: number;          // RUN_SAVE_VERSION actual = 1
  savedAt: string;          // ISO 8601, informativo
  screen: Screen;           // solo pantallas "estables", ver sección 4
  gameState: GameState;     // snapshot completo y literal del estado de juego
  runProgress: RunProgressCounters;   // contadores propios de la run activa
  pendingReward: PendingRewardSave | null;
  pendingShop: PendingShopSave | null;
  pendingRelicReplace: PendingRelicReplaceSave | null;
  pendingLegacy: PendingLegacySave | null;
}
```

- `runProgress` (`{ discardsUsed, rerollsUsed, shopPurchases }`) acumula
  contadores de la run activa que alimentan `RunEndSummary` al terminar
  (sección 8); no son parte de `GameState` porque no afectan al motor de
  puntuación/reglas, solo a las estadísticas.
- `pendingReward` / `pendingShop` congelan la oferta de `RewardScreen` /
  `ShopScreen` que el jugador está viendo (ver sección 4 — por qué no se
  puede regenerar por fórmula).
- `pendingRelicReplace` congela el modal de "6/6 modificadores, elige cuál
  sustituir" si estaba abierto.
- `pendingLegacy` guarda el paso (`"summary" | "legacy" | "confirm"`) y el
  Legado ya reclamado (si lo hay) de la pantalla de Coronación.

Toda la estructura se valida campo a campo antes de aceptarse (sección 6);
nunca se hace `JSON.parse` y se confía ciegamente en la forma resultante.

## 3. Autosave

Un único `useEffect` en `App.tsx`, con dependencias
`[gs, screen, runProgress, pendingReward, pendingShop, pendingRelicReplace, pendingLegacy]`,
construye y guarda un `RunSave` cada vez que cualquiera de esos valores
cambia, siempre que `screen` sea una de las pantallas guardables
(`isSaveableScreen`, sección 4). Esto cubre automáticamente todas las
transiciones importantes pedidas por el encargo (empezar run, repartir ronda,
jugar mano, descartar, elegir modificador, reroll, banish, comprar, vender,
mejorar carta, completar recompensa, entrar/salir de tienda, entrar/terminar
boss, cambiar de Ante, entrar a Coronación, continuar Endless) porque todas
ellas, sin excepción, pasan por un cambio de `gs` y/o `screen` — no existe una
lista de "eventos que disparan guardado" mantenida a mano, lo que evita que
una transición futura se olvide de guardar.

No se guarda durante animaciones puramente visuales porque estas no tocan
`gs`/`screen`/los `pending*` — solo estado local de componente (ej. las
partículas de puntuación).

## 4. Estados estables (`SAVEABLE_SCREENS`)

```ts
const SAVEABLE_SCREENS = new Set(["play", "reward", "money-reward", "shop", "win"]);
```

`"menu"` y `"defeat"` nunca son guardables: en el menú no hay run activa que
guardar, y una derrota ya ha borrado el save (sección 8) antes de llegar a esa
pantalla.

`pendingReward` / `pendingShop` se snapshot-ean **literalmente** en vez de
regenerarse por fórmula al restaurar, porque sus generadores de RNG
(`rewardRng` / `shopRng` en `App.tsx`) son streams **acumulativos a lo largo
de toda la run** — cada reroll de cualquier ronda anterior avanza el mismo
stream — y esa secuencia de rerolls pasados no queda registrada en ningún
sitio recuperable. Reconstruir la oferta "desde cero" en el restore
produciría una oferta distinta a la que el jugador estaba viendo. En cambio,
la oferta de Legados de `WinScreen` (`offerLegacies`) se recalcula siempre a
partir de `profile.coronations.length`, que no cambia hasta reclamar — por
eso `pendingLegacy` solo guarda `step`/`claimedLegacyId`, no la oferta en sí.

## 5. Restauración ("Continuar")

En el menú principal, si existe un `RunSave` válido, se muestra "Continuar"
junto a "Nueva partida", con un resumen mínimo (ronda, Ante, dinero,
modificadores X/6, y fecha/hora aproximada de `savedAt`). El menú no se ha
rediseñado más allá de este resumen y los dos botones.

`handleContinueRun` es la única función que lee un `RunSave` para reanudar
una run, y su única responsabilidad es **hidratar** estado ya resuelto:

```
lastSeed, rewardRng.current, shopRng.current  ← reseedeados deterministamente
runProgress, pendingReward, pendingShop, pendingRelicReplace, pendingLegacy ← copiados tal cual
gs ← save.gameState
screen ← save.screen
```

Nunca llama a un handler de transición (`handleWinRound`, `recordCoronation`,
`claimLegacy`, etc.) — ese es precisamente el principio de idempotencia de la
sección siguiente.

## 6. Garantías de idempotencia

**Principio único:** *restaurar es hidratar estado ya resuelto, nunca volver
a ejecutar un handler de transición.* Todas las funciones que aplican un
efecto con consecuencias (cobrar, otorgar, registrar) solo se invocan desde
el evento real que las dispara — nunca desde `handleContinueRun`. Esto
resuelve por construcción, sin lógica adicional de deduplicación, los casos
pedidos por el encargo:

- **Reclamar recompensa**: el reward ya elegido, o la oferta pendiente si aún
  no se eligió, están en `gs`/`pendingReward`. Restaurar nunca vuelve a
  invocar el handler que añade el modificador; como mucho vuelve a mostrar la
  misma oferta pendiente para que el jugador decida.
- **Compra en tienda**: `gs.relics`/`gs.money` ya reflejan la compra hecha;
  `pendingShop` no vuelve a "reabrir" ofertas ya compradas (las compradas se
  filtran de la oferta guardada, igual que en ejecución normal).
- **Coronación**: `recordCoronation` (en `profile.ts`) es deliberadamente
  **no idempotente por sí sola** — llamarla dos veces crea dos registros (ver
  test explícito en `profile.test.ts`, sección "contrato de idempotencia").
  La garantía de que un refresco nunca duplica una Coronación no viene de que
  la función sea idempotente, sino de que `App.tsx` **solo** la llama desde
  `handleWinRound` (el evento real de ganar la ronda 9) y jamás desde
  `handleContinueRun`.
- **Reclamar Legado**: `claimLegacy` (`legacies.ts`) sí es idempotente por
  diseño propio — comprueba `claimedLegacyIds` antes de añadir — como defensa
  adicional en profundidad, aunque no sea la garantía principal.
- **Dinero de ronda / paso boss→tienda / paso ronda 9→victoria**: todos son
  transiciones disparadas por handlers de evento real (`playHand`,
  `handleWinRound`, `advanceToNextRound`) que mutan `gs` una sola vez; restaurar
  el `gs` resultante no vuelve a ejecutar la transición que lo produjo.

No ha hecho falta introducir identificadores de paso/transacción adicionales
más allá de los ya existentes (`WinStep`, `pendingReward.rerollCount`, etc.):
el propio diseño de "guardar el resultado, no el evento" es suficiente.

### Caso límite corregido: derrota durante la animación de fin de mano

`playHand()` detecta `handsLeft <= 0` y espera ~700ms (animación) antes de
llamar a `onDefeat`. Sin corrección, un refresco durante esa ventana
restauraría un estado "atascado" (0 manos, sin forma de continuar). Se
corrige con `onRunEnding()`, invocado en el instante en que se detecta la
derrota (antes del `setTimeout`), que borra el `RunSave` y activa
`suppressNextAutosaveRef` para que el `useEffect` de autosave no vuelva a
escribir, en el mismo ciclo de render, el save que se acaba de borrar.

## 7. Coronación pendiente y Endless

Si el jugador llega a la pantalla de Coronación y cierra el juego antes de
elegir Legado, el `RunSave` **no se borra** — se mantiene con
`screen: "win"` y `pendingLegacy.step` reflejando el paso exacto en el que
estaba. Al continuar:

- Si `step === "summary"`, ve el resumen de nuevo (la Coronación ya se
  registró en el perfil al ganar la ronda 9, una sola vez — sección 6).
- Si `step === "legacy"`, ve la oferta de Legados de nuevo (recalculada de
  forma determinista, no snapshot-eada — sección 4).
- Si `step === "confirm"`, ve la confirmación del Legado ya reclamado.

"Seguir escalando" (Endless) **convierte el mismo `RunSave`** — no crea uno
nuevo: `gs.endless` pasa a `true` y la ronda sigue creciendo desde donde
estaba, dentro del mismo autosave `useEffect`. No hay una clave de storage
separada para runs Endless. Los Legados ya reclamados, el `CoronationRecord`,
los banishes, modificadores y cartas de la run se conservan porque viven en
`gs`/`profile`, que no se resetean al pasar a Endless.

## 8. Fin de run

El `RunSave` se borra en exactamente tres momentos:

1. **Derrota definitiva** (`onDefeat`, sección 6 caso límite).
2. **Vuelta al menú tras completar una run** (`handleMenuFromWin`), ya sea
   tras la Coronación o tras seguir en Endless y decidir parar.
3. **Nueva partida confirmando la sustitución** de una run existente
   (`newGame()`, tras el diálogo de confirmación del menú — sección 5).

En los dos primeros casos, además de borrar el save, se llama a
`recordRunEnd(profile, summary)` con un resumen de la run
(`won`, `endless`, `reachedRound`, `totalScore`, `bestHand`, `handsPlayed`,
`discardsUsed`, `rerollsUsed`, `shopPurchases`, `banishesUsed`) para
alimentar las estadísticas del perfil (sección 9). `recordRunEnd` se llama
tanto en victoria como en derrota — a diferencia de `recordCoronation`, que
solo se llama en victoria — y ambas se llaman una sola vez por run real,
nunca desde la restauración.

## 9. Estadísticas locales

Sin telemetría externa: `PlayerProfile` gana campos acumulativos nuevos
(`runsLost`, `highestEndlessRound`, `totalHandsPlayed`, `totalDiscards`,
`totalRerolls`, `totalBanishes`, `totalShopPurchases`), actualizados por
`recordRunEnd` (máximos vía `Math.max`, sumas vía `+=`, puro — no muta el
perfil recibido).

`buildPlayerStats(profile): PlayerStats` es una función pura que deriva
valores calculados sin guardarlos en el perfil: `winRate` (`runsWon /
runsStarted`, `0` si no hay runs), `highestRound`/`bestSingleHand` (alias de
`bestRound`/`bestHand`, para no forzar un bump de versión del perfil), y
`favoriteBuild` (el `dominantBuild` más frecuente entre las Coronaciones
registradas, `null` si no hay ninguna). No se ha construido una pantalla
visual compleja — solo se muestra un resumen dentro de `DevProfilePanel`
(solo en `import.meta.env.DEV`).

## 10. Export / import de perfil

`exportProfileJson(profile): string` serializa el perfil completo con
indentación de 2 espacios; el menú ofrece un botón que lo descarga como
archivo `.json` vía `Blob` + enlace temporal.

`importProfileJson(raw: string): ImportProfileResult` es una cadena de
validación en varias etapas, sin ejecutar nunca el contenido recibido:

1. `JSON.parse` — si falla, error legible.
2. Forma básica de objeto — si no es un objeto, error.
3. Presencia de `version` — si falta, error explícito (a diferencia de la
   carga normal del perfil, que rellena valores por defecto silenciosamente,
   una importación con versión ausente se rechaza sin intentar adivinar).
4. Coincidencia exacta de versión — una versión incompatible se rechaza con
   un mensaje explícito en vez de intentar migrar a ciegas un archivo externo.
5. Delegación a `migrateProfile` para la recuperación de campos a nivel de
   estructura (incompletos, tipos incorrectos, etc.).

El menú pide confirmación antes de sobrescribir, mostrando un resumen
antes/después (runs, Coronaciones, desbloqueos). No se incluye información
sensible (no hay cuentas, no hay datos personales en el perfil). No hay
sincronización en la nube ni servidor: es exclusivamente un archivo local que
el propio jugador descarga y vuelve a subir. El `RunSave` activo queda fuera
de esta iteración (no se exporta/importa la run en curso, solo el perfil).

## 11. Deuda técnica corregida — El Eco del Trono

Antes de esta iteración, `THRONES_ECHO.afterHand` reconstruía el Mult base de
la primera mano de la ronda **dividiendo el Mult final por 0.7** (el
multiplicador que el propio boss aplica a esa primera mano), asumiendo que
0.7 era el único factor aplicado entre el Mult base y el Mult final. Es
frágil: cualquier otro modificador que también afecte al Mult de esa primera
mano rompería silenciosamente la reconstrucción.

Se introduce `BossScoreContext.preBossBreakdown: ScoreBreakdown` — el
resultado de `scorePlay` (el cálculo de puntuación **antes** de que cualquier
efecto de boss lo modifique) — calculado una vez en `scoreWithBoss` y
reutilizado por cualquier boss que lo necesite. `THRONES_ECHO.afterHand` lee
`ctx.preBossBreakdown.mult` directamente en vez de deshacer una
multiplicación. `advanceBossState` gana los parámetros `played`/`heldInHand`
para poder recomputar `scorePlay` (barato, puro) y poblar ese campo.

El resultado numérico es idéntico al de antes: un test de regresión
(`bosses.test.ts`) compara, para varias manos, el valor obtenido leyendo
`ctx.preBossBreakdown.mult` contra el valor que daba la fórmula antigua
(`breakdown.mult / 0.7`) y confirma que coinciden exactamente. No se ha hecho
un refactor completo del motor de scoring — solo se añadió el campo de
contexto mínimo necesario para eliminar esta fragilidad puntual.

## 12. Save corrupto

`loadRunSave()` nunca lanza. Devuelve uno de tres resultados:
`{status:"none"}` (no hay nada guardado), `{status:"valid", save}` (pasa
`migrateRunSave`, que a su vez exige versión exacta y delega en
`validateRunSave` para comprobación estructural completa: tipos de cada
campo, existencia de bosses/Juramentos/Legados referenciados por id, y que
`screen` sea una pantalla guardable), o `{status:"corrupt"}` (JSON inválido,
forma incorrecta, versión desconocida, o cualquier fallo de validación).

Ante `"corrupt"`, el menú muestra "La partida guardada no puede recuperarse."
con dos opciones: Eliminar partida guardada / Volver al menú. Ninguna ruta de
corrupción toca `PlayerProfile` — el perfil es un sistema de storage
completamente independiente (sección 1).

## 13. Versionado

```ts
export const RUN_SAVE_VERSION = 1;
```

`migrateRunSave(raw)` es el punto central único para futuras migraciones: hoy
exige `raw.version === RUN_SAVE_VERSION` exactamente (cualquier otra versión,
incluida su ausencia, se rechaza de forma segura como save corrupto) y
delega en `validateRunSave`. Cuando exista una versión 2 real, este es el
único lugar que necesitará una rama `if (raw.version === 1) { ...transformar a v2... }`
antes de validar — no se ha inventado ninguna migración ficticia en esta
iteración, solo se ha dejado el punto de extensión.

## 14. Riesgos pendientes

- El `RunSave` no se ha probado bajo condiciones de `localStorage` lleno o
  con cuota excedida (`setItem` fallando) — `saveRunSave` sigue el mismo
  patrón "nunca lanza" que `profile.ts`, pero no hay un test específico para
  ese caso límite de plataforma.
- La reseed determinista de `rewardRng`/`shopRng` al restaurar asume que el
  algoritmo de generación de esos streams no cambiará entre versiones del
  juego; un cambio futuro en su implementación podría requerir una migración
  explícita de `RunSave` aunque el formato de datos no cambie.
- No se ha implementado export/import del `RunSave` activo (fuera de
  alcance de esta iteración, explícitamente); un jugador que quiera migrar
  una run en curso entre navegadores no puede hacerlo todavía, solo el
  perfil.
- `favoriteBuild` en `buildPlayerStats` usa un criterio simple de frecuencia
  (mayor conteo, primer empate gana) — no se ha validado con datos reales de
  muchas Coronaciones.
