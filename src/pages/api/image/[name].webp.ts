import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const { name } = params; // Aquí viene el nombre sin la extensión .webp
  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  
  // 1. Intentamos la ruta del WebP (Lo que Sharp genera ahora)
  const webpUrl = `${blobBaseUrl}/${name}.webp`;
  // 2. Fallback a PNG (Para tus registros viejos)
  const pngUrl = `${blobBaseUrl}/${name}.png`;

  try {
    let response = await fetch(webpUrl);
    
    // Si no hay webp, probamos con el png original
    if (!response.ok) {
      response = await fetch(pngUrl);
    }

    if (!response.ok) return new Response('Imagen no encontrada mijo', { status: 404 });

    // 🔥 Pasamos el asset por el optimizador de Vercel para asegurar peso pluma
    const vercelOptimizer = `https://fiestasguatemala.com/_vercel/image?url=${encodeURIComponent(response.url)}&w=1200&q=80`;
    const optimizedRes = await fetch(vercelOptimizer);
    
    const buffer = await optimizedRes.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (e) {
    return new Response('Error de red', { status: 500 });
  }
};