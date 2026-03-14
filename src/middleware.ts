import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Identificamos las rutas
  const isSecretArea = context.url.pathname.startsWith('/sys-config-gt');
  const isLoginPage = context.url.pathname === '/sys-config-gt/login';
  
  // 2. Si intenta entrar a la zona secreta...
  if (isSecretArea) {
    // ...pero NO es la página de login (porque si no, nunca podría loguearse)
    if (!isLoginPage) {
      const authCookie = context.cookies.get("claudia_auth")?.value;

      // Si no tiene la cookie de "autorizado", lo mandamos al login de la oficina
      if (authCookie !== "autorizado") {
        return context.redirect("/sys-config-gt/login");
      }
    }
  }

  // Si todo está bien o es una ruta pública (como los mariachis), adelante
  return next();
});