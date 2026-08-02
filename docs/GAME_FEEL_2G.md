# Claridad de build, feedback de mano y game feel — Iteración 2G

Esta iteración es exclusivamente presentacional: ningún objetivo de puntuación,
curva de dificultad, economía, precio, rareza, coste de reroll/banish,
synergy bias, límite de modificadores, valor de modificador, regla de boss,
Legado, Juramento, variante o metaprogresión ha cambiado. El rediseño
artístico definitivo sigue pausado — todo lo de aquí es capa provisional
sobre los mismos componentes ya existentes, con el objetivo de averiguar qué
información necesita mostrar ese rediseño futuro.

## 1. Problema observado en el playtest

Primer playtest humano completo tras la Iteración 2F: derrota en ronda 6/Ante
2, faltaron 663 puntos, 4 modificadores activos, 18 manos jugadas. La
dificultad no se percibió injusta ni fácil — el problema señalado fue de
**legibilidad**, no de balance:

> "Me cuesta visualmente ver qué combos/build tengo activos para jugar más
> enfocado a ellos. La interfaz se come información que debería estar viendo."

Y una sensación general de "ni fu ni fa": el juego funciona, pero no produce
suficiente feedback ni hace sentir las sinergias. Ningún sistema nuevo se
necesitaba — los que ya existen (afinidad de build desde la 2C, boss desde la
2D) simplemente no se comunicaban.

## 2. Jerarquía de información

Antes de esta iteración, `PlayScreen` tenía un `<aside>` de 4.5rem con solo
iconos de modificador (sin nombre visible sin hover), una etiqueta de texto
plano de build ("Afinidad: Parejas · Color", una sola línea sin indicar
intensidad), un historial de jugadas siempre expandido ocupando una franja
permanente, y una lista plana de "chips" de texto para el desglose de
puntuación mezclando base/modificadores/cartas sin distinción visual.

Reordenado siguiendo la prioridad del encargo (cartas → combinación →
puntuación prevista → modificadores activos → build → boss →
manos/descartes → objetivo → dinero): el layout ahora usa una columna
lateral fija en pantallas anchas (`lg:flex-row`, `order-1`/`order-2`) con
Build + Modificadores, y en pantallas estrechas esa misma columna aparece
**debajo** del área de juego (cartas, preview, botones) en vez de encima —
así lo primero que se ve siempre es con qué se está jugando, no el catálogo
de piezas que se posee. El historial de jugadas pasa a colapsado por
defecto. La semilla ya era texto pequeño y apagado (`text-[11px]
text-slate-600`) desde antes de esta iteración; se mantiene así.

## 3. Panel de build

