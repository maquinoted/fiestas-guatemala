import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite'; 
import vercel from '@astrojs/vercel';

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

  // 🔥 LA LLAVE DEL 100: Esto mete el CSS en el HTML y mata la cadena crítica
  build: {
    inlineStylesheets: 'always',
  },

  vite: {
    plugins: [tailwindcss()],
  },
});