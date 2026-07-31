# Royale Climb — Auditoría de diseño y sistemas (Fase 1)

**Fecha:** 2026-07-31
**Alcance:** exclusivamente lógica de juego, economía, progresión, balance, claridad de decisiones, arquitectura y calidad técnica. **No se ha tocado el aspecto visual** (eso queda para otro proceso aparte, según instrucción explícita).
**Estado del repo auditado:** rama `design-overhaul`, commit `77acce7` (tras revertir los cambios visuales de cartas). `src/App.tsx` es el único archivo con lógica de juego (~2150 líneas tras el revert).

**Verificación de entorno ejecutada:**
- `npm install` → OK, 51 paquetes, 0 vulnerabilidades.
- `npm run build` → compila. **1 warning**: el `@import` de Google Fonts en `src/index.css` está después de `@import "tailwindcss"`, lo cual es CSS inválido (`@import` debe preceder a cualquier regla salvo `@charset`/`@layer`). No afecta al juego, es deuda técnica de la fase visual — ver P2-1.
- `npm run lint` (oxlint) → 0 avisos.
- App en local (`npm run dev`, puerto 5183/5184) → arranca y se juega correctamente; usado para confirmar en vivo los hallazgos de flujo (menú → ronda → recompensa → tienda → pantalla de victoria).

---

## 1. Resumen ejecutivo

Royale Climb tiene un núcleo de puntuación (fichas × multiplicador sobre manos de póker) sólido y una progresión de rondas con objetivo exponencial que funciona como base de un roguelike de cartas. El problema no es que falte contenido — hay 24 modificadores y 5 mejoras de carta — sino que **varios sistemas que deberían dar forma a las decisiones del jugador no están realmente conectados entre sí**:

- La rareza de un modificador no influye en absoluto en la probabilidad de que aparezca.
- La vista previa de la mano que ve el jugador antes de jugarla **no incluye ningún bonus de sus modificadores** — el número que ve y el número que recibe pueden diferir enormemente.
- El "Modo Endless" del menú es, en la práctica, el único modo que existe: toda partida se convierte en endless en cuanto se pasa por la primera tienda, sin que el jugador lo elija ahí.
- Varios arquetipos "de facto" (declarados en el propio catálogo de modificadores) no tienen piezas suficientes en el pool para ser una build real y coherente.

Ninguno de estos cuatro puntos es un problema de "falta de contenido" — son conexiones rotas o incompletas entre sistemas que ya existen. Por eso las primeras recomendaciones (sección 9) son baratas de arreglar y de alto impacto.

---

## 2. Fortalezas actuales

- **RNG determinista y bien seedeada.** `makeRng` (mulberry32) se siembra con `seed + ronda*primo` para el mazo por ronda, `seed+555` para recompensas y `seed+ronda*31337` para tienda. No hay ningún `Math.random()` dentro de la lógica de puntuación o generación de contenido — solo se usa para proponer una semilla nueva en el menú. Rejugar la misma semilla (`newGame(gs.seed, gs.endless)` en Derrota) reproduce la partida fielmente.
- **La evaluación de manos (`evaluateHand`, L364-406) es correcta y completa**: cubre las 9 combinaciones estándar más "Espectro" (variante propia: 5 cartas del mismo color sin ser color), con el caso especial de escalera A-2-3-4-5 bien resuelto.
- **El sistema de materiales de carta (cristal/acero/oro)** añade una capa de decisión real: cristal es riesgo/recompensa (rompe 25% de las veces salvo con el épico `glass_master`), acero premia *no* jugar una carta, oro premia tenerla en mano al final de ronda. Es la parte del diseño más cercana al espíritu de "decisiones interesantes, no solo números".
- **Lint y build limpios**, sin deuda de dependencias (`npm audit` → 0 vulnerabilidades).

---

## 3. Problemas — P0 (críticos, rompen el objetivo declarado del proyecto)

### P0-1. El "Modo Endless" no es una elección real — toda partida termina siéndolo

**Evidencia de código:**
```ts
// L2078-2087 — al superar una ronda:
const proceedAfterReward = (g: GameState) => {
  setGs(g);
  if (g.round % 3 === 0) {              // tras rondas 3, 6, 9...
    shopRng.current = makeRng(g.seed + g.round * 31337);
    setScreen("shop");
  } else { ... }
};

// L2098-2106 — al continuar desde la tienda:
const handleContinueFromShop = () => {
  if (!gs) return;
  if (gs.round % 3 === 0) {             // SIEMPRE es true aquí:
    setScreen("win");                   // la única forma de llegar a la tienda
    return;                             // es que round % 3 === 0
  }
  setGs(startRound(gs, gs.round + 1));  // <- código muerto, nunca se ejecuta
  setScreen("play");
};

// L2141-2145 — única forma de seguir jugando tras la pantalla de victoria:
const handleContinueEndless = () => {
  if (!gs) return;
  setGs(startRound({ ...gs, endless: true }, gs.round + 1)); // fuerza endless SIEMPRE
  setScreen("play");
};
```

**Consecuencia para el jugador:** el jugador elige "Nueva partida" o "Modo Endless" en el menú, pero esa elección solo cambia un texto ("El modo Endless continúa..." vs "¡Sigue escalando!") hasta la ronda 3. En cuanto termina la primera tienda, la *única* forma de seguir jugando es pulsar "Seguir escalando", que fuerza `endless: true` sin preguntar — el jugador que eligió "Nueva partida" nunca lo decidió y probablemente ni se entera. No existe ningún camino de código que lleve de la tienda a la ronda 4 sin pasar por la pantalla de victoria forzada. Además, la rama `else` de `handleContinueFromShop` es inalcanzable (código muerto).

