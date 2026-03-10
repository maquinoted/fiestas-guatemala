import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { proveedorId, tipo } = await request.json();
    
    // Obtenemos la IP (Vercel la pasa en los headers)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!proveedorId) return new Response(null, { status: 400 });

    // VERIFICACIÓN: ¿Existe un clic igual en la última hora?
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE proveedor_id = ${proveedorId} 
      AND tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND fecha > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `;

    // Si ya existe, respondemos éxito pero NO insertamos nada
    if (duplicados.length > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Rate limited' }), { status: 200 });
    }

    // Si es nuevo, insertamos
    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, tipo_evento, ip_usuario, fecha) 
      VALUES (${proveedorId}, ${tipo}, ${ip}, CURRENT_TIMESTAMP)
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};