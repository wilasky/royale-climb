# Bosses — Iteración 2D: estructura de Antes y variedad de encuentros

> Implementado sobre `design-overhaul`, a partir del commit `ee02fa5`
> (Iteración 2C). Esta iteración **no toca balance**: objetivos de
> puntuación, economía, precios, costes de reroll/banish, rarezas,
> synergy bias, valores numéricos de modificadores, límite de 6
> modificadores y recompensas económicas quedan exactamente igual que
> en la 2B/2C. El objetivo es variedad de encuentros — cambiar *cómo*
> se juega una ronda concreta, no volver a tocar números de balance.

## 1. Filosofía de bosses

Un boss de Royale Climb debe cambiar **cómo** juega el jugador durante
esa ronda, no limitarse a subir un número (objetivo +30%, menos manos,
menos descartes, multiplicador arbitrario) ni actuar como un *hard
counter* que desactive una categoría entera de juego.

Reglas explícitamente prohibidas para cualquier boss de Royale Climb
(no solo los implementados — también para futuros candidatos):

- "Los colores no puntúan."
- "Las parejas no puntúan."
- "Las figuras están desactivadas."
- "Los modificadores de economía dejan de funcionar."

Un jugador con una build especializada debe poder ganar cualquier boss
si adapta sus decisiones — el boss presiona la *forma* de jugar
(orden de manos, variedad, planificación de descartes, gestión de
riesgo), nunca elimina una vía de puntuación completa.

Los seis conceptos de abajo se diseñaron buscando: tensión, adaptación,
decisiones tácticas, planificación, y momentos memorables — sin copiar
literalmente los Boss Blind de Balatro. Ninguno desactiva una
categoría de mano, un palo o un rango de carta.

## 2. Los 6 conceptos diseñados

### Ante 1 — candidato A: El Espejo Inestable ✅ implementado

- **Temática:** un espejo que se resiente si le pides la misma imagen
  dos veces seguidas.
- **Regla:** si juegas el mismo tipo de mano (Pareja, Color, Escalera…)
  dos veces seguidas dentro de la misma ronda, la segunda vez su
  multiplicador se reduce a ×0.75. La primera vez que se juega un tipo
  de mano, o si cambias de tipo respecto a la mano anterior, no hay
  penalización.
- **Decisión nueva que crea:** ¿repito mi combo más fiable a pesar del
  descuento, o intercalo un tipo de mano distinto (aunque sea peor en
  bruto) para evitar la penalización? Introduce variedad de mano a
  mano sin prohibir ninguna.
- **Builds que afecta:** cualquier build que dependa de repetir
  sistemáticamente el mismo tipo de mano (p.ej. "solo Parejas"). No
  afecta a builds que ya combinan varios tipos de mano por diseño.
- **Por qué no es hard counter:** nunca lleva el multiplicador a 0 ni
  desactiva un tipo de mano — solo penaliza la repetición inmediata en
  un 25%. Un jugador de "solo Parejas" sigue pudiendo jugar Parejas
  toda la ronda, solo que alternas manos o acepta el descuento.
- **Posibles exploits:** ninguno grave — intercalar una mano débil de
  otro tipo entre dos repeticiones es la respuesta prevista, no un
  exploit. Riesgo real (no exploit): una build de un único arquetipo
  sin variedad de combos disponibles puede sentir la penalización como
  punitiva si su mazo no le da alternativas razonables.
- **Dificultad estimada:** baja-media — la regla es fácil de explicar
  y de anticipar (ronda 3, primer boss del juego).
- **Complejidad técnica:** baja. Estado: `{ lastHandName }`. Un solo
  hook de `modifyScore` + `afterHand`.

### Ante 1 — candidato B: El Apostador Ciego (aplazado)

- **Temática:** un apostador que solo paga si te la juegas del todo.
- **Regla:** tu última mano de la ronda es "todo o nada": si sus fichas
  base (antes de aplicar el multiplicador) no alcanzan por sí solas el
  objetivo restante en ese momento, esa mano puntúa 0. Si sí lo
  alcanza, sus fichas se doblan antes de multiplicar.
- **Decisión nueva que crea:** obliga a planificar la ronda para que la
  última mano sea genuinamente decisiva — no puedes dejarla "de
  relleno". Fuerza a decidir con antelación (descartes, orden de
  manos) qué combo reservar para el cierre.
- **Builds que afecta:** builds que dependen de ir "sumando poco a
  poco" con manos irregulares; favorece (sin ser obligatorio) a builds
  con algún pico de potencia reservable para el final (p.ej. relics de
  última mano).
- **Por qué no es hard counter:** no desactiva ningún tipo de mano; el
  "todo o nada" depende del objetivo restante, que el propio jugador
  controla con las manos anteriores (puede dejarse poco margen a
  propósito, o mucho, según su build).