**Solución propuesta:** decidir primero qué es el juego — ¿"Nueva partida" tiene un final real (p.ej. ante fijo, boss final) distinto de Endless, o el juego siempre fue pensado como una escalada sin fin y "Endless" solo debería cambiar algún parámetro (dificultad, recompensas)? Una vez decidido:
- Si debe haber final real: añadir una condición de victoria distinta (p.ej. superar un ante N) que solo aplique cuando `endless === false`, y un camino de continuación normal que no fuerce el flag.
- Si el juego es endless por diseño: eliminar el selector "Modo Endless" del menú (es una promesa falsa) o convertirlo en un modificador real de dificultad/economía, no en una copia idéntica del modo normal.

**Riesgo de la solución:** bajo — es un cambio de flujo de pantallas, no de balance. El riesgo principal es de producto: decidir la identidad del modo "normal" implica una decisión de diseño, no solo técnica.

**Cómo validarlo:** partida de prueba con semilla fija llegando a ronda 3 en ambos modos iniciales; confirmar que "Nueva partida" y "Modo Endless" divergen en algún comportamiento observable después de la primera tienda.

---

### P0-2. La rareza de un modificador no afecta su probabilidad de aparición

**Evidencia de código:**
```ts
// RewardScreen, L1530-1535
const offers = useMemo(() => {
  const owned = new Set(gs.relics.map((r) => r.id));
  const avail = RELIC_POOL.filter((r) => !owned.has(r.id));
  return shuffle(rng, avail).slice(0, 3);   // uniforme sobre TODO el pool
}, []);

// ShopScreen, L1610-1619 — mismo patrón para el stock de la tienda
```

`RELIC_POOL` (L437-461) tiene 24 modificadores: 7 comunes, 7 raros, 6 épicos, 4 legendarios. `shuffle` + `slice` es un muestreo uniforme sin reemplazo sobre el array completo — la rareza es solo una etiqueta visual y determina el precio en tienda (`priceOf`, L1612-1618: 5/7/10/14), pero no la frecuencia de aparición.

**Consecuencia para el jugador:** en la primerísima pantalla de recompensa (ronda 1), la probabilidad de que aparezca **al menos un legendario entre las 3 ofertas es del 43.7%** (hipergeométrico: 1 − C(20,3)/C(24,3) sobre un pool de 24 con 4 legendarios), prácticamente la misma probabilidad que la de ver un común (66.4% vs 66.4%, son iguales por simetría de conteo similar). Esto rompe cualquier sensación de progresión por rareza: un jugador puede tener acceso a "Pacto de Sangre" (legendario, x2.5 Mult global) en su primera decisión de la partida, y no volver a ver un legendario en las siguientes 10 rondas.

**Solución propuesta:** ponderar el muestreo por rareza (p.ej. pesos 50/30/15/5 para común/raro/épico/legendario, ajustables), manteniendo `shuffle` pero sustituyendo el `slice` uniforme por un muestreo ponderado sin reemplazo. Es un cambio local a las dos funciones citadas, sin tocar la interfaz `Relic` ni el resto del motor.

**Riesgo de la solución:** medio — cambia la curva de poder real de las partidas; necesita ajuste iterativo de pesos y no debe hacerse a la vez que otros cambios de balance para poder aislar su efecto.

**Cómo validarlo:** simulación offline (fuera del navegador, reutilizando `makeRng`/`shuffle`) de N partidas con distintos seeds, midiendo distribución real de rarezas ofrecidas por ronda antes/después del cambio.

---

### P0-3. La vista previa de la mano no refleja los modificadores del jugador

**Evidencia de código:**
```ts
// PlayScreen, L1081-1084 — lo que ve el jugador ANTES de jugar:
const preview = useMemo(() => {
  const cards = gs.hand.filter((c) => selected.includes(c.id));
  return evaluateHand(cards);          // solo tipo de mano + valores base
}, [selected, gs.hand]);

// playHand, usa en cambio:
const bd = scorePlay(played, held, gs, isFirstHand, isLastHand); // L516-645,
// incluye TODOS los bonus de relics, materiales, rachas, etc.
```

`evaluateHand` (L364-406) solo determina el *tipo* de combinación y sus fichas/mult *base* — no conoce nada de `gs.relics`, materiales de carta, ni de si es la primera/última mano. `scorePlay` sí, y es lo que realmente se usa para puntuar.

**Consecuencia para el jugador:** el recuadro "Combinación detectada" que ve el jugador mientras elige cartas (p.ej. "Pareja: 10 fichas × 2 mult") puede no tener relación alguna con lo que va a recibir si tiene, por ejemplo, "Eco Gemelo" (+6 Mult en parejas) o cartas de acero en mano. El jugador no puede comparar de forma informada dos selecciones de cartas distintas antes de comprometerse — descubre el resultado real *después* de pulsar "Jugar mano". Esto ataca directamente el criterio de diseño "claridad de causa y efecto" que pedías evaluar (sección 7).

**Solución propuesta:** sustituir la llamada a `evaluateHand` en el `useMemo` de `preview` por una llamada a `scorePlay` con los mismos argumentos que usa `playHand` (cartas seleccionadas como `played`, resto de la mano como `heldInHand`, `isFirstHand`/`isLastHand` calculados igual). Es un cambio de una línea con las funciones ya existentes.

