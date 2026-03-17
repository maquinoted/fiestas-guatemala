import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';

export const POST: APIRoute = async ({ request }) => {
  const { id, nuevoEstado } = await request.json();

  try {
    await sql`UPDATE proveedores SET activo = ${nuevoEstado} WHERE id = ${id}`;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e }), { status: 500 });
  }
};