- **Posibles exploits:** un jugador podría sobre-cumplir el objetivo
  antes de la última mano para que el "todo o nada" sea trivial de
  cumplir (objetivo restante ≈ 0) — lo cual en la práctica vacía la
  ronda de la tensión que el boss pretende crear. Es el motivo
  principal por el que queda aplazado: necesita una salvaguarda (p.ej.
  un mínimo de fichas exigido) antes de implementarse.
- **Dificultad estimada:** media — el "todo o nada" puede sentirse
  injusto si el objetivo restante es enorme por mala suerte de reparto.
- **Complejidad técnica:** media. Necesita conocer el objetivo restante
  en el momento de la última mano y una regla de "score parcial = 0"
  distinta a un simple multiplicador, más la salvaguarda anti-exploit
  mencionada arriba.

### Ante 2 — candidato A: El Contable Implacable ✅ implementado

- **Temática:** un contable que solo acepta cifras superiores a la
  última anotación en su libro.
- **Regla:** cada mano debe superar en puntuación total a la mano
  anterior jugada en esa misma ronda. Si no lo consigue, sus fichas se
  reducen a la mitad antes de multiplicar (el multiplicador no se
  toca). La primera mano de la ronda nunca se penaliza (no hay nada
  que superar todavía).
- **Decisión nueva que crea:** obliga a **secuenciar** las manos de
  forma ascendente: hay que reservar los mejores combos para el final
  y usar descartes para preparar manos cada vez mejores, en vez de
  jugar la mejor mano posible en cuanto aparece.
- **Builds que afecta:** builds de "un solo golpe fuerte seguido de
  relleno" (que sueltan su mejor mano primero y luego juegan cualquier
  cosa) — esas manos de relleno posteriores quedan penalizadas. No
  afecta a builds que ya escalan de forma natural ronda a ronda.
- **Por qué no es hard counter:** ninguna combinación de cartas está
  prohibida ni vale menos por su tipo — la penalización depende
  exclusivamente del orden en el que decides jugar tus manos, que el
  jugador controla.
- **Posibles exploits:** jugar deliberadamente una primera mano muy
  débil (casi 0) para dejar un listón trivial de superar el resto de
  la ronda. Es un exploit real y se documenta explícitamente como
  riesgo conocido para el próximo playtest — no se ha añadido ninguna
  salvaguarda en esta iteración (ver sección de riesgos).
- **Dificultad estimada:** media — presiona la planificación, no la
  potencia bruta.
- **Complejidad técnica:** baja. Estado: `{ previousTotal }`. Un hook
  de `modifyScore` + `afterHand`.

### Ante 2 — candidato B: El Eco del Trono (aplazado)

- **Temática:** el trono repite un eco de tu primera decisión durante
  el resto del combate.
- **Regla:** tu primera mano de la ronda puntúa con su multiplicador
  reducido a ×0.7 (se "sacrifica" para fijar el eco), pero a partir de
  ahí, cada mano posterior de la ronda recibe un bonus aditivo de
  multiplicador igual al 20% del multiplicador *base* (sin el ×0.7) de
  esa primera mano.
- **Decisión nueva que crea:** ¿juego mi combo más potente primero
  (debilitándolo, pero fijando un eco fuerte para el resto) o guardo
  potencia para más tarde (eco más débil, pero sin sacrificar nada)?
  Es lo opuesto en espíritu a "El Contable": aquí se premia abrir
  fuerte, no cerrar fuerte.
- **Builds que afecta:** cualquier build que dependa de un combo inicial
  muy marcado (p.ej. Salida en Falso). Puede combinarse de forma
  interesante o conflictiva con ese modificador — motivo adicional
  para aplazarlo y probarlo con calma.
- **Por qué no es hard counter:** el sacrificio es parcial (×0.7, no
  0) y el bono resultante beneficia a cualquier tipo de mano posterior
  por igual.
- **Posibles exploits:** jugar una primera mano deliberadamente débil
  en fichas pero con multiplicador artificialmente alto (si existiera
  una combinación así) maximizaría el eco sin sacrificar mucho en
  términos absolutos — a vigilar si se implementa.
- **Dificultad estimada:** media.
- **Complejidad técnica:** media — el estado debe recordar el
  multiplicador base de la primera mano (antes de su propio ×0.7) para
  poder calcular el bono de las siguientes.

### Ante 3 / final — candidato A: El Trono Partido ✅ implementado

- **Temática:** el trono se parte en dos mitades el instante en que
  demuestras que mereces la corona.
