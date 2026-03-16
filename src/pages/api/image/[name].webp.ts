import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const { name } = params; // name ya trae la extensión (ej: mariachi-juarez.webp)
  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  
  const sourceImageUrl = `${blobBaseUrl}/${name}`; 

  try {
    // Usamos el optimizador de Vercel sobre la imagen real del storage
    const vercelOptimizer = `https://fiestasguatemala.com/_vercel/image?url=${encodeURIComponent(sourceImageUrl)}&w=1200&q=80`;
    const response = await fetch(vercelOptimizer);
    
    if (!response.ok) return new Response('Error de optimización', { status: 404 });

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
    return new Response('Error de servidor', { status: 500 });
  }
};