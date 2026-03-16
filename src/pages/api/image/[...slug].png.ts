import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  
  // Reconstruimos la URL original de Vercel Blob basada en el slug
  // OJO: Asegurate de usar la URL base correcta de tu Blob Storage
  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  const imageUrl = `${blobBaseUrl}/${slug}.png`;

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return new Response('Imagen no encontrada mijo.', { status: 404 });
    }

    // Retornamos la imagen con los headers correctos
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        // Opcional: Caché para mejorar rendimiento
        'Cache-Control': 'public, max-age=31536000, immutable', 
      },
    });
  } catch (error) {
    console.error('Error sirviendo imagen:', error);
    return new Response('Error interno mijo.', { status: 500 });
  }
};