import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Definimos qué ruta queremos proteger
  const isSecretArea = context.url.pathname.startsWith('/sys-config-gt');
  
  // 2. Si es el área secreta, revisamos si tiene la llave (cookie)
  if (isSecretArea) {
    const authCookie = context.cookies.get("claudia_auth")?.value;
    const secretKey = context.url.searchParams.get("key");

    // Lógica de "Entrada Especial": Si entra por URL con ?key=el_pollito_pio
    if (secretKey === "claudia2026") {
      context.cookies.set("claudia_auth", "autorizado", { path: "/", httpOnly: true });
      return next(); // Pasa adelante
    }

    // Si no tiene cookie, ¡para afuera!
    if (authCookie !== "autorizado") {
      return context.redirect("/");
    }
  }

  return next();
});