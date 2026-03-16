import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name) return new Response('Falta nombre', { status: 400 });

  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  // 🔥 Intentamos traer el .webp que ya convertiste
  const imageUrl = `${blobBaseUrl}/${name}.webp`; 

  try {
    const response = await fetch(imageUrl);
    
    // Si el .webp falla, intentamos traer el .png original como fallback
    if (!response.ok) {
      const fallbackResponse = await fetch(`${blobBaseUrl}/${name}.png`);
      if (!fallbackResponse.ok) return new Response('No hallé nada mijo', { status: 404 });
      
      const buffer = await fallbackResponse.arrayBuffer();
      return new Response(buffer, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' }
      });
    }

    const buffer = await response.arrayBuffer();
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