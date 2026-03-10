import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite'; 
import vercel from '@astrojs/vercel/serverless'; // Cambiado a serverless para mayor estabilidad con Postgres

export default defineConfig({
  // 'server' fuerza a que TODAS las páginas sean dinámicas a menos que digas lo contrario
  output: 'server', 
  
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    // Esto asegura que las funciones de Vercel tengan acceso a la base de datos de Postgres
    functionPerRoute: false, 
  }),

  vite: {
    plugins: [tailwindcss()],
  },
});