`BuildAffinityPanel` reutiliza `computeBuildIdentity` (Iteración 2C) sin
recalcular nada: toma sus `affinities`, excluye `GENERAL` y muestra como
máximo 2 arquetipos (`topAffinities`, nueva función pura en
`buildIdentity.ts` — mismo dato que ya devolvía `computeBuildIdentity`, sin
umbral mínimo de piezas a diferencia de `dominantArchetypes`, pensada para
sesgo de ofertas). Cada arquetipo se muestra como nombre + 3 puntos
(`●●●`/`●●○`/`●○○` según `weak`/`moderate`/`strong`), con un `aria-label` en
el contenedor y un `Tooltip` en los puntos con la cuenta exacta ("1
modificador de Parejas — afinidad débil.") para quien quiera el detalle sin
depender solo del color/forma.

## 4. Activación de modificadores

`scorePlay` (game/scoring.ts) gana `activations: RelicActivation[]`
(`{ id, active, reason, contribution }`), un elemento por cada modificador
que el jugador posee, calculado **inline** en las mismas ramas
`if (has(id) && condición)` que ya decidían chips/mult — nunca una segunda
lógica paralela. Preview y ejecución real llaman a la misma `scorePlay`
(vía `scoreWithBoss`), así que nunca pueden divergir sobre si un modificador
activó. Ningún resultado numérico (chips/mult/total) cambió: solo se expone
metadata que ya estaba implícita en el flujo de cálculo.

`ModifiersPanel`/`ModifierRow` (panel persistente, sección 3 más abajo)
muestran cada modificador poseído con icono, nombre y un resumen
condición→efecto de una línea ("Pareja → +6 Mult"), leído de
`src/game/relicSummaries.ts` — una tabla puramente presentacional (misma
información que `Relic.desc`, redactada corta) que cubre los mismos 24 ids
que `RELIC_ARCHETYPES` (verificado por test). El contador "X/6" ya existía;
se mantiene, ahora siempre en el mismo panel.

## 5. Breakdown de scoring

`ScoreBreakdown` gana `linesDetailed: ScoreLine[]` (las mismas líneas de
`lines`, con `category: "base" | "relic" | "card"`, categorizadas dentro de
`scorePlay` al construirlas — no un post-proceso aparte). La sección "Boss"
del desglose se aísla **sin ningún cálculo nuevo**: el boss solo *añade*
líneas a `lines` al final (`scoreWithBoss`/`bosses.ts`, nunca reordena las
que ya había), así que todo lo que sobra más allá de
`linesDetailed.length` es, por construcción, línea de boss.

`ScoreBreakdownDetails` (componente en `App.tsx`) agrupa esto en Base /
Modificadores / Cartas / Boss + Total estimado, colapsado por defecto
("Ver desglose (N)"), sustituyendo la lista plana de chips de texto que
antes mezclaba todo sin distinción. Se usa tanto en la preview (antes de
jugar) como en "última jugada" (después de jugar) — mismo componente, mismos
datos.

## 6. Feedback de selección

`ActiveModifiersBlock` lee `preview.breakdown.activations` tal cual — cero
lógica propia sobre qué activa. Separa visualmente ✓ activos (verde,
contribución en mono a la derecha) de ✗ inactivos (gris, motivo truncado a
la derecha), cerca de la preview de puntuación como pide el encargo. Cuando
un modificador pasa de inactivo a activo entre selecciones sucesivas, su fila
recibe un pulso breve (`rcpulse`, 0.4s) — se detecta comparando el conjunto
de ids activos contra el del render anterior (vía `useRef`), así que solo
"anuncia" transiciones reales, nunca cada re-render por selección sin
cambios de activación. La selección de cartas en sí ya tenía animación
(elevación + borde dorado + transición de 150ms) desde antes de esta
iteración; no se ha tocado.

## 7. Feedback de ejecución

La secuencia al pulsar "Jugar mano" (cartas puntuando con `stagger` de
110ms, número flotante, sacudida de pantalla, partículas, overlay de
"¡Combazo!" para jugadas grandes) ya existía de iteraciones anteriores y
sigue dentro del rango recomendado (~0.5-1.3s el caso más largo, el overlay
de combo). No se ha añadido un control explícito de "saltar animación" —el
encargo lo marca como opcional ("si existe una opción sencilla...
considérala") y las duraciones ya están por debajo del umbral de
incomodidad; se deja para si un playtest futuro lo pide.

**Decisión de alcance explícita**: no se implementó un *tween* numérico de
`scoreThisRound` (contador de puntuación incrementándose dígito a dígito).
La barra de objetivo ya tiene `transition: width 0.5s ease` (visual
continuo del avance) y el número flotante/overlay de combo ya muestra el
delta con claridad; añadir además un tween del contador acumulado se juzgó
esfuerzo desproporcionado al beneficio para esta iteración presentacional.

## 8. Boss feedback

Nombre, regla (`shortDescription`/`description`) y estado dinámico
(`describeState`) del boss activo ya eran siempre visibles desde la
Iteración 2D — sin cambios ahí. Lo nuevo es la **advertencia antes de
jugar**: `bossHandWarning(gs, played, held, isFirstHand, isLastHand)`
(`bosses.ts`) reutiliza `scorePlay` (resultado pre-boss) y `scoreWithBoss`
(resultado post-boss) — si el total post-boss es menor que el pre-boss,
devuelve la línea que el propio boss añadió como texto de advertencia; si no
hay penalización (o el boss *suma*, como El Eco del Trono en manos
posteriores a la primera), devuelve `null`. Cero heurística nueva: la
"fuente de verdad" de si algo es una penalización es literalmente comparar
los dos resultados que el motor de scoring ya produce. La preview la muestra
como aviso `⚠ Penalización del boss: ...` justo debajo del resultado, antes
del botón "Jugar mano".

## 9. Microanimaciones

Inventario de animaciones funcionales tras esta iteración (todas ya
definidas o añadidas, ninguna es cinemática ni usa Canvas/WebGL/shaders):

| Evento | Animación |
|---|---|
| Carta seleccionada | Elevación + borde dorado + transición 150ms (preexistente) |
| Modificador activado | Pulso 0.4s en su fila de "Activos en esta mano" (nuevo) |
| Puntuación aumentando | Barra de objetivo con transición de ancho 0.5s (preexistente) + número flotante/overlay de combo (preexistente) |
| Objetivo superado | Pulso 0.9s en la etiqueta + barra pasa a degradado dorado/esmeralda (nuevo) |
| Compra realizada / recompensa elegida | Ya cubiertas por transiciones de botón existentes (`rc-btn`), sin cambios en esta iteración |
| Boss penalizando | Aviso ⚠ con borde/fondo rosado, aparece con el resto de la preview (nuevo) |

## 10. Accesibilidad

`Tooltip` se reescribió: el trigger es un `<span tabIndex={0} role="button"
aria-describedby={...}>` (antes, un `<span>` sin foco dependiente solo de
`:hover`/`group-hover`). Ahora responde a hover **o** foco de teclado, además
de click/tap (preparado para touch, sin implementar aún gestos táctiles
avanzados), con `Escape` para cerrar. El panel de texto lleva `role="tooltip"`
y está enlazado por id vía `aria-describedby`. Se usa en modificadores
(`ModifierRow`, ya lo usaba) y en arquetipos (`BuildAffinityPanel`, nuevo).

No se depende solo de color para transmitir estado: activo/inactivo usa
glifos ✓/✗ además de color; la fuerza de afinidad usa puntos rellenos/vacíos
además de color, con `aria-label` textual en el contenedor.

Se respeta `prefers-reduced-motion`: una única regla en `index.css`
(`[class*="animate-"], [style*="animation"] { animation: none !important; }`)
desactiva **todas** las animaciones actuales y futuras que usen el patrón
Tailwind `animate-[...]` o `style={{animation: ...}}`, sin tener que
enumerar cada keyframe uno a uno cada vez que se añade una nueva.

## 11. Decisiones visuales provisionales

- El panel de build/modificadores usa los mismos tokens de diseño
  (`.rc-panel`, `.rc-eyebrow`, paleta neón) ya establecidos — ninguna
  paleta, tipografía ni sistema visual nuevo.
- Los iconos de modificador siguen siendo los emoji/`RelicBadge` ya
  existentes; `docs/CARD_ART_DIRECTION.md` no se ha tocado.
- El layout de sidebar (`lg:w-64`) es una solución de arquitectura de
  información, no un diseño final — su ancho, tipografía y densidad se
  espera que cambien con el rediseño artístico.

## 12. Elementos deliberadamente aplazados hasta el rediseño artístico

- Insignias de material de carta (vidrio/acero/oro) dentro de `PlayingCard`
  no llevan tooltip: anidar un trigger focuseable dentro de un `<button>`
  (la carta) es HTML inválido y arriesga romper la selección. Su efecto ya
  es siempre visible en la sección "Cartas" del desglose y en la tienda al
  comprar.
- Sonido: no se implementó audio. Eventos identificados para cuando se
  diseñe junto al arte: `card_select`, `hand_play`, `modifier_trigger`,
  `score_tick`, `boss_penalty`, `round_win`, `run_loss`, `coronation`.
- No se tocó el HUD fuera de `PlayScreen` (menú, tienda, recompensa,
  Coronación) más allá de lo estrictamente necesario para que el layout no
  quedara inconsistente — el encargo pide claridad de build durante la
  partida, no un rediseño integral.
- No se implementó un contador numérico con *tween* (ver sección 7).
- No se implementó control de "saltar animación" (opcional en el encargo).

## 13. Riesgos

- El panel de build/modificadores en sidebar reduce el ancho disponible
  para el área de juego en pantallas medianas (entre el breakpoint móvil y
  `lg`, 1024px) — no se ha probado en un rango exhaustivo de anchos reales,
  solo en desktop (1568px) y verificado que el CSS de `flex-col`/`flex-row`
  es coherente por lectura de código.
- El pulso de "modificador recién activado" depende de que
  `ActiveModifiersBlock` no se desmonte entre renders (si se desmonta,
  pierde su `useRef` de comparación y el primer render tras remount no
  pulsa nada, lo cual es un fallo silencioso — no rompe nada, solo omite
  una animación).
- La advertencia de boss (`bossHandWarning`) recalcula `scorePlay` una vez
  más además de las llamadas que ya hace la preview — barato (pocas
  cartas, sin RNG) pero no memoizado explícitamente; con mazos de más de 5
  cartas seleccionadas seguiría siendo trivial, no se considera un riesgo
  de rendimiento real.
- No se ha medido con usuarios reales si "Ver desglose" (colapsado por
  defecto) es descubrible — es posible que algunos jugadores no lo
  encuentren y sigan sin entender el detalle completo de una jugada.

## 14. Preguntas para el próximo playtest

1. ¿El panel de Build/Modificadores en la barra lateral se nota y se lee en
   los primeros segundos, o sigue pasando desapercibido?
2. ¿El bloque "Activos en esta mano" cambia cómo se seleccionan cartas
   (jugar más deliberadamente hacia los modificadores activos), o se
   ignora?
3. ¿"Ver desglose" se descubre y se usa, o el resumen colapsado ya basta la
   mayoría de las veces?
4. ¿La advertencia de boss antes de jugar cambia decisiones reales (evitar
   la jugada penalizada), o llega demasiado tarde/poco visible?
5. ¿Sigue la sensación "ni fu ni fa", o el feedback añadido (pulsos,
   objetivo superado, desglose) ya genera más satisfacción al jugar una
   buena mano?
