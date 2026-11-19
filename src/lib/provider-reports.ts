import { sql } from '@vercel/postgres';

let schema: Promise<void> | undefined;
export function ensureMonthlyReports() {
  return schema ??= sql`
    CREATE TABLE IF NOT EXISTS provider_monthly_reports (
      provider_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
      month DATE NOT NULL,
      cutoff TIMESTAMPTZ NOT NULL,
      body TEXT NOT NULL,
      recipient TEXT,
      sent_at TIMESTAMPTZ,
      PRIMARY KEY (provider_id, month)
    )
  `.then(() => undefined).catch((error) => { schema = undefined; throw error; });
}
