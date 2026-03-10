import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { proveedorId, tipo } = await request.json();

    if (!proveedorId) return new Response(null, { status: 400 });

    // Guardamos el click en la base de datos
    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, tipo_evento, fecha) 
      VALUES (${proveedorId}, ${tipo}, CURRENT_TIMESTAMP)
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};