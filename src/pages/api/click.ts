import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    let data;
    const contentType = request.headers.get('content-type');

    // Intentamos leer el JSON de forma segura según el Content-Type
    if (contentType?.includes('application/json')) {
      data = await request.json();
    } else {
      // Si viene de sendBeacon o keepalive con texto plano, lo parseamos manualmente
      const text = await request.text();
      if (!text) return new Response(null, { status: 400 });
      data = JSON.parse(text);
    }

    const { proveedorId, bannerId, tipo } = data;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    if (!proveedorId && !bannerId) {
      return new Response(JSON.stringify({ error: 'Falta ID' }), { status: 400 });
    }

    const pId = proveedorId ? parseInt(proveedorId) : null;
    const bId = bannerId ? parseInt(bannerId) : null;

    // VERIFICACIÓN DE DUPLICADOS (1 hora)
    // Simplificamos la consulta para que Postgres no se confunda con los NULLs
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND (
        (proveedor_id IS NULL AND ${pId}::integer IS NULL) OR (proveedor_id = ${pId}::integer)
      )
      AND (
        (banner_id IS NULL AND ${bId}::integer IS NULL) OR (banner_id = ${bId}::integer)
      )
      AND fecha > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `;

    if (duplicados.length > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Rate limited' }), { status: 200 });
    }

    // INSERCIÓN
    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, banner_id, tipo_evento, ip_usuario, fecha) 
      VALUES (${pId}, ${bId}, ${tipo}, ${ip}, CURRENT_TIMESTAMP)
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error en API Click:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};