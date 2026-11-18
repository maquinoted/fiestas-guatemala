import type { APIRoute } from 'astro';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const blobBaseUrl = 'https://epz8axooawqvkjsf.public.blob.vercel-storage.com';
const supportedWidths = new Set([400, 800, 1200]);

export const GET: APIRoute = async ({ params, url }) => {
  const name = params.name;
  if (!name || name.includes('/') || name.includes('\\\\') || name === '.' || name === '..') {
    return new Response('Nombre de imagen no válido', { status: 400 });
  }

  const requestedWidth = Number(url.searchParams.get('w') || 800);
  const width = supportedWidths.has(requestedWidth) ? requestedWidth : 800;
  const requestedQuality = Number(url.searchParams.get('q') || 70);
  const quality = Number.isFinite(requestedQuality) ? Math.max(60, Math.min(80, Math.round(requestedQuality))) : 70;

  try {
    const response = await fetch(`${blobBaseUrl}/${encodeURIComponent(name)}`);
    if (!response.ok) return new Response('No hallé la foto', { status: 404 });

    const original = Buffer.from(await response.arrayBuffer());
    const optimized = await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();

    return new Response(new Uint8Array(optimized), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff'
      },
    });
  } catch (error) {
    console.error('Error optimizando imagen:', error);
    return new Response('Error de servidor', { status: 500 });
  }
};
