import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages project site under the yifengling0 account.
  // Expose the user-facing site URL on https://yifengling0.github.io/VintagePomeloPro-Compatibility/
  site: 'https://yifengling0.github.io',
  base: '/VintagePomeloPro-Compatibility/',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
