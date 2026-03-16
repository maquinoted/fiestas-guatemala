import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug; 
  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  
  // 🔥 Forzamos la búsqueda del asset que ya optimizamos
  const imageUrl = `${blobBaseUrl}/${slug}.webp`;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      // Si por alguna razón no lo halla como webp, intentamos fallback o error
      return new Response('Imagen no encontrada, mijo.', { status: 404 });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp', // 🔥 WebP como debe ser
        'Cache-Control': 'public, max-age=31536000, immutable', 
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    return new Response('Error interno.', { status: 500 });
  }
};