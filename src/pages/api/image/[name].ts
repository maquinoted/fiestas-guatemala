import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const { name } = params;
  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  
  // 🔥 CORRECCIÓN CRÍTICA: Quitamos el ".png" hardcodeado.
  // El "name" ahora traerá el nombre completo con su extensión original (mariachi_juarez.jpg).
  const sourceImageUrl = `${blobBaseUrl}/${name}`; 

  // Usamos el optimizador de Vercel para transformar y comprimir el asset original
  const vercelOptimizer = `https://fiestasguatemala.com/_vercel/image?url=${encodeURIComponent(sourceImageUrl)}&w=1200&q=80`;

  try {
    const response = await fetch(vercelOptimizer);
    
    if (!response.ok) return new Response('Error optimizando asset mijo', { status: 500 });

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp', // Siempre entregamos WebP real
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (e) {
    return new Response('Error de red', { status: 500 });
  }
};