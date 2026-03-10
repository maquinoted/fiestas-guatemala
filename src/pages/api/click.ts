import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { proveedorId, bannerId, tipo } = await request.json();
    
    // Obtenemos la IP de forma segura en Vercel
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    // Validamos que venga al menos un ID
    if (!proveedorId && !bannerId) {
      return new Response(JSON.stringify({ error: 'Falta ID de referencia' }), { status: 400 });
    }

    // VERIFICACIÓN DE DUPLICADOS (Rate Limit de 1 hora por IP)
    // Usamos NULLIF para que la comparación sea exacta con los valores de la DB
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND (
        (proveedor_id IS NULL AND ${proveedorId || null} IS NULL) OR (proveedor_id = ${proveedorId || null})
      )
      AND (
        (banner_id IS NULL AND ${bannerId || null} IS NULL) OR (banner_id = ${bannerId || null})
      )
      AND fecha > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `;

    if (duplicados.length > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Rate limited' }), { status: 200 });
    }

    // INSERCIÓN DE EVENTO (Funciona para: vista_perfil, click_whatsapp, click_llamada, click_banner)
    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, banner_id, tipo_evento, ip_usuario, fecha) 
      VALUES (
        ${proveedorId ? parseInt(proveedorId) : null}, 
        ${bannerId ? parseInt(bannerId) : null}, 
        ${tipo}, 
        ${ip}, 
        CURRENT_TIMESTAMP
      )
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error en API Click:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};