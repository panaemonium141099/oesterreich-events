import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Tests laufen in UTC wie der Prod-Server und CI. Auf einem Rechner in
// Österreich wären Zeitzonen-Fehler (Formatierung ohne timeZone) sonst
// unsichtbar: lokal grün, auf der Seite zwei Stunden daneben.
process.env.TZ = 'UTC';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // fn-31.10: lasstreffen.de nutzt seine eigene PLZ-Ort-Tabelle (vor '@', damit es greift).
      ...(process.env.SITE_COUNTRY === 'DE'
        ? { '@/lib/utils/plz-ort-slugs.site': path.resolve(__dirname, './src/lib/utils/plz-ort-slugs.site.de.ts') }
        : {}),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
      ],
    },
  },
});
