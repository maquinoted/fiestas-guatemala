import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite'; 
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  // 'server' fuerza a que TODAS las páginas sean dinámicas
  output: 'server', 
  
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    // Asegura acceso estable a Postgres
    functionPerRoute: false, 
  }),

  // AGREGAMOS ESTO PARA SOLUCIONAR EL ERROR DEL LOGIN
  security: {
    checkOrigin: false,
  },

  vite: {
    plugins: [tailwindcss()],
  },
});