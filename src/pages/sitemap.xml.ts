import { sql } from '@vercel/postgres';

export async function GET() {
  // 1. Consultamos categorías y SOLO proveedores activos
  const { rows: categorias } = await sql`SELECT slug FROM categorias`;
  const { rows: proveedores } = await sql`SELECT slug, categoria_slug FROM proveedores WHERE activo = true`;

  const siteBase = 'https://fiestasguatemala.com';

  // 2. Construimos el cuerpo del XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteBase}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  ${categorias.map(cat => `
  <url>
    <loc>${siteBase}/${cat.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}

  ${proveedores.map(p => `
  <url>
    <loc>${siteBase}/${p.categoria_slug}/${p.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('')}
</urlset>`.trim();

  // 3. 🔥 FIX CRÍTICO: Bajamos el caché a 0 para que veas los cambios YA
  return new Response(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    }
  });
}