**Riesgo de la solución:** muy bajo — `scorePlay` es puro (no muta estado), ya se usa así en `playHand`. Único cuidado: no disparar los `lines` de depuración visualmente si no se quiere saturar la UI de la vista previa (se puede seguir mostrando solo `chips`/`mult`/`total`).

**Cómo validarlo:** con un modificador activo que altere fichas o mult, comparar en vivo el número de la vista previa contra el resultado real al pulsar "Jugar mano" — deben coincidir exactamente.

---

## 4. Problemas — P1 (importantes, limitan la profundidad y el balance)

### P1-1. Desequilibrio aditivo vs. multiplicativo frente a una curva de objetivo exponencial

**Evidencia:** `targetForRound` (L647-648): `200 * 1.55^(ronda-1)` — objetivo ronda 1 = 200, ronda 5 = 1155, ronda 10 = 10 337. Es puramente exponencial y no depende de nada que el jugador controle. Frente a esto, en `scorePlay` (L516-645) los modificadores comunes son casi todos aditivos (`chips +=`, `mult +=`: Filo Negro, Garrote Pesado, Pulso Carmesí, Marea Cromática, Senda Recta...) mientras que varios raros/épicos/legendarios son multiplicativos (`mult *=`: Prisma Roto ×3, Equilibrio Par ×4, Salida en Falso ×3, Última Palabra ×4, Mano Firme ×2, Pacto de Sangre ×2.5).

**Consecuencia:** un +12 fichas fijo (Filo Negro) vale relativamente mucho en la ronda 1 (objetivo 200) y casi nada en la ronda 8 (objetivo ≈4300). Los multiplicativos, en cambio, escalan con todo lo demás y se pueden **combinar entre sí multiplicándose** (ej. Pacto de Sangre × Mano Firme × Salida en Falso en la primera mano sin descartes = 2.5×2×3 = 15× antes de contar nada más). Sumado a P0-2 (rareza no controla aparición), esto significa que sobrevivir a partir de cierto punto depende de tener suerte con multiplicativos, no de una estrategia construida con lo que vas encontrando.

**Solución propuesta:** dos vías no excluyentes — (a) hacer que los comunes aditivos escalen con la ronda o con algo que el jugador controle (p.ej. "+X fichas, y X crece con las rondas superadas"), o (b) introducir algún tipo de mejora/fusión de modificadores comunes a lo largo de la run para que no queden obsoletos. Cualquiera de las dos requiere simulación para no sobrecorregir.

**Riesgo:** alto si se hace a ciegas — es fácil convertir el problema opuesto (todo escala, nada es una decisión). Debe ir acompañado de la métrica de "ronda media de derrota" (sección 10) antes/después.

**Cómo validarlo:** simulación de partidas con estrategia fija ("siempre coger lo primero que aparezca") para medir en qué ronda mueren de media con el balance actual vs. el propuesto.

---

### P1-2. No existe ningún mecanismo de reroll/banish — cero control del jugador sobre el azar

**Evidencia:** búsqueda en el código de `reroll`/`banish`/persistencia de preferencias → sin resultados. Las ofertas de recompensa y tienda se generan una vez (`useMemo(..., [])`) y no se pueden regenerar por ningún precio.

**Consecuencia:** el jugador no tiene ninguna palanca para perseguir un arquetipo concreto; toda la identidad de la build depende 100% de qué le tocó, sin ninguna decisión intermedia. Esto pesa directamente sobre el criterio "control del jugador frente al azar" (sección 7) y hace más grave a P0-2.

**Solución propuesta:** añadir un botón de "reroll" en tienda con coste en $ creciente por uso (patrón estándar del género), limitado a la sesión de tienda actual.

**Riesgo:** bajo técnicamente; medio en balance (no debe ser tan barato que anule la aleatoriedad, ni tan caro que sea irrelevante).

**Cómo validarlo:** playtesting dirigido — medir si los jugadores que rerollean terminan con builds más coherentes (autoevaluación) que los que no.

---

### P1-3. Varios arquetipos "declarados" no tienen piezas suficientes para ser una build real

Ver tabla de arquetipos (sección 6). Resumen: Escalera, Cartas bajas y Primera/Última mano tienen 1-2 modificadores de soporte cada uno, sacados de un pool de 24 sin ninguna garantía de aparición (P0-2 + P1-2 combinados). Cristal/Acero/Oro necesita comprar una mejora de carta en tienda **y además** conseguir el relic épico correspondiente (`glass_master`) del pool aleatorio — doble dependencia de suerte.

**Solución propuesta:** para cada arquetipo "delgado", añadir 1-2 modificadores nuevos que lo refuercen, o fusionar arquetipos redundantes. No implementar sin decidir antes P0-2/P1-2 (de nada sirve añadir piezas a un pool que no se puede perseguir).

**Riesgo:** bajo, es contenido aditivo puro.

**Cómo validarlo:** repetir el análisis de la sección 6 tras el cambio y contar piezas de soporte por arquetipo.

---

### P1-4. `pair_mult` y `pair_chain` no se solapan

**Evidencia:** L554 `hr.name === "Pareja"` (exacto) vs. L569 `hr.name === "Doble pareja"` (exacto). Un jugador que arma una "build de parejas" necesita ambos modificadores — de un pool de 24 sin control — para tener soporte completo en ambos tipos de mano; tener solo uno deja la mitad del arquetipo sin bonus.

