import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Parseo rápido de datos
    const data = await request.json().catch(() => ({}));
    const { proveedorId, tipo } = data;
    
    // 2. Validación inmediata
    if (!tipo || !proveedorId) return new Response(null, { status: 400 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const pId = Number(proveedorId);

    // 3. 🔥 LA MAGIA: Tarea en segundo plano (Background Task)
    // No usamos 'await' aquí. Dejamos que la promesa se ejecute sola
    // mientras nosotros ya le respondimos al navegador.
    (async () => {
      try {
        // Anti-spam de 5 segundos
        const { rows: duplicados } = await sql`
          SELECT id FROM eventos_proveedores 
          WHERE tipo_evento = ${tipo} 
          AND ip_usuario = ${ip}
          AND proveedor_id = ${pId}
          AND fecha > NOW() - INTERVAL '5 seconds'
          LIMIT 1
        `;

        if (duplicados.length === 0) {
          await sql`
            INSERT INTO eventos_proveedores (proveedor_id, tipo_evento, ip_usuario, fecha) 
            VALUES (${pId}, ${tipo}, ${ip}, CURRENT_TIMESTAMP)
          `;
        }
      } catch (dbError) {
        console.error('Error de DB en segundo plano:', dbError);
      }
    })();

    // 4. RESPUESTA INSTANTÁNEA
    // El navegador recibe esto en milisegundos y libera la red.
    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error Crítico API:', error);
    return new Response(null, { status: 500 });
  }
};