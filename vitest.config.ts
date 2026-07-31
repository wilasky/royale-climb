import { defineConfig } from 'vitest/config'

// Config separada de vite.config.ts a propósito: los tests son solo
// sobre src/game/* (lógica pura, sin React), así no hace falta tocar
// la configuración de build de la app para añadir Vitest.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/game/**/*.test.ts'],
  },
})