**Solución propuesta:** o bien hacer que "Eco Gemelo" también dé la mitad de bonus en Doble pareja (o viceversa), o documentar/aceptar que son dos sub-arquetipos distintos y no uno.

**Riesgo:** bajo.

**Cómo validarlo:** trivial, cambio de una condición y sus números asociados.

---

## 5. Problemas — P2 (menor urgencia / deuda técnica y pulido)

| # | Problema | Evidencia | Consecuencia | Solución | Riesgo |
|---|---|---|---|---|---|
| P2-1 | `@import` de Google Fonts después de `@import "tailwindcss"` en `index.css` | Warning de `npm run build` (Vite/Lightning CSS) | CSS inválido según spec; funciona por tolerancia del navegador pero es frágil | Mover el `@import` de la fuente antes que el de Tailwind | Ninguno |
| P2-2 | Todo el juego en un único `App.tsx` (~2150 líneas) | Ya señalado en `docs/visual-redesign-log.md` | Dificulta mantenibilidad al seguir añadiendo mecánicas de esta auditoría | Separar estado/lógica de juego (`gameLogic.ts`, sin JSX) de componentes UI, sin cambiar comportamiento | Medio si se hace junto a cambios de lógica; bajo si es un refactor puro primero |
| P2-3 | Sin persistencia entre sesiones (`localStorage`) | Búsqueda sin resultados en el código | No hay estadísticas de vida ni meta-progresión; cada sesión empieza de cero | Evaluar si encaja con el objetivo de rejugabilidad (ver propuestas diferenciadoras, sección 8) | Bajo, es una decisión de alcance |
| P2-4 | `DefeatScreen` no explica *por qué* se perdió, solo el resultado | L1809-1863 (aprox.) | Dificulta aprender de una derrota ("capacidad de entender una derrota", sección 7) | Añadir un desglose: mano/relic que más contribuyó, ronda donde el ritmo se rompió | Bajo |
| P2-5 | El As (rango 14) es "par" para "Equilibrio Par" por aritmética de JS (`14 % 2 === 0`) sin que la descripción lo aclare | scorePlay L606-609 | Puede sorprender al jugador (interacción no documentada, aunque no es un bug funcional) | Aclarar en la descripción del modificador o excluir explícitamente el As si no es la intención de diseño | Ninguno |

---

## 6. Flujo actual de una run

```
Menú
 └─ "Nueva partida" / "Modo Endless" (semilla opcional)
      └─ Ronda 1 → Recompensa (elegir 1 de 3 modificadores, o saltar +4$)
      └─ Ronda 2 → Recompensa
      └─ Ronda 3 → Recompensa → TIENDA (única entrada: round % 3 === 0)
                     └─ "Continuar" → SIEMPRE Pantalla de Victoria ("¡Ante N completado!")
                          ├─ "Seguir escalando" → fuerza endless=true → Ronda 4
                          └─ "Menú principal" → fin de la run (sin derrota registrada)
      └─ Ronda 4 → Recompensa
      └─ Ronda 5 → Recompensa
      └─ Ronda 6 → Recompensa → Tienda → Victoria → ... (se repite cada 3 rondas)

En cualquier ronda: si se agotan las manos sin llegar al objetivo → Derrota
                     (con "Misma semilla" para reintentar, o volver al menú)
```

Puntos ya cubiertos en P0-1: no existe un camino que lleve de la tienda directamente a la siguiente ronda sin pasar por la pantalla de Victoria, y esa pantalla solo ofrece "hacerlo endless" o "abandonar".

**Duración real de una partida normal:** al no existir condición de victoria distinta de "seguir hasta perder", la duración de una run "normal" es indistinguible de una endless desde la ronda 3 en adelante — la pregunta "¿cuánto dura una partida normal?" no tiene respuesta hoy porque el modo normal no completa un ciclo propio. Ver P0-1.

---

## 7. Tabla completa de modificadores

Rareza actual según `RELIC_POOL` (L437-461). "Rareza recomendada" refleja el análisis de P0-2/P1-1 (multiplicativos y de escalado deberían ser más raros que aditivos fijos del mismo orden de magnitud).

