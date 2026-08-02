# Metaprogresión — Iteración 2E: Victoria, desbloqueos y progresión externa ligera

> Implementado sobre `design-overhaul`, a partir del commit `173e23d`
> (Iteración 2D). Esta iteración **no toca balance**: objetivos de
> ronda, economía, precios, recompensas económicas, rarezas, costes de
> reroll/banish, synergy bias, valores de modificadores, límite de 6
> modificadores y reglas de bosses existentes quedan exactamente igual
> que en la 2B/2C/2D. El rediseño artístico (`docs/CARD_ART_DIRECTION.md`)
> sigue pausado hasta el final del desarrollo jugable — esta iteración
> usa únicamente la UI actual con componentes provisionales mínimos.

## 1. Filosofía

Derrotar al boss final ya terminaba la run correctamente y permitía
Endless (Iteración 2D). Lo que faltaba: que ganar **importe** para las
runs futuras, sin caer en dos patrones que no encajan con la identidad
de Royale Climb:

- **Moneda permanente que grindear.** No hay tienda entre runs, no hay
  una divisa que acumular partida tras partida. El progreso entre runs
  se mide en **desbloqueos concretos**, no en un número que sube.
- **Copiar el sistema de Stakes de Balatro.** Nada de escalar un
  objetivo un +X% fijo por nivel. La dificultad adicional (Juramentos)
  cambia **decisiones**, no aritmética.

La mecánica propia que se explora aquí son los **Legados de la
Corona**: cada Coronación ofrece una elección entre hasta 3 Legados,
el jugador se queda uno, los otros dos no desaparecen — pueden
reaparecer en una Coronación futura. Dos jugadores que juegan la misma
versión del juego pueden terminar con pools ligeramente distintos
según qué eligieron primero.

## 2. Concepto de Coronación

Derrotar al boss final de la ronda 9 en una run **no-Endless** es una
**Coronation** (terminología interna en inglés, texto de cara al
jugador en español: "Has conquistado esta Ascensión."). Vive en
`src/game/coronation.ts`, separado a propósito de `profile.ts`: uno
entiende "qué es una victoria", el otro entiende "cómo se guarda un
perfil".

`CoronationRecord` (`buildCoronationRecord(gs)`, pura) registra: seed,
puntuación total, build dominante (reutiliza
`dominantArchetypes`/`ARCHETYPE_LABELS` de la 2C, sin duplicar esa
lógica), ids de los modificadores activos, boss final derrotado,
Juramento activo, fecha (ISO) y si la run continuó en Endless
(`continuedEndless`, `false` al registrarse, actualizado aparte por
`markLastCoronationEndless` cuando el jugador pulsa "Seguir
escalando" — nunca se pierde la recompensa por elegir Endless, y
Endless nunca crea una segunda Coronación).

No se muestran todos estos campos al jugador todavía (solo un
subconjunto en la pantalla de Coronación) — quedan registrados desde
ya para no migrar el perfil cuando haga falta el resto.

## 3. Perfil de progresión persistente

`src/game/profile.ts`. `PlayerProfile` versionado
(`PROFILE_VERSION = 1`) en `localStorage`, independiente de
`GameState`: runs iniciadas, runs ganadas, bosses finales derrotados
por id, mejor ronda/puntuación total/jugada, dificultad máxima
desbloqueada, Legados reclamados y el historial de Coronaciones.

Decisiones de diseño:

- **Storage inyectable.** `ProfileStorage` (`getItem`/`setItem`) en
  vez de `localStorage` global directo — `vitest.config.ts` usa
  entorno `node` (sin DOM), así que los tests pasan un storage en
  memoria en vez de necesitar jsdom solo para esto. En el navegador,
  `loadProfile()`/`saveProfile()` sin argumentos usan `localStorage`
  real automáticamente.
- **Nunca lanza.** JSON corrupto, forma inesperada, storage ausente o
  con cuota excedida: siempre se recupera devolviendo (o rellenando
  con) `defaultProfile()`. La migración es campo a campo — un perfil
  con un solo campo corrupto recupera ese campo, no se descarta
  entero.
