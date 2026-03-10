import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Leemos el cuerpo como texto para procesar JSON manualmente
    // Esto evita errores cuando se usa navigator.sendBeacon o fetch con keepalive
    const bodyText = await request.text();
    if (!bodyText) return new Response(null, { status: 400 });
    
    const { proveedorId, bannerId, tipo } = JSON.parse(bodyText);
    
    // Obtenemos la IP real en Vercel
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    if (!proveedorId && !bannerId) {
      return new Response(JSON.stringify({ error: 'Falta ID' }), { status: 400 });
    }

    // Convertimos IDs a número para evitar problemas de tipos en Postgres
    const pId = proveedorId ? parseInt(proveedorId) : null;
    const bId = bannerId ? parseInt(bannerId) : null;

    // VERIFICACIÓN DE DUPLICADOS (Evita inflar métricas si refrescan la página)
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND (
        (proveedor_id IS NULL AND ${pId} IS NULL) OR (proveedor_id = ${pId})
      )
      AND (
        (banner_id IS NULL AND ${bId} IS NULL) OR (banner_id = ${bId})
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