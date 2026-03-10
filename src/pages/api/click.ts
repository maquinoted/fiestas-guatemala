import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    let data;
    const rawBody = await request.text();
    
    if (!rawBody) return new Response(null, { status: 400 });

    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { proveedorId, bannerId, tipo } = data;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    if (!proveedorId && !bannerId) {
      return new Response(JSON.stringify({ error: 'Falta ID' }), { status: 400 });
    }

    const pId = proveedorId ? parseInt(proveedorId) : null;
    const bId = bannerId ? parseInt(bannerId) : null;

    // VERIFICACIÓN DE DUPLICADOS (REDUCIDO A 10 SEGUNDOS)
    // Esto permite que tus pruebas funcionen casi de inmediato
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND (proveedor_id = ${pId} OR (proveedor_id IS NULL AND ${pId} IS NULL))
      AND (banner_id = ${bId} OR (banner_id IS NULL AND ${bId} IS NULL))
      AND fecha > NOW() - INTERVAL '10 seconds'
      LIMIT 1
    `;

    if (duplicados.length > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Wait 10s' }), { status: 200 });
    }

    // INSERCIÓN
    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, banner_id, tipo_evento, ip_usuario, fecha) 
      VALUES (${pId}, ${bId}, ${tipo}, ${ip}, CURRENT_TIMESTAMP)
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error Crítico en API Click:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};