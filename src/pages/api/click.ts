import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { proveedorId, bannerId, tipo } = await request.json();
    
    // Obtenemos la IP (Vercel la pasa en los headers)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Validamos que venga al menos uno de los dos IDs
    if (!proveedorId && !bannerId) {
      return new Response(JSON.stringify({ error: 'Falta ID de referencia' }), { status: 400 });
    }

    // VERIFICACIÓN: ¿Existe un evento igual (misma IP, mismo tipo, misma referencia) en la última hora?
    // Usamos COALESCE para manejar los nulos en la comparación de IDs
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND COALESCE(proveedor_id, 0) = ${proveedorId || 0}
      AND COALESCE(banner_id, 0) = ${bannerId || 0}
      AND fecha > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `;

    // Si ya existe, respondemos éxito (para no dar error en consola) pero NO insertamos nada
    if (duplicados.length > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Rate limited' }), { status: 200 });
    }

    // Si es nuevo, insertamos con los campos correspondientes
    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, banner_id, tipo_evento, ip_usuario, fecha) 
      VALUES (${proveedorId || null}, ${bannerId || null}, ${tipo}, ${ip}, CURRENT_TIMESTAMP)
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error en API Click:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};