| Modificador | Rareza actual | Efecto | Condición | Frecuencia de activación aprox. | Sinergias | Antisinergias | Riesgo | Rareza recomendada | Abuso posible | ¿Decisión interesante o solo números? |
|---|---|---|---|---|---|---|---|---|---|---|
| Eco Gemelo (`pair_mult`) | Común | +6 Mult | Mano = Pareja exacta | Alta si juegas parejas sueltas | Minimalista (pareja = 2 cartas) | Doble pareja (no aplica, ver P1-4) | Ninguno | Común (ok) | Ninguno | Solo números |
| Marea Cromática (`flush_chips`) | Común | +60 fichas | Mano = Color | Baja (Color es infrecuente sin apoyo de mazo) | Filo Negro/Garrote Pesado si mono-palo | Mazos mixtos | Ninguno | Común, pero débil sin apoyo | Ninguno | Solo números |
| Senda Recta (`straight_mult`) | Común | +5 Mult | Escalera o Escalera de color | Baja | — | — | Ninguno | Subir a Rara (único soporte del arquetipo) | Ninguno | Solo números |
| Filo Negro (`spades_chip`) | Común | +12 fichas por ♠ jugada | Cualquier ♠ en la jugada | Alta si mono-palo ♠ | Otros bonus por palo | Mazos mixtos (diluye) | Ninguno | Común (ok) | Ninguno | Solo números |
| Pulso Carmesí (`hearts_mult`) | Común | +1 Mult por ♥ | Cualquier ♥ jugado | Alta si mono-palo ♥ | — | Mazos mixtos | Ninguno | Común (ok) | Ninguno | Solo números |
| Veta Dorada (`diamonds_money`) | Común | +1$ por ♦ jugado | Cualquier ♦ jugado | Alta si mono-palo ♦ | Interés (Banca Privada) | — | Ninguno | Común (ok) | Ninguno | Decisión económica leve |
| Garrote Pesado (`clubs_chip`) | Común | +10 fichas por ♣ | Cualquier ♣ jugado | Alta si mono-palo ♣ | — | Mazos mixtos | Ninguno | Común (ok) | Ninguno | Solo números |
| Salida en Falso (`first_hand_mult`) | Rara | ×3 Mult | Solo 1ª mano de la ronda | Baja (1 de 4 manos/ronda) | Mano Firme, Pacto de Sangre (se multiplican entre sí) | — | Ninguno | Rara (ok), pero débil en solitario | Combo con otros ×: 3 relics ×-stack en la 1ª mano sin descartes | Decisión de secuenciación (qué juegas primero) |
| Plebe Útil (`low_card_chip`) | Rara | +18 fichas por carta 2-6 | Cartas de rango bajo jugadas | Media | — | Builds de figuras/ases | Ninguno | Bajar a Común (es aditivo puro) | Ninguno | Solo números |
| Corte Noble (`face_mult`) | Rara | +2 Mult por figura (J/Q/K) | Figuras jugadas | Media | As bajo la Manga | Plebe Útil | Ninguno | Rara (ok) | Ninguno | Solo números |
| Reciclaje (`discard_refund`) | Rara | +2$ por descarte no usado al fin de ronda | Fin de ronda | Alta si juegas conservador | Interés | Builds agresivas de descarte | Ninguno | Rara (ok) | Ninguno | Decisión económica (¿descartar o ahorrar?) |
| Mano Firme (`no_discard_mult`) | Rara | ×2 Mult por mano | 0 descartes en toda la ronda | Media-alta (exige disciplina) | Pacto de Sangre, Salida en Falso | Manos que necesitan pulirse con descarte | Bajo (coste de oportunidad) | Subir a Épica (multiplicativo, aplica cada mano) | Combo ×-stack | **Sí** — riesgo/recompensa real |
| As bajo la Manga (`ace_chip`) | Rara | +25 fichas por As | As jugados | Media | Corte Noble, Equilibrio Par (14 es par, ver P2-5) | — | Ninguno | Rara (ok) | Ninguno | Solo números |
| Cadena Doble (`pair_chain`) | Rara | +4 Mult, +30 fichas | Mano = Doble pareja exacta | Baja-media | Eco Gemelo (build de parejas, ver P1-4) | — | Ninguno | Rara (ok) | Ninguno | Solo números |
| Bola de Nieve (`scaling_round`) | Épica | +0.5 Mult permanente por ronda superada | Automático | Total (pasivo) | Todo (mult flat que crece) | — | Ninguno | Épica (ok), motor de late-game | Ninguno | Solo números, pero soluciona parcialmente P1-1 |
| Banca Privada (`interest`) | Épica | +1$ por cada 5$ (máx 6$) | Fin de ronda | Alta si acumulas dinero | Veta Dorada, Reciclaje | Gastar todo en tienda | Ninguno | Épica (ok) | Ninguno | Decisión económica (ahorrar vs. gastar) |
| Maestro del Vidrio (`glass_master`) | Épica | Cristal da ×4 en vez de ×2 y no se rompe | Requiere cartas de cristal ya compradas en tienda | Depende de setup previo | Cristal Frágil (mejora de tienda) | Sin cartas de cristal, no hace nada | Ninguno (una vez conseguido) | Épica (ok), pero doble dependencia de RNG (ver P1-3) | Ninguno | Sí, pero requiere planificación de 2 pasos |
| Minimalista (`small_hand`) | Épica | +50 fichas, +4 Mult | ≤2 cartas jugadas | Media | Eco Gemelo (pareja = 2 cartas) | Manos grandes (Color, Escalera) | Ninguno | Épica (ok) | Ninguno | **Sí** — incentiva jugar menos cartas, contraintuitivo |
| Prisma Roto (`spectrum_boost`) | Épica | ×3 Mult | Mano = Espectro | Muy baja (Espectro es difícil de armar) | Tintura de Palo (mejora de tienda) | — | Ninguno | Bajar a Rara si no se refuerza el arquetipo, o mantener Épica y añadir más apoyo | Ninguno | Sí, pero el arquetipo base es demasiado débil (P1-3) |
| Equilibrio Par (`even_odd`) | Épica | ×4 Mult | Todas las cartas jugadas con rango par (As cuenta como par, ver P2-5) | Media-baja | As bajo la Manga | Cartas impares en mano | Ninguno | Épica (ok) | Ninguno | Sí, condición no obvia (ver P2-5) |
| Pacto de Sangre (`blood_pact`) | Legendaria | ×2.5 Mult global | Automático, pero −1 mano por ronda | Total (pasivo) | Cualquier otro ×, Mano Firme | Rondas que ya iban justas de manos | Alto (menos margen de error) | Legendaria (ok) — es la única con riesgo real explícito | Combo ×-stack con Mano Firme/Salida en Falso | **Sí** — el único relic con riesgo explícito |
| Desbordamiento (`overflow`) | Legendaria | +8$ si superas el objetivo x2 | Al superar ronda con margen x2 | Baja-media, depende del resto de la build | Multiplicativos fuertes | — | Ninguno | Legendaria (ok) | Ninguno | Sí — incentiva apuntar a un margen extra |
| El Coleccionista (`the_collector`) | Legendaria | +3 Mult por cada modificador poseído | Automático, escala con nº de relics | Total, crece con la run | Sinérgico con tener muchos relics (incluso débiles) | Runs con pocos relics | Ninguno | Legendaria (ok) — motor de late-game junto a Bola de Nieve | Ninguno | Solo números, pero da valor retroactivo a relics comunes débiles |
| Última Palabra (`final_hand`) | Legendaria | ×4 Mult | Solo última mano de la ronda | Baja (1 de 4 manos) | Salida en Falso (cubren manos distintas) | — | Ninguno | Bajar a Épica si no se complementa siempre con Salida en Falso | Combo ×-stack | Decisión de secuenciación |

