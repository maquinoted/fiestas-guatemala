import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Uso de request.json() para una lectura más limpia
    const data = await request.json().catch(() => ({}));
    const { proveedorId, bannerId, tipo } = data;
    
    if (!tipo) return new Response(JSON.stringify({ error: 'Falta tipo' }), { status: 400 });

    // 2. Normalización de IPs (Vercel manda la IP real aquí)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    // 3. Procesamiento seguro de IDs (Evitamos NaN que rompen el SQL)
    const pId = proveedorId && !isNaN(Number(proveedorId)) ? Number(proveedorId) : null;
    const bId = bannerId && !isNaN(Number(bannerId)) ? Number(bannerId) : null;

    if (pId === null && bId === null) {
      return new Response(JSON.stringify({ error: 'Falta ID de proveedor o banner' }), { status: 400 });
    }

    // 4. VERIFICACIÓN DE DUPLICADOS (Simplificada para que no falle con NULLs)
    // Reducimos a 5 segundos para que tus pruebas sean más fluidas
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND (proveedor_id IS NOT DISTINCT FROM ${pId})
      AND (banner_id IS NOT DISTINCT FROM ${bId})
      AND fecha > NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `;

    if (duplicados.length > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Duplicado ignorado (Anti-spam)' }), { status: 200 });
    }

    // 5. INSERCIÓN LIMPIA
    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, banner_id, tipo_evento, ip_usuario, fecha) 
      VALUES (${pId}, ${bId}, ${tipo}, ${ip}, CURRENT_TIMESTAMP)
    `;

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error Crítico en API Click:', error);
    return new Response(JSON.stringify({ error: 'Error interno guardando clic' }), { status: 500 });
  }
};