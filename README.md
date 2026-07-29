# 🃏 Royale Climb

Un roguelike de cartas donde construyes combos de póker, eliges modificadores tras cada ronda y escalas dificultad hasta que la baraja te traiciona.

**👉 [JUGAR EN EL NAVEGADOR](https://royale-climb.vercel.app)**

---

## De qué va

Cada ronda tienes un objetivo de puntos. Formas combinaciones (parejas, tríos, escaleras, colores...) para puntuar. Al superar la ronda eliges un **modificador** que cambia tus reglas de puntuación para el resto de la partida. Cada 3 rondas se abre una **tienda** donde afinas tu baraja.

- **24 modificadores** con sinergias reales
- **Combinación especial propia**: Espectro (5 cartas del mismo color, sin ser color)
- **Cartas especiales**: cristal, acero, oro, con efectos únicos
- **Semillas reproducibles** — comparte una semilla y otro juega tu misma partida
- **Modo Endless** para runs infinitas
- **Pixel art CSS puro** — sin assets externos, todo dibujado a mano en código

## Cómo se juega

1. Selecciona hasta 5 cartas de tu mano
2. Juega la mano (puntúa) o descarta (cambia cartas)
3. Alcanza el objetivo antes de quedarte sin manos
4. Elige un modificador y sigue escalando

Tienes 4 manos y 3 descartes por ronda. La dificultad sube exponencialmente.

## Stack

- React + TypeScript
- Tailwind CSS
- Vite

Todo en un único archivo React. Sin backend, sin dependencias pesadas.

## Créditos

Proyecto vibecodeado con Claude (Anthropic) como piloto. Diseño de sistemas, sprites pixel-art y balance por iteración conversacional.

## Ejecutar en local

Si quieres tocarlo tú:

```bash
git clone https://github.com/wilasky/royale-climb.git
cd royale-climb
npm install
npm run dev
```
