# Dirección artística de cartas — Royale Climb

> Estado: **v1, propuesta pendiente de aprobación visual.** No se ha generado ningún
> asset todavía. El conector de Higgsfield disponible en esta sesión tiene 0
> créditos — nada de este documento se ejecuta hasta que el usuario apruebe la
> dirección y haya saldo disponible.

## 0. Por qué este documento no parte de una carta aprobada

El encargo original pedía extraer esta guía del último K♥ pixel-art aprobado.
Se revisó el historial completo del conector de Higgsfield (5 generaciones de
imagen, 0 medios subidos) y **ninguna es una carta de póker terminada**: son 5
retratos de busto de "un rey" en formato 3:4, sin marco de carta, sin índice de
esquina, sin letra de rango ni símbolo de palo, explorando distintas paletas
(cian+magenta, cian, esmeralda, magenta/rubí, ámbar-dorado). El usuario
confirmó explícitamente que ninguno de los 5 vale como referencia maestra.

Esta guía define por tanto una dirección **nueva**, fundamentada en dos fuentes
que sí existen y son fiables:

1. **La identidad visual ya en producción** del propio juego (`src/index.css`,
   `src/relicIcons.tsx`, `src/App.tsx`) — paleta neón sobre fondo casi negro,
   tipografía pixel `Press Start 2P`, y la asociación palo→personalidad que el
   propio código ya nombra en los modificadores de palo (ver sección 3).
2. **Los 5 bocetos de "rey"** de Higgsfield, usados únicamente como *mood-board
   de técnica* (cómo se resuelve el pixel-art SNES/JRPG con dithering y
   contorno neón), nunca como carta canon.

Cualquier futura carta aprobada por el usuario sustituye esta base y esta
sección debe reescribirse para apuntar a ella como referencia maestra real.

## 1. Proporción y dimensiones

Sin una carta previa que fije una proporción distinta, se usa la proporción
estándar de carta de póker: **5:7**.

- Resolución de trabajo: **750 × 1050 px** (proporción exacta 5:7, tamaño
  cómodo para detalle pixel-art y para reducir sin perder nitidez).
- Radio de esquina: **28 px** a esa resolución (~3.7% del ancho) — redondeo
  perceptible pero discreto, coherente con `rc-panel`/`rc-btn` del propio CSS
  del juego, que ya usa esquinas suavemente redondeadas en vez de rectas.
- Margen interior del marco: **34 px** en los 4 lados antes de que empiece la
  zona de índice o el área central.
- Debe alinear perfectamente si se superponen dos cartas cualesquiera del
  mazo (mismo lienzo, mismo margen, mismo radio) — condición dura de
  aceptación, no una sugerencia.

## 2. Paleta base (heredada del propio juego, no inventada)

Tomada directamente de las custom properties ya definidas en
`src/index.css`:

| Token | Hex | Uso en la carta |
|---|---|---|
| `--rc-void` | `#0a0714` | Fondo exterior / esquinas de la carta |
| `--rc-panel-2` | `#1b1730` | Degradado de fondo interior (con dithering, nunca gradiente liso) |
| `--rc-cyan` | `#00e5ff` | Borde exterior de la carta — **el mismo en las 52 cartas**, es lo que dice "esto es una carta de Royale Climb" antes de mirar el palo |
| `--rc-magenta` | `#ff2ea1` | Acento secundario / rim-light en figuras de palos rojos |
| `--rc-gold` | `#ffe94d` | Base del acento de Diamantes |
| `--rc-ink` | `#f3f1ff` | Texto de índice sobre fondo oscuro |

El borde cian es el elemento que unifica visualmente las 52 cartas — nunca
cambia de color por palo. La personalidad de cada palo vive **dentro** del
marco (ilustración, pips, rim-light), nunca en el borde exterior.

## 3. Identidad por palo (fundamentada en el propio código del juego)

`src/App.tsx` ya nombra un modificador por palo con una personalidad
implícita — se usa como ancla de diseño en vez de inventar algo nuevo:

| Palo | Modificador existente | Lectura de diseño | Acento propuesto |
|---|---|---|---|
| ♠ Picas | "Filo Negro" | oscuro, afilado, elegante, ligeramente amenazante | violeta-negro `#241f38` con filo frío cian |
| ♥ Corazones | "Pulso Carmesí" | rojo profundo, pasión, nobleza — **no** rojo neón plano | carmesí `#c81e4a` (no un rojo puro de semáforo) |
| ♦ Diamantes | "Veta Dorada" | precioso, afilado, **dorado**, no un segundo rojo | ámbar-dorado `#e8a33d` → `--rc-gold` |
| ♣ Tréboles | "Garrote Pesado" | orgánico, robusto, terroso | verde musgo oscuro `#2f4a35` |

Esto resuelve directamente el requisito del encargo de diferenciar Corazones
de Diamantes "mediante matiz" — en vez de dos rojos con distinta iluminación,
Diamantes es **dorado** (coherente con "Veta Dorada", que ya existe en el
juego), un tinte completo distinto, no una variación tonal del mismo rojo.
Del mismo modo, Picas (violeta-negro frío) y Tréboles (verde musgo orgánico)
quedan inmediatamente distinguibles por matiz, no solo por silueta del pip.

Los 4 acentos son suficientemente distintos entre sí y ninguno reutiliza el
cian del marco, así que el ojo siempre puede separar "esto es el marco de la
carta" de "esto es el palo".

## 4. Tratamiento de pixel art

Mismo lenguaje técnico que los bocetos de rey de Higgsfield (única parte de
esos bocetos que se conserva):

- Estilo SNES / 16-bit JRPG **ilustrado en alta resolución** (pixel-art
  estilizado tipo Octopath/HD-2D, no pixel puro de baja resolución) —
  contornos duros de grosor constante, dithering en checkerboard para
  degradados, cero antialiasing suave, cero blur, cero glow difuminado.
- Grosor de contorno de personaje/símbolo: constante en toda la baraja
  (definir un valor en la primera carta real y no volver a variarlo).
- Nada de sombra exterior, inclinación ni perspectiva "flotando" — la carta
  es un asset plano, esos efectos los pone la UI (ya se prohíbe explícitamente
  en el encargo original).

## 5. Índice de esquina (rango + palo)

- Posición: esquina superior-izquierda, con el mismo símbolo repetido rotado
  180° en la esquina inferior-derecha — convención estándar de baraja
  francesa, imprescindible para legibilidad cuando la carta se ve pequeña en
  el tablero.
- Tamaño y posición **idénticos en las 52 cartas** — solo cambia el glifo.
- Rango en texto grande (pixel font, no la tipografía `Press Start 2P` de la
  UI directamente porque es demasiado ancha a tamaños pequeños, sino un rango
  dibujado como parte del pixel-art con la misma lógica de trazo que el resto
  de la carta), símbolo de palo debajo, en el color del acento del palo
  (sección 3).

## 6. Zona central

### Figuras (K, Q, J)

- Retrato de busto pixel-art, de pie/frontal, enmarcado dentro del área
  central con el mismo margen que las numéricas — nunca sangra hasta el
  borde de la carta.
- Rim-light neón del color de acento del palo (sección 3) + un toque de cian
  del marco para que no se desconecte visualmente del resto de la baraja.
- Identidad propia por figura, no "el mismo personaje con accesorio
  distinto":
  - **Rey** — autoridad, peso, presencia. Corona alta, hombros anchos, gesto
    serio.
  - **Reina** — inteligencia, elegancia, autoridad equivalente al Rey (misma
    escala, misma presencia en el encuadre) — sin sexualización gratuita ni
    diseño de "princesa" genérico.
  - **Jota** — juventud, agilidad, carácter más impulsivo — postura menos
    rígida que K/Q, expresión más despierta.

### Numéricas (2–10)

Sistema reutilizable, no 9 ilustraciones distintas:

- Mismo marco, mismo índice, mismo fondo con dithering que las figuras.
- Distribución de *pips* (símbolo de palo repetido) en el layout clásico de
  baraja francesa según el número (2 en columna, 3 en columna, disposición en
  cruz a partir de 5, etc.) — cada pip es el mismo asset de símbolo de palo
  reutilizado a distintas posiciones, no un dibujo nuevo por número.
- Color del pip = acento de palo (sección 3).
- 10♥, 7♠ y 2♦ se generan primero precisamente para fijar ese layout
  (números alto/medio/bajo) antes de sistematizar el resto en una iteración
  futura.

### As

- Un único pip central, más grande que en las numéricas, con ornamentación
  pixel-art moderada alrededor (p. ej. un marco/aura sutil), pero **sin**
  ilustración de personaje ni cambio de layout de marco — debe seguir
  leyéndose como carta de la misma baraja, solo con más presencia.

## 7. Reverso

- Patrón geométrico simétrico, sin orientación arriba/abajo, sin texto.
- Paleta: `--rc-void` de fondo con motivo en cian + magenta (los dos acentos
  que ya usa toda la UI del juego para remarcar elementos importantes).
- Concepto: motivo de picos ascendentes (montaña/escalada) que convergen
  hacia una corona pequeña centrada — conecta con el nombre "Royale Climb"
  (ascenso + corona) sin copiar iconografía de Balatro.
- Debe funcionar repetido en mosaico y reconocerse reducido a icono pequeño.

## 8. Reglas de consistencia (checklist de aceptación por carta)

- [ ] Proporción 5:7, radio de esquina y márgenes idénticos a la sección 1.
- [ ] Borde exterior cian `--rc-cyan`, igual grosor en toda la baraja.
- [ ] Fondo interior con dithering checkerboard, nunca degradado liso.
- [ ] Índice en la misma posición/tamaño que el resto de cartas generadas.
- [ ] Acento de palo = el de la tabla de la sección 3, no un color libre.
- [ ] Contorno de personaje/símbolo con el mismo grosor que las cartas ya
      aprobadas.
- [ ] Sin sombra externa, sin glow difuminado, sin inclinación/perspectiva.
- [ ] Legible reducida a ~60 px de ancho (tamaño aproximado en el tablero).

## 9. Master set — prompts preparados (sin ejecutar, 0 créditos disponibles)

Los 7 prompts de abajo están redactados para lanzarse en cuanto haya saldo en
el conector. Todos comparten la misma estructura (marco, proporción, técnica)
y solo cambian rango/palo/acento, precisamente para maximizar consistencia y
minimizar regeneraciones (ver sección "control de créditos" del encargo
original). El primero (K♥) es el que fija el estándar real — los siguientes 6
deben usarlo como `input_image`/referencia una vez exista.

1. **K♥** — figura de Rey, acento carmesí `#c81e4a`, corona alta, gesto serio,
   fija el estándar de marco/índice/dithering para el resto.
2. **Q♠** — figura de Reina, acento violeta-negro con filo cian, elegancia y
   autoridad equivalentes al Rey, sin diseño de princesa genérico.
3. **J♦** — figura de Jota, acento dorado `#e8a33d`, postura más dinámica,
   expresión más joven/despierta que K y Q.
4. **A♣** — As, pip central verde musgo `#2f4a35` con ornamentación moderada,
   fija el estándar futuro de los 4 Ases.
5. **10♥** — numérica alta, fija el layout de pips para números grandes.
6. **7♠** — numérica media, valida el mismo sistema de pips con un número
   impar (disposición en cruz).
7. **2♦** — numérica baja, valida el sistema de pips en su caso más simple.
8. **Reverso** — patrón simétrico picos+corona en cian/magenta sobre
   `--rc-void`, sin texto, sin orientación.

## 10. Próximos pasos

1. Usuario aprueba esta dirección (o pide ajustes) sin gastar créditos.
2. En cuanto haya saldo en Higgsfield: generar K♥ primero en solitario,
   validarlo contra la sección 8 antes de continuar.
3. Solo tras aprobar K♥, generar el resto del master set (Q♠, J♦, A♣, 10♥,
   7♠, 2♦, reverso) usándolo como referencia de imagen.
4. Presentar las 8 piezas juntas a la misma escala para la validación descrita
   en el encargo original (sección 11) antes de plantear ampliar a las 52
   cartas.