- **Funciones puras + guardado explícito.** `recordRunStart`,
  `recordCoronation`, `markLastCoronationEndless` devuelven un perfil
  nuevo sin mutar el de entrada ni tocar `localStorage` — `saveProfile`
  se llama aparte, desde `App.tsx`, después de cada cambio.
- **No se guarda todavía una run a medias.** Fuera de alcance
  explícito (sección 1 del encargo) — es un sistema distinto.

## 4. Los 9 Legados diseñados

`src/game/legacies.ts`. `LegacyDefinition { id, name, description,
category, unlock, prerequisites, implemented }`, puramente
data-driven — ningún `if` de desbloqueo dsiperso por `App.tsx`; añadir
un Legado nuevo es añadir una entrada a `LEGACY_POOL`.

### A) Contenido

1. **Eco Prohibido** ✅ implementado — desbloquea el boss `thrones_echo`
   (El Eco del Trono) para el Ante 2.
2. **Reliquia Perdida** (documentado, sin implementar) — añadiría un
   nuevo modificador al pool de recompensas/tienda. Prerrequisito: Eco
   Prohibido (ejemplo de cadena de prerrequisitos).
3. **Baraja Coronada** (documentado, sin implementar) — desbloquearía
   una futura variante visual de cartas. Conecta directamente con
   `docs/CARD_ART_DIRECTION.md`, pausado hasta el final del desarrollo
   jugable — este Legado es el gancho para retomarlo más adelante sin
   inventar un sistema nuevo entonces.

### B) Nuevas formas de jugar

4. **Bolsillos Vacíos** ✅ implementado — desbloquea la variante de
   inicio `empty_pockets`.
5. **Mazo Depurado** (documentado, sin implementar) — variante que
   retira los cuatro 2 del mazo inicial antes de la primera ronda.
6. **Primera Fortuna** (documentado, sin implementar) — variante que
   garantiza un reroll extra gratuito en la primera recompensa de la
   run. Prerrequisito: Bolsillos Vacíos.

### C) Nuevos desafíos

7. **El Velo del Trono** ✅ implementado — desbloquea el Juramento I.
8. **Segundo Juramento** (documentado, sin implementar) — desbloquearía
   el Juramento II ("Manos Prestadas", sección 6). Prerrequisito: El
   Velo del Trono.
9. **Ruta sin Retorno** (documentado, sin implementar) — desbloquearía
   un nuevo nivel de dificultad adicional. Prerrequisito: Segundo
   Juramento.

Los 6 no implementados tienen `unlock: { type: "future", note }` y
`implemented: false` — están presentes en `LEGACY_POOL` (su forma de
datos ya existe) pero `offerLegacies` nunca los ofrece.

## 5. Selección y elección de Legados

`offerLegacies(profile, seed, pool = LEGACY_POOL)`: hasta 3
candidatos que cumplan `implemented && no reclamado && todos sus
prerequisites reclamados`, mezclados con la misma `shuffle()`
determinista que ya usa el reparto de cartas. RNG propio:
`seed + coronations.length * 97 + 424243`, aislado de los demás
streams del juego (reward `seed+555`, shop `seed+999`, shuffle de
ronda `seed+round*104729`, selección de boss `seed+ante*97711`).

Con solo 3 Legados implementados y sin prerrequisitos entre ellos, la
primera Coronación siempre ofrece los 3; tras reclamar uno, la
siguiente ofrece los que queden; al reclamar los 3, `offerLegacies`
devuelve `[]` y la pantalla muestra "Todos los Legados disponibles han
sido reclamados" (sección 10) — la Coronación se sigue registrando
igual, con o sin recompensa pendiente.

`claimLegacy(profile, id)` es idempotente (reclamar dos veces el mismo
id no lo duplica) y pura. `getUnlockedBossIds`/`getUnlockedVariantIds`/
`getUnlockedOathIds` derivan los desbloqueos activos directamente de
`claimedLegacyIds` — nada se guarda por duplicado.

## 6. Los 6 Juramentos diseñados

`src/game/oaths.ts`. En vez de "+20% / +40% / +60% objetivo" al estilo
Stakes, cada Juramento cambia una condición de decisión o de
información — ninguno toca objetivos de ronda, economía, rarezas,
costes de reroll/banish ni valores de modificadores existentes.

