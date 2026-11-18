import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';
import { hasAdminPermission, isSameOriginRequest, readAdminSessionToken } from '../../lib/admin-auth';

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!isSameOriginRequest(request, url)) {
    return Response.json({ error: 'Solicitud no permitida.' }, { status: 403 });
  }

  const session = await readAdminSessionToken(cookies.get('admin_session')?.value);
  if (!hasAdminPermission(session, 'proveedores')) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let body: { id?: unknown; nuevoEstado?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id < 1 || typeof body.nuevoEstado !== 'boolean') {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  try {
    const { rowCount } = await sql`UPDATE proveedores SET activo = ${body.nuevoEstado} WHERE id = ${id}`;
    if (!rowCount) return Response.json({ error: 'Proveedor no encontrado.' }, { status: 404 });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error cambiando estado del proveedor:', error);
    return Response.json({ error: 'No se pudo actualizar el proveedor.' }, { status: 500 });
  }
};
