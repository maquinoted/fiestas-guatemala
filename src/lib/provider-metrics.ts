import { sql } from '@vercel/postgres';

let schema: Promise<void> | undefined;
export function ensureProviderMetrics() {
  return schema ??= sql`
    CREATE TABLE IF NOT EXISTS provider_daily_events (
      provider_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      visitor_key TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('view', 'whatsapp', 'call', 'instagram', 'tiktok', 'favorite')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider_id, day, visitor_key, action)
    )
  `.then(() => undefined).catch((error) => { schema = undefined; throw error; });
}

export async function recordProviderEvent(providerId: number, visitor: string, action: string) {
  await ensureProviderMetrics();
  await sql`
    INSERT INTO provider_daily_events (provider_id, day, visitor_key, action)
    SELECT id, (NOW() AT TIME ZONE 'America/Guatemala')::date, ${visitor}, ${action}
    FROM proveedores WHERE id = ${providerId} AND activo = TRUE
    ON CONFLICT DO NOTHING
  `;
}

export async function recordFavorite(providerId: number, customerId: number) {
  try {
    await recordProviderEvent(providerId, `account:${customerId}`, 'favorite');
  } catch (error) {
    console.error('No se pudo registrar el favorito en métricas:', error);
  }
}