### Mejoras de carta (tienda, `SPECIAL_DEFS`, L474-480)

| Mejora | Rareza | Precio | Efecto | Riesgo | ¿Decisión interesante? |
|---|---|---|---|---|---|
| Tinta Brillante (`bonus`) | Común | 4$ | +30 fichas planas a una carta elegida | Ninguno | Solo números, pero permanente y dirigido |
| Cristal Frágil (`glass`) | Rara | 5$ | Carta ×2 puntos, 25% de romperse al jugarla | Medio (pierdes la carta) | **Sí** — riesgo/recompensa real, base del arquetipo Cristal |
| Núcleo de Acero (`steel`) | Rara | 6$ | +1.5 Mult mientras esté en mano sin jugar (se acumula por cada carta de acero no jugada, cada mano de la ronda) | Ninguno | **Sí** — premia no jugar una carta, poco intuitivo mecánicamente |
| Lámina de Oro (`gold`) | Rara | 5$ | +3$ si está en mano al fin de ronda | Ninguno | Decisión económica (¿juegas la carta o la guardas?) |
| Tintura de Palo (`suitconv`) | Común | 4$ | Convierte el palo de una carta elegida | Ninguno | Herramienta de construcción de mazo, no da puntos directos |

---

## 8. Arquetipos: viabilidad real

| Arquetipo | Piezas de soporte en el pool | ¿Viable como build coherente? |
|---|---|---|
| Pareja / Doble pareja | 2 relics, pero no se solapan (P1-4) | Parcial — necesitas ambos relics para cubrir los dos tipos de mano |
| Color y palos (mono-palo) | 5 relics (4 por palo + Marea Cromática) | **Sí** — el mejor soportado del juego |
| Escaleras | 1 relic (Senda Recta) | No — insuficiente para ser una build, es un bonus ocasional |
| Cartas bajas (2-6) | 1 relic (Plebe Útil) | No — igual que arriba |
| Figuras y ases | 2 relics complementarios (no se pisan) | **Sí** — bien soportado |
| Manos de pocas cartas | 1 relic (Minimalista), sinergiza con Eco Gemelo | Parcial — funciona si además cae Eco Gemelo |
| No usar descartes | 1 relic, pero multiplicativo y aplica cada mano | **Sí** — potente con una sola pieza, buen diseño de "build de una carta" |
| Primera o última mano | 2 relics, cada uno cubre 1 de 4 manos/ronda | Parcial — flavor más que build; solo brilla si caen ambos |
| Economía ($) | 4 relics, pero no traducen directamente a puntuación | Sí como *meta*-lane (compra poder), no como forma de puntuar |
| Cristal / Acero / Oro | Requiere comprar la mejora en tienda **y** (para cristal) un relic épico específico | No de forma fiable — doble dependencia de RNG (P1-3) |
| Espectro | 1 relic (Prisma Roto), y la mano base es difícil de armar sin apoyo de mazo | No — el arquetipo más débil del juego actualmente |

---

## 9. Evaluación según los criterios de diseño pedidos

| Criterio | Evaluación |
|---|---|
| Tiempo hasta la 1ª decisión significativa | Bueno — la primera recompensa llega al terminar la ronda 1 (1-2 minutos) |
| Frecuencia de decisiones relevantes | Moderada — 1 elección de relic por ronda, decisión más rica cada 3 rondas en tienda |
| Claridad de causa y efecto | **Mala** — rota por P0-3 (preview no incluye relics) |
| Capacidad de construir identidad | **Mala** — rota por P0-2 (sin control de rareza) y P1-2 (sin reroll) |
| Variedad entre partidas | Media — el seed varía el orden, pero el pool y sus pesos son siempre los mismos, sin meta-progresión (P2-3) |
| Cantidad de elecciones falsas | Presente — con relics comunes débiles en rondas avanzadas (P1-1), "Saltar (+4$)" puede ser objetivamente mejor que las 3 ofertas, sin que el juego lo señale |
| Riesgo frente a recompensa | Débil en general — de 24 relics, solo Pacto de Sangre tiene una contrapartida negativa explícita; Cristal Frágil es la única mejora de carta con riesgo real |
| Control del jugador frente al azar | **Bajo** — ver P0-2 y P1-2 |
| Capacidad de entender una derrota | Media — Derrota muestra estadísticas pero no diagnóstico (P2-4) |
| Posibilidad de remontar | Sin mecanismo de remontada dentro de una ronda más allá de los descartes; entre rondas, ninguno (aceptable en un roguelike de permadeath, pero conviene decidirlo explícitamente) |
| Ritmo emocional (preparación/tensión/explosión/descanso) | El bucle existe, pero la pantalla de Victoria forzada cada 3 rondas (P0-1) interrumpe el ritmo con una decisión falsa ("seguir" es la única opción real) |
| Duración recomendable de una run | No determinable con el código actual sin simulación — depende enteramente de P0-1 (no hay final real) y P1-1 (curva vs. poder disponible) |

---

## 10. Análisis de economía

- **Dinero inicial:** 4$ (`newGame`, L2040-2059).
- **Ingreso por ronda superada:** `cashOut = 3 + handsLeft` (L1202) + bonus de relics (Reciclaje: +2$/descarte no usado; Banca Privada: +1$ por cada 5$ hasta +6$; Desbordamiento: +8$ si doblas el objetivo) + 3$ por cada carta de oro en mano.
- **Ingreso por saltar recompensa:** +4$ fijo, siempre disponible.
- **Precios en tienda:** relics 5/7/10/14$ según rareza (pero ver P0-2: la rareza no predice cuándo aparecerá); mejoras de carta 4-6$ fijas; venta de carta +2$ (mínimo 20 cartas en el mazo).
- **Lectura:** el sistema económico en sí está razonablemente cerrado (fuentes y sumideros claros), pero **su relación con la rareza está rota por la misma razón que P0-2**: pagar más por un legendario no está justificado si un legendario podía haber aparecido gratis en la recompensa de la ronda anterior con la misma probabilidad que un común.

---

## 11. Análisis de la curva de dificultad

`targetForRound(n) = round(200 × 1.55^(n-1))`:

| Ronda | Objetivo |
|---|---|
| 1 | 200 |
| 2 | 310 |
| 3 | 481 |
| 4 | 745 |
| 5 | 1 155 |
| 6 | 1 790 |
| 7 | 2 775 |
| 8 | 4 302 |
| 9 | 6 669 |
| 10 | 10 337 |

Crecimiento puramente exponencial (×1.55 constante), sin relación con el poder que el jugador ha acumulado. Combinado con P1-1 (comunes aditivos no escalan, multiplicativos son la única forma real de seguir el ritmo) y P0-2 (los multiplicativos no son más fáciles de conseguir por ser más raros — es 50/50 azar), la dificultad real percibida depende casi enteramente de la suerte de las primeras 3-4 rondas, no de las decisiones tomadas. Esto no se puede cuantificar con precisión ("¿en qué ronda muere el jugador medio?") sin una simulación automatizada — no existe hoy ningún harness de simulación en el repo.

---

## 12. Arquitectura y deuda técnica

- Todo vive en `src/App.tsx` (~2150 líneas): tipos, catálogo de datos (`RELIC_POOL`, `SPECIAL_DEFS`), lógica pura (`evaluateHand`, `scorePlay`, `targetForRound`), RNG, y todos los componentes de UI de las 6 pantallas.
- La lógica de juego y la presentación no están separadas — cualquier cambio de balance (esta auditoría) requiere editar el mismo archivo que la presentación visual (que está congelada aparte). Esto es un riesgo de conflicto entre ambos frentes de trabajo si avanzan en paralelo.
- No hay tests automatizados de ningún tipo (ni unitarios de `evaluateHand`/`scorePlay`, ni de flujo). Dado que esta auditoría propone cambios de balance no triviales, la ausencia de tests para las funciones puras (`evaluateHand`, `scorePlay`, `targetForRound`) es el mayor riesgo técnico de cara a iterar con confianza.
- No hay ningún sistema de logging/telemetría — las métricas propuestas en la sección 14 no se pueden recoger hoy sin añadir instrumentación.

---

## 13. Diez mejoras ordenadas por impacto/esfuerzo

| # | Mejora | Impacto | Esfuerzo | Problema que resuelve |
|---|---|---|---|---|
| 1 | Vista previa de mano usa `scorePlay` en vez de `evaluateHand` | Alto | Bajo | P0-3 |
| 2 | Quitar el forzado de `endless: true`; dar continuación real en modo normal | Alto | Bajo | P0-1 |
| 3 | Ponderar aparición de modificadores por rareza (recompensa y tienda) | Alto | Medio | P0-2 |
| 4 | Reroll limitado (con coste creciente) en tienda | Alto | Medio | P1-2 |
| 5 | Reescalar o "mejorar" relics comunes para no quedar obsoletos ante la curva exponencial | Alto | Alto | P1-1 |
| 6 | Reforzar arquetipos delgados (Escalera, cartas bajas, primera/última mano) con 1-2 relics extra cada uno | Medio | Medio | P1-3 |
| 7 | Resolver el hueco Eco Gemelo / Cadena Doble | Medio | Bajo | P1-4 |
| 8 | Desglose de causas en pantalla de Derrota | Medio | Bajo | P2-4 |
| 9 | Añadir tests unitarios a `evaluateHand`/`scorePlay`/`targetForRound` antes de tocar balance | Medio (habilita todo lo anterior con confianza) | Medio | Deuda técnica (sección 12) |
| 10 | Separar lógica de juego (`gameLogic.ts`, sin JSX) de los componentes UI | Medio a largo plazo | Alto | Deuda técnica (sección 12) |

---

## 14. Métricas propuestas para comprobar si el juego mejora

No existe telemetría hoy — estas métricas requieren añadir instrumentación (local, sin datos personales) antes de poder medirse:

1. **Distribución real de rarezas elegidas por partida** — valida si el peso de P0-2/mejora 3 funciona como se espera.
2. **% de runs que superan ronda 3 / 6 / 9** — calibra la curva de dificultad (sección 11) frente al balance real.
3. **Ronda media y varianza en la derrota** — detecta si el juego es demasiado punitivo o demasiado fácil, y si mejora tras los cambios de balance.
4. **% de veces que se pulsa "Saltar (+4$)" en recompensa** — proxy directo de "elección falsa": si es muy alto, las ofertas no son suficientemente atractivas.
5. **Frecuencia de uso de cada modificador en runs ganadoras vs. perdedoras** — detecta dominancia (se usa siempre que aparece) o inutilidad (nunca se elige aunque aparezca).
6. **Duración media de una partida en minutos** — referencia para "duración recomendable de una run" (sección 9).
7. **Divergencia observable entre partidas iniciadas como "Nueva partida" vs. "Modo Endless"** — debería ser 0% hoy (confirma P0-1) y debería subir a 100% tras la mejora 2.

---

## 15. Propuestas de elemento diferenciador (NO implementadas — solo para revisión)

### A. Rutas de Ascenso
En cada punto de tienda (cada 3 rondas), el jugador elige entre 2-3 rutas con distinto perfil de riesgo antes de seguir subiendo (p.ej. objetivos más altos pero más ofertas de relics raros, o objetivos suaves pero tienda más cara).
- **Decisión nueva:** qué perfil de riesgo asumir para el siguiente tramo, no solo qué relic coger.
- **Encaje con "ascenso":** literal — varios caminos posibles hacia arriba, coherente con el nombre del juego.
- **Efecto en builds:** da al jugador una palanca indirecta contra P0-2 (puede sesgar qué tipo de recompensas va a ver).
- **Coste de implementación:** medio — nueva pantalla/estado de selección de ruta, parametrizar generación de recompensas/tienda por ruta.
- **Riesgo de sobrecomplicar:** medio — añade una decisión más al bucle cada 3 rondas; hay que vigilar que no ralentice la partida.

### B. Presión del Verdugo
Un indicador visible que sube si superas rondas por poco margen y baja (dando una racha/bonus) si las superas con margen amplio — sin penalizar nunca por jugar "seguro", solo ofreciendo más recompensa por arriesgar.
- **Decisión nueva:** jugar para el mínimo necesario (seguro) vs. buscar una mano grande (racha).
- **Encaje con "ascenso":** temática de ser perseguido mientras subes la torre.
- **Efecto en builds:** favorece aún más a los multiplicativos de "mano explosiva" — debe implementarse junto con la mejora 5 (rebalanceo aditivo/multiplicativo), no antes.
- **Coste de implementación:** medio — nuevo estado por ronda + UI.
- **Riesgo:** alto si se comunica como "castigo" en vez de "bonus opcional" — chocaría con la restricción explícita de evitar mecánicas de presión artificial.

### C. Marcado de Cartas (identidad de mazo persistente)
Cartas concretas que se juegan repetidamente en manos ganadoras acumulan un pequeño bonus permanente propio (visualmente marcadas), independiente de los modificadores.
- **Decisión nueva:** qué cartas concretas cultivar activamente, no solo qué relic coger.
- **Encaje con "ascenso":** progresión tangible y personal de "tu" mazo mientras subes, no solo de tu bolsa de relics.
- **Efecto en builds:** da una vía de poder que no depende del RNG de relics — mitiga P0-2/P1-2 desde otro ángulo.
- **Coste de implementación:** medio-alto — nuevo estado persistente por carta, UI de progreso, límites para evitar bola de nieve descontrolada.
- **Riesgo:** medio — fácil que se vuelva "rich-get-richer" sin un tope; necesita diseño cuidadoso de la curva de crecimiento.

---

## 16. Roadmap recomendado (iteraciones pequeñas)

1. **Solo bugfixes de flujo/claridad** (mejoras 1, 2, 7 de la sección 13): sin tocar ningún número de balance. Bajo riesgo, se puede validar en una sesión de playtesting corta.
2. **Red de seguridad técnica**: tests unitarios de `evaluateHand`/`scorePlay`/`targetForRound` (mejora 9) — antes de tocar más balance.
3. **Economía de aparición**: ponderar rareza (mejora 3) + reroll en tienda (mejora 4). Requiere simulación, no solo playtesting manual.
4. **Balance de poder**: revisar relics comunes débiles frente a la curva exponencial (mejora 5), reforzar arquetipos delgados (mejora 6).
5. **Claridad post-partida**: desglose en Derrota (mejora 8).
6. **Arquitectura**: separar lógica de UI (mejora 10) — idealmente antes de la iteración 4 si el volumen de cambios de balance lo justifica, para no seguir mezclando ambos frentes.
7. **Diferenciador**: solo tras validar con métricas (sección 14) que el balance base ya es sólido, implementar UNA de las tres propuestas de la sección 15 (no las tres a la vez).
