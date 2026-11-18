import type { APIRoute } from 'astro';
import { sql } from '@vercel/postgres';
import { isSameOriginRequest } from '../../lib/admin-auth';

const supportedActions = ['instagram', 'tiktok', 'whatsapp', 'favorite', 'call'] as const;
type ProviderAction = (typeof supportedActions)[number];

let schemaReady: Promise<void> | null = null;

function ensureProviderClickSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS provider_click_events (
        id BIGSERIAL PRIMARY KEY,
        provider_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('instagram', 'tiktok', 'whatsapp', 'favorite', 'call')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export const POST: APIRoute = async ({ request, url }) => {
  if (!isSameOriginRequest(request, url)) return new Response(null, { status: 403 });

  try {
    const payload = await request.json();
    const providerId = Number(payload?.providerId);
    const action = payload?.action as ProviderAction;

    if (!Number.isSafeInteger(providerId) || providerId < 1 || !supportedActions.includes(action)) {
      return new Response(null, { status: 400 });
    }

    await ensureProviderClickSchema();
    await sql`
      INSERT INTO provider_click_events (provider_id, action)
      SELECT id, ${action}
      FROM proveedores
      WHERE id = ${providerId} AND activo = TRUE
    `;
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('No se pudo registrar el clic del proveedor:', error);
    return new Response(null, { status: 204 });
  }
};
