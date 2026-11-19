import { sql } from '@vercel/postgres';

let schema: Promise<void> | undefined;
export function ensureProviderPlans() {
  return schema ??= (async () => {
    await sql`
      DO $migration$
      BEGIN
        PERFORM pg_advisory_xact_lock(127030413);
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'proveedores' AND column_name = 'plan_created_at'
        ) THEN
          ALTER TABLE proveedores ADD COLUMN plan_created_at TIMESTAMPTZ,
            ADD COLUMN plan_trial_started_at TIMESTAMPTZ,
            ADD COLUMN plan_paid_until TIMESTAMPTZ;
          ALTER TABLE proveedores ALTER COLUMN plan_created_at SET DEFAULT NOW();
          UPDATE proveedores SET plan_trial_started_at = NOW() WHERE activo = TRUE;
        END IF;
        CREATE TABLE IF NOT EXISTS provider_inquiries (
          id BIGSERIAL PRIMARY KEY,
          provider_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
          sender_name TEXT NOT NULL, sender_email TEXT NOT NULL, message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      END;
      $migration$;
    `;
    await sql`
      CREATE OR REPLACE FUNCTION fiestas_provider_trial_start() RETURNS trigger
      LANGUAGE plpgsql AS $trial$
      BEGIN
        IF NEW.activo AND NEW.plan_trial_started_at IS NULL THEN
          NEW.plan_trial_started_at := NOW();
        END IF;
        RETURN NEW;
      END;
      $trial$;
    `;
    await sql`
      DO $trigger$
      BEGIN
        PERFORM pg_advisory_xact_lock(127030413);
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fiestas_provider_trial_start' AND tgrelid = 'proveedores'::regclass) THEN
          CREATE TRIGGER fiestas_provider_trial_start BEFORE INSERT OR UPDATE OF activo ON proveedores
          FOR EACH ROW EXECUTE FUNCTION fiestas_provider_trial_start();
        END IF;
      END;
      $trigger$;
    `;
  })().catch((error) => { schema = undefined; throw error; });
}

export async function getProviderPlan(id: number) {
  await ensureProviderPlans();
  const { rows } = await sql`
    SELECT plan_created_at, plan_trial_started_at, plan_paid_until,
      plan_trial_started_at + INTERVAL '6 months' AS trial_ends_at,
      COALESCE(plan_paid_until > NOW(), FALSE) AS paid,
      COALESCE(plan_trial_started_at + INTERVAL '6 months' > NOW(), FALSE) AS trial
    FROM proveedores WHERE id = ${id}
  `;
  const row = rows[0];
  return { ...row, direct: Boolean(row?.paid || row?.trial), status: row?.paid ? 'Anual · Q600' : row?.trial ? 'Prueba de 6 meses' : 'Ficha gratuita' };
}

export function formatPlanDate(value: string | Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' }) : 'Sin registro';
}
