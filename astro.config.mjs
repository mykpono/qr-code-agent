// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// The 11 launch locales. EN is default and lives at the root (no prefix).
// Localized routes are wired but only emitted once translated content exists
// (avoids shipping thin/duplicate localized pages — see SEO-BRIEF §6, §8).
export const LOCALES = ['en', 'es', 'pt-br', 'de', 'fr', 'it', 'ja', 'id', 'uk', 'pl', 'ru'];

// https://astro.build
export default defineConfig({
  site: 'https://qrcodeagent.net',
  integrations: [react()],
  i18n: {
    defaultLocale: 'en',
    locales: LOCALES,
    routing: { prefixDefaultLocale: false },
  },
  build: { format: 'directory' },
});
