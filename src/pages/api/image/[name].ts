import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name) return new Response('Falta nombre', { status: 400 });

  const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
  const sourceImageUrl = `${blobBaseUrl}/${name}`; 

  try {
    const response = await fetch(sourceImageUrl);
    if (!response.ok) return new Response('No hallé la foto', { status: 404 });

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/webp';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (e) {
    return new Response('Error de servidor', { status: 500 });
  }
};