1. **JURAMENTO I — El Velo del Trono** ✅ implementado — oculta el
   panel de telegraph "Próximo boss del ante" (docs/BOSS_DESIGN_2D.md,
   sección 7): no sabes qué boss te espera hasta llegar a su ronda. No
   es hard counter — el boss sigue siendo superable adaptando
   decisiones EN la ronda, exactamente igual que sin Juramento; solo
   cambia la planificación previa.
2. **Manos Prestadas** (diseño, sin implementar) — recargo fijo sobre
   el coste de cada reroll de recompensa (limitación suave sobre
   reroll, sin tocar la tabla `REWARD_REROLL_COSTS` en sí).
3. **Cofre Sellado** (diseño, sin implementar) — la primera tienda de
   la run no ofrece Cristal/Acero/Oro, solo modificadores (retrasa el
   acceso a mejoras de carta).
4. **Ecos de Deuda** (diseño, sin implementar) — empiezas con 0$, pero
   el primer cobro de ronda se dobla (recompensa con compromiso:
   colchón inicial más bajo a cambio de recuperación más rápida si la
   ronda 1 sale limpia).
5. **Boss Anónimo** (diseño, sin implementar) — el boss activo no
   muestra su nombre real durante la ronda, solo la regla (bosses con
   información diferente, variante más fuerte que el Juramento I).
6. **Manos Contadas** (diseño, sin implementar) — el interés de Banca
   Privada no se cobra en la primera tienda de cada ante (restricción
   que cambia la gestión de recursos sin tocar `INTEREST_DIVISOR`/
   `INTEREST_CAP`).

Solo el Juramento I está implementado. Se desbloquea al reclamar el
Legado "El Velo del Trono" (primera Coronación en adelante) y es
seleccionable desde el menú mediante un checkbox provisional, visible
solo cuando está desbloqueado.

## 7. Las 3 variantes de inicio diseñadas

`src/game/variants.ts`. Cambian composición/recurso inicial
reutilizando sistemas ya existentes — nunca fórmulas ni constantes de
`config.ts`.

A. **Bolsillos Vacíos** ✅ implementada — 2$ iniciales en vez de 4$,
   pero un descarte extra por ronda (4 en vez de 3). `apply()` es una
   transformación pura del `GameState` base antes de la primera
   `startRound` — reutiliza el propio flujo `discardsPerRound →
   discardsLeft` que ya recalcula cada ronda, sin mecánica nueva.
B. **Mazo Depurado** (diseño, sin implementar) — retira los cuatro 2
   del mazo (48 cartas en vez de 52): manos de valor alto más
   consistentes, pool de reparto más pequeño.
C. **Primera Fortuna** (diseño, sin implementar) — un reroll extra
   gratuito garantizado en la primera recompensa de la run.

Sin variante (`variantId: null`), una run es exactamente igual que
antes de esta iteración — verificado explícitamente en
`variants.test.ts`.

## 8. Boss desbloqueable — El Eco del Trono

De los 3 bosses aplazados en la 2D (El Apostador Ciego, El Eco del
Trono, El Heraldo Inverso), se seleccionó **El Eco del Trono** para
Ante 2 — es el que menos riesgo técnico/de exploit tenía sin rediseño
adicional (El Apostador Ciego necesitaba una salvaguarda anti-exploit
todavía sin diseñar; El Heraldo Inverso necesitaba 3 fases y más
superficie de HUD de la permitida). Ver `docs/BOSS_DESIGN_2D.md`
sección 2 para el diseño original completo.

`src/game/bosses.ts`: `BossDefinition` gana `locked: boolean` (`false`
en los 3 bosses de la 2D). `THRONES_ECHO` (`locked: true`): la primera
mano de la ronda puntúa a ×0.7 Mult para fijar un eco; cada mano
posterior suma un bonus aditivo de Mult igual al 20% del Mult base de
esa primera mano (reconstruido dividiendo entre 0.7, ya que
`modifyScore` solo puede devolver el desglose ya modificado — no hay
otro sitio donde guardar el Mult pre-transformación). `BOSSES_BY_ANTE[2]`
pasa a tener dos candidatos: El Contable Implacable (siempre
disponible) y El Eco del Trono (bloqueado).

`selectBossForAnte(seed, ante, unlockedBossIds = new Set())` filtra
los candidatos bloqueados cuyo id no esté en el set antes de tirar.
Con el set vacío por defecto, el comportamiento de los 3 bosses de la
2D no cambia — todos los tests previos siguen pasando sin tocarlos.
Una vez desbloqueado (Legado "Eco Prohibido" reclamado), entra a
competir con total naturalidad junto al candidato ya disponible del
mismo ante — la arquitectura multi-candidato de la 2D ya estaba
preparada para esto.

## 9. Flujo completo: victoria → Legado → Endless/nueva run

1. El jugador derrota al boss final de la ronda 9 (run no-Endless).
2. `handleWinRound` construye el `CoronationRecord`
   (`buildCoronationRecord`) y lo registra en el perfil
   (`recordCoronation`) antes de cambiar a la pantalla de victoria.
3. **Paso "summary"**: "CORONACIÓN COMPLETADA — Has conquistado esta
   Ascensión.", boss final derrotado, rondas, puntuación total, mejor
   jugada, Juramento activo, build dominante, y un botón que indica
   cuántos Legados hay disponibles (o "Continuar" si no queda
   ninguno).
4. **Paso "legacy"**: hasta 3 opciones (`offerLegacies`) o el mensaje
   de "todos reclamados". Elegir una llama a `onClaimLegacy`
   (`claimLegacy` + `saveProfile`) y pasa al siguiente paso.
5. **Paso "confirm"**: muestra qué se desbloqueó (si se eligió algo) y
   los 3 botones finales: **Seguir escalando** (Endless, marca
   `continuedEndless: true` en la Coronación, nunca pierde lo
   reclamado), **Nueva run** (arranca de inmediato con una seed nueva)
   y **Menú principal**.

Verificado manualmente de principio a fin (sección "Verificación" más
abajo).

## 10. Debug / reset (solo desarrollo)

`DevProfilePanel` en `App.tsx`, montado únicamente cuando
`import.meta.env.DEV` (mismo patrón que `src/game/debug.ts` de la
2C) — nunca aparece en el build de producción. Permite inspeccionar el
perfil crudo, resetear a `defaultProfile()` y reclamar temporalmente
los 3 Legados implementados para probar el flujo sin jugar 3 runs
completas.

## 11. Riesgos pendientes

- Los 6 Legados/5 Juramentos/2 variantes documentados pero no
  implementados son solo diseño — sus números y su encaje real con el
  resto del sistema no están validados.
- `offerLegacies` con solo 3 candidatos implementados hace que
  prácticamente todas las primeras Coronaciones ofrezcan los 3 a la
  vez; el sistema de prerrequisitos/exclusión no se ha visto todavía
  bajo una situación real con más de 3-4 Legados activos.
- El Eco del Trono no se ha validado con un playtest humano — su
  interacción con "Salida en Falso" (que también depende de
  `isFirstHand`) puede sentirse redundante o sinérgica de forma no
  intencionada; a vigilar.
- El "Nueva run" desde la pantalla de Coronación no conserva el
  Juramento/variante de la run recién ganada (sí lo hace "Reintentar"
  tras derrota) — decisión de scope, no un bug, pero puede sorprender
  a quien esperaba que se recordara.
- El perfil vive en una única clave de `localStorage` sin backup ni
  exportación — borrar datos del sitio pierde toda la progresión
  permanentemente. Aceptable para esta iteración (no hay servidor),
  pero a considerar si se añade sincronización en el futuro.

## 12. Decisiones aplazadas

- Ningún sistema de moneda permanente ni tienda entre runs — decisión
  de diseño explícita, no solo de scope (sección "Filosofía").
- Guardado de una run a medias (persistir `GameState` en curso) —
  explícitamente fuera de alcance, sistema distinto.
- Selector de UI para más de 1 Juramento/variante simultáneos — con
  solo 1 de cada implementado, un checkbox por opción es suficiente;
  un selector de verdad (radio buttons, por ejemplo) se justifica
  cuando haya 2+.
- `bossesDefeated` está listo para trackear múltiples bosses finales
  distintos, pero mientras Ante 3 solo tenga un candidato (El Trono
  Partido), siempre tendrá una única clave.
