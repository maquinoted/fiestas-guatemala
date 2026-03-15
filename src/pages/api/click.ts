import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json().catch(() => ({}));
    const { proveedorId, tipo } = data;
    
    if (!tipo || !proveedorId) return new Response(null, { status: 400 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const pId = Number(proveedorId);

    // Anti-spam de 5 segundos
    const { rows: duplicados } = await sql`
      SELECT id FROM eventos_proveedores 
      WHERE tipo_evento = ${tipo} 
      AND ip_usuario = ${ip}
      AND proveedor_id = ${pId}
      AND fecha > NOW() - INTERVAL '5 seconds'
      LIMIT 1
    `;

    if (duplicados.length > 0) return new Response(JSON.stringify({ success: true }), { status: 200 });

    await sql`
      INSERT INTO eventos_proveedores (proveedor_id, tipo_evento, ip_usuario, fecha) 
      VALUES (${pId}, ${tipo}, ${ip}, CURRENT_TIMESTAMP)
    `;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error API:', error);
    return new Response(null, { status: 500 });
  }
};