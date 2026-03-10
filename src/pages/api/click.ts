import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { proveedorId, tipo } = await request.json();

    if (!proveedorId) return new Response(null, { status: 400 });

    // Guardamos el click en la base de datos
    await sql`
      INSERT INTO metricas_leads (proveedor_id, tipo_click) 
      VALUES (${proveedorId}, ${tipo || 'whatsapp'})
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(null, { status: 500 });
  }
};