import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const { name } = params;
  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  
  // 🔥 LA MAGIA: Usamos el optimizador de Vercel para transformar el PNG de 2MB
  // Esto lo convierte a WebP real, reduce el peso y cambia el tamaño a 1200px
  const vercelOptimizer = `https://fiestasguatemala.com/_vercel/image?url=${encodeURIComponent(blobBaseUrl + '/' + name + '.png')}&w=1200&q=80`;

  try {
    const response = await fetch(vercelOptimizer);
    
    if (!response.ok) return new Response('Error optimizando', { status: 500 });

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp', // Ahora sí son bytes de WebP
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (e) {
    return new Response('Error de red', { status: 500 });
  }
};