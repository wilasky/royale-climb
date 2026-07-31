# Royale Climb — registro del rediseño visual

Documento vivo de las decisiones tomadas durante el rediseño visual, para no depender de que la conversación con Claude siga abierta. Se va actualizando a medida que cerramos cosas. Nada de esto está aplicado todavía al código (`src/App.tsx`) — de momento todo es exploración visual en mockups.

## Estado: en fase de exploración visual (mockups), sin tocar código todavía

## Decisiones cerradas

1. **Dirección de arte: Neón arcade / synthwave.**
   Violeta oscuro casi negro de base, magenta + cian como acentos de brillo, suelo en perspectiva estilo synthwave. Elegido tras comparar 4 direcciones (casino de lujo, fantasía ilustrada, neón, minimalista).

2. **Material de carta: "Chrome Holo".**
   Metal oscuro con lámina holográfica que barre en diagonal (efecto foil de coleccionable), esquinas tipo circuito (brackets en L), marco con glow cian (palos negros) o magenta (palos rojos).

3. **Icono de carta numérica: pixel art, NO ilustración vectorial ni tatuaje/calavera.**
   Se probaron calaveras estilo tatuaje old-school → rechazado ("parecen dos huevos", "no tiene personalidad"). Se volvió a los palos clásicos ♠♥♦♣ pero en pixel art elevado: sombreado con dithering (punteado tipo sprite de 16-bit) + resplandor de neón envolvente.
   Tratamiento ganador: **"Pixel Emblema"** — el icono flota con un anillo de puntos orbitando alrededor y una sombra de pedestal debajo, como un objeto de valor levitando, no una carta plana.

4. **Figuras (K/Q/J): retrato generado con IA, no dibujado a mano — uno distinto por palo.**
   El primer intento a mano (cuadrícula de píxeles dibujada manualmente) salió mal — no se reconocía como rey. Se generó con un modelo de imagen (`nano_banana_2` vía Higgsfield, prompt propio, no es una carta real copiada) en estilo pixel art. Primer prototipo (genérico, cian+magenta mezclados) aprobado; luego se decidió ir más lejos: **cada palo tiene su propio retrato** con corona/gema/túnica pensadas para él, no solo un tinte:
   - ♠ Rey de picas — plata y hielo (gema cian) — **generado, OK**
   - ♣ Rey de tréboles — esmeralda y bronce — **generado, OK**
   - ♥ Rey de corazones — rubí y oro rosa (magenta) — **generado, OK**
   - ♦ Rey de diamantes — oro y amatista — **pendiente**, la generación falló (salió con fondo claro en vez de negro) y justo después se agotaron los créditos del workspace. Retomar con el mismo prompt que los otros tres, forzando "solid pure black background".

   Coste real: ~2 créditos por retrato generado. Gastados hasta ahora: 4 generaciones (1 prototipo genérico + picas + tréboles + corazones). Reina y Jota (mismo sistema, 4 palos cada una) quedan por hacer y costarán ~8 créditos cada figura completa.

5. **Distinción de palo: rango + icono de palo en la esquina, como en una baraja real.**
   El retrato de figura es el mismo independientemente del palo — lo que distingue picas/corazones/diamantes/tréboles es el icono pixel-art pequeño en la esquina (junto al rango), no solo el color del marco (cian vs magenta solo distingue negro/rojo, no el palo exacto).

6. **Cartas especiales (combo / multiplicador / cristal / oro) tienen movimiento; las normales NO.**
   Regla explícita: la baraja normal se queda estática. Las cartas con un efecto de juego real llevan animación que comunica ese efecto — ejemplo aprobado: anillo que gira + chispazos de energía + insignia "×2" pulsante. Rechazado antes: una chispa suelta sin significado ("no dice nada").

## Estado de créditos

Sin créditos en el workspace de Higgsfield a fecha 2026-07-31. La generación del Rey de diamantes quedó a medias (imagen inválida, fondo claro) justo antes de agotarse. Cuando haya créditos de nuevo: regenerar ese primero, luego seguir con Reina/Jota.

## Pendiente / próximos pasos

- Regenerar el Rey de diamantes (oro y amatista, fondo negro sólido) — es lo primero en cuanto haya créditos.
- Generar Reina y Jota con el mismo sistema que el Rey, un retrato por palo (mismo prompt base, cambiar corona/silueta/paleta).
- Definir cartas numéricas 2–10 sobre la misma base "Pixel Emblema" (ya validadas para Ases, falta ver el set completo).
- Definir variantes de material (cristal / acero / oro) sobre esta misma estética.
- Una vez cerrado el sistema de cartas: pasar a mesa/tablero (fondo, HUD, botones) con la misma dirección neón.
- Solo entonces tocar código: el plan sigue siendo romper `src/App.tsx` (2234 líneas, todo en un archivo) en componentes, quitar los restos muertos de la plantilla Vite (`src/App.css`, `src/assets/{hero.png,react.svg,vite.svg}`), y trabajar en una rama nueva (`design-overhaul` o similar) con PRs a `main` en vez de commitear directo, aprovechando los preview deploys de Vercel por PR.

## Dónde está guardado todo (para no depender de la conversación ni de carpetas temporales)

- **Mockup interactivo (Artifact):** https://claude.ai/code/artifact/dbc8e711-057e-4373-ad50-2967369a620d — se actualiza en la misma URL cada vez que iteramos, no hace falta pedir el enlace de nuevo.
- **Copia estática del mismo mockup en el repo:** `docs/design-assets/mockups/card-designs-latest.html` — ábrelo directamente en el navegador, funciona sin internet ni conversación activa.
- **Mockup de las 4 direcciones de arte (fase inicial):** `docs/design-assets/mockups/style-directions.html`.
- **Imágenes de los Reyes generadas por IA** (las que se ven dentro del mockup, ya incrustadas en base64 pero también sueltas por si acaso): `docs/design-assets/kings/king_spade.webp`, `king_club.webp`, `king_heart.webp`, y el primer prototipo genérico en `king_v1_prototype.png`.
- **Este documento** (`docs/visual-redesign-log.md`) con todas las decisiones y el estado.

Nada de esto vive ya solo en la carpeta temporal de la sesión — todo está copiado dentro del propio repo (`D:\proyects\royale-climb\docs\`). Si además se comitea a git, sobrevive incluso a un `git clean`.
