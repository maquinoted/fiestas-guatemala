import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/serverless"; // <-- Esto es lo nuevo

export default defineConfig({
  output: 'server', // <-- Esto asegura que sea SSR
  adapter: vercel(), // <-- Y esto conecta con Vercel
  integrations: [tailwind()],
});