- **Regla:** boss de dos fases. Fase 1 (hasta que la puntuación
  acumulada de la ronda alcanza el 50% del objetivo): reglas
  normales. En el instante en que una mano hace cruzar ese umbral, la
  ronda entra en Fase 2 para el resto de las manos: cada mano posterior
  suma +40 fichas planas pero su multiplicador se reduce a ×0.7. La
  mano que cruza el umbral puntúa todavía con las reglas de Fase 1 (sin
  penalización retroactiva).
- **Decisión nueva que crea:** la primera mitad de la ronda recompensa
  builds de multiplicador puro; la segunda mitad recompensa relativamente
  más el volumen de fichas. Obliga a **replantear la estrategia a mitad
  de la ronda**, no solo a ejecutar el mismo plan de principio a fin —
  el propio encargo lo pedía explícitamente ("una decisión actual
  afecte a la siguiente mano", "fases dentro del enfrentamiento").
- **Builds que afecta:** builds de multiplicador extremo (Pacto de
  Sangre, El Coleccionista, Equilibrio Par) se sienten relativamente
  menos dominantes en Fase 2, sin dejar nunca de multiplicar. Builds de
  fichas planas (Filo Negro, Garrote Pesado, Plebe Útil) se sienten
  relativamente mejor en Fase 2.
- **Por qué no es hard counter:** el multiplicador nunca llega a 0 (solo
  ×0.7) y el bono de fichas se suma a cualquier mano por igual,
  cualquier tipo de mano sigue puntuando con normalidad.
- **Posibles exploits:** ninguno significativo identificado — como las
  manos son limitadas (4 por ronda) y descartar no puntúa, "retrasar"
  la Fase 2 a propósito cuesta manos que no se recuperan, así que no
  hay forma gratuita de evitar la transición. El riesgo real (no
  exploit) es que Fase 2 penalice de forma desproporcionada a una build
  de multiplicador puro justo en el tramo final de la run — a vigilar
  en el próximo playtest.
- **Dificultad estimada:** alta — es el boss final, debe sentirse
  claramente distinto a una ronda normal.
- **Complejidad técnica:** media. Estado: `{ phase }`. La transición se
  decide en `afterHand` comparando `gs.scoreThisRound + breakdown.total`
  contra `gs.target / 2`.

### Ante 3 / final — candidato B: El Heraldo Inverso (aplazado)

- **Temática:** un heraldo que anuncia un nuevo decreto cada vez que
  superas un hito de la ronda.
- **Regla:** el objetivo de la ronda se divide en tercios (33%/66%/100%).
  Al cruzar cada tercio se "proclama un decreto" que se aplica al resto
  de la ronda, alternando entre favorecer fichas (+30 fichas planas) y
  favorecer multiplicador (+1 Mult), de forma que la ronda tiene hasta
  tres fases distintas en vez de dos.
- **Decisión nueva que crea:** una escalada más granular que "El Trono
  Partido" — el jugador debe reaccionar hasta dos veces dentro de la
  misma ronda, no solo una. Buen candidato para una futura iteración
  cuando se quiera un segundo boss final con más variedad respecto al
  ya implementado.
- **Builds que afecta:** en teoría, ninguna build se ve perjudicada de
  forma permanente — cada tercio favorece brevemente a un tipo distinto
  de build, promediándose a lo largo de la ronda.
- **Por qué no es hard counter:** los bonos son siempre aditivos
  (nunca ×0 ni desactivan un tipo de mano); alternar entre favorecer
  fichas y multiplicador reparte la ventaja entre estilos de build en
  vez de perjudicar a uno solo de forma sostenida.
- **Posibles exploits:** ninguno obvio todavía — pendiente de diseño
  más detallado si se retoma.
- **Dificultad estimada:** alta.
- **Complejidad técnica:** alta — tres fases en vez de dos, más difícil
  de comunicar en el HUD sin más superficie de UI de la permitida en
  esta iteración. Motivo principal del aplazamiento.

## 3. Selección final: los 3 implementados

| Ante | Boss | Motivo de selección |
|---|---|---|
| 1 | El Espejo Inestable | Regla más clara y fácil de explicar al jugador nuevo; menor riesgo de sentirse injusto; complejidad técnica mínima (ideal para el primer boss del juego). |
| 2 | El Contable Implacable | Personalidad fuerte (presiona la planificación de orden de manos, algo que ningún modificador existente hace); implementación limpia con el mismo patrón de hooks que el boss de Ante 1. |
| 3 (final) | El Trono Partido | Es el que mejor cumple "debe sentirse claramente diferente a una ronda normal" con una complejidad técnica todavía razonable (dos fases, no tres); encaja con la sugerencia explícita del encargo sobre fases dentro del enfrentamiento. |

Los tres aplazados (El Apostador Ciego, El Eco del Trono, El Heraldo
Inverso) quedan documentados arriba para una iteración futura — ninguno
se ha implementado ni parcialmente.

## 4. Arquitectura técnica

`src/game/bosses.ts`:

- `BossDefinition`: `id`, `name`, `ante`, `shortDescription`,
  `description`, `initialState()`, y tres hooks opcionales:
  `modifyScore`, `afterHand`, `describeState`.
- `BOSSES_BY_ANTE: Record<1|2|3, BossDefinition[]>` — un array por
  ante, preparado para varios candidatos futuros aunque hoy solo tenga
  uno por ante.
- `selectBossForAnte(seed, ante)`: determinista — `makeRng(seed + ante
  * 97711)` y un único `rng()` para elegir índice. Con un solo
  candidato el resultado es trivial, pero el mecanismo ya es correcto
  para cuando haya varios.
- `scoreWithBoss(played, held, gs, isFirstHand, isLastHand)`: envuelve
  `scorePlay` (sin tocarla) aplicando `modifyScore` del boss activo si
  existe. Usada tanto por la previsualización como por la ejecución
  real en `App.tsx` — la misma llamada, así que preview y puntuación
  real siguen coincidiendo exactamente, también con boss activo.
- `advanceBossState(gs, breakdown, isFirstHand, isLastHand)`: calcula
  el nuevo `bossState` tras una mano, sin mutar el original.
- `describeBossState(gs)`: línea de estado legible para el HUD.

`GameState` gana `activeBossId: string | null` y
`bossState: Record<string, unknown>`, recalculados en cada
`startRound` — nunca sobreviven a la ronda para la que fueron
seleccionados. Endless no tiene bosses (`isBossRound` ya lo excluye),
así que continúa exactamente con el sistema anterior a esta iteración.

### Hooks utilizados (y por qué no hay más)

Solo se abstrajeron los tres hooks que los bosses implementados
necesitan de verdad:

- `initialState`: estado con el que arranca la ronda de boss.
- `modifyScore`: ajusta fichas/mult/total de una mano ya calculada.
- `afterHand`: calcula el siguiente estado tras resolver una mano.

No se implementaron `beforeRound` (más allá de fijar el estado
inicial, que ya cubre `initialState`), `afterDiscard` ni `afterRound`
porque ninguno de los tres bosses actuales los necesita — añadirlos
ahora habría sido un framework más grande de lo necesario. Son
extensiones naturales para bosses futuros que si los necesiten (p.ej.
un boss que reaccione a los descartes usaría `afterDiscard`).

`isBossRound(round, endless)` e `isFinalBossRound(round, endless)`
vive en `src/game/progression.ts`, centralizando la aritmética de
rondas de boss (nunca dispersa por `App.tsx`).

## 5. Riesgos pendientes

- **El Contable Implacable tiene un exploit conocido** (jugar una
  primera mano deliberadamente débil para fijar un listón trivial) sin
  salvaguarda en esta iteración. A observar en el próximo playtest: si
  los jugadores lo descubren y lo usan sistemáticamente, el boss pierde
  su propósito.
- **El Trono Partido** podría penalizar de forma desproporcionada a
  builds de multiplicador extremo en la recta final de la run — es la
  build más "premiada" por el resto del juego (El Coleccionista, Pacto
  de Sangre), así que conviene vigilar si el boss final se percibe como
  injusto específicamente para esas builds, sin llegar a ser un hard
  counter real.
- **El Espejo Inestable** podría sentirse punitivo para builds de un
  único arquetipo sin variedad de combos disponibles en fase temprana
  de la run (ante 1, todavía con pocos modificadores).
- Ningún boss se ha probado en una run completa jugada de principio a
  fin por una persona; las hipótesis de arriba están razonadas, no
  validadas.

## 6. Qué debe comprobar el siguiente playtest

- Si el jugador entiende la regla de cada boss sin tener que
  consultar documentación externa (el panel de boss activo y el aviso
  previo deberían bastar).
- Si El Espejo Inestable se siente como una decisión interesante o
  como una penalización arbitraria para builds poco variadas.
- Si El Contable Implacable empuja a planificar el orden de manos, o
  si los jugadores descubren rápidamente el exploit de "primera mano
  débil" y lo convierten en la jugada por defecto.
- Si El Trono Partido se nota como un cambio de ritmo real a mitad de
  ronda, y si penaliza en exceso a las builds de multiplicador puro.
- Si el aviso previo (telegraph) da tiempo suficiente para planificar
  la build/compras antes de llegar a la ronda de boss.
- Si tres bosses (uno por ante) dan suficiente variedad a lo largo de
  una run de 9 rondas, o si hace falta ampliar pronto a los tres
  aplazados.
