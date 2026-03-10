import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite'; // Coincide con tu package.json
import vercel from '@astrojs/vercel';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: vercel(),
  output: 'server', // Esto es vital para la base de datos
});