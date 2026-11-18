import { sql } from '@vercel/postgres';
import { createHmac } from 'node:crypto';

export const PROVIDER_TERMS_VERSION = '2026-11-18';
let schemaReady: Promise<void> | null = null;

export function ensureProviderApplicationSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS provider_email_codes (
          email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0, last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS provider_applications (
          id BIGSERIAL PRIMARY KEY, contact_email TEXT NOT NULL, email_verified_at TIMESTAMPTZ NOT NULL,
          company_name TEXT NOT NULL, category_slug TEXT NOT NULL, description TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL, instagram_url TEXT NOT NULL DEFAULT '',
          tiktok_url TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', department TEXT NOT NULL,
          municipality TEXT NOT NULL, price_from INTEGER NOT NULL DEFAULT 0, image_url TEXT NOT NULL DEFAULT '',
          terms_version TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'rejected')),
          admin_note TEXT NOT NULL DEFAULT '', reviewed_by BIGINT,
          reviewed_at TIMESTAMPTZ, provider_id BIGINT REFERENCES proveedores(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql` CREATE INDEX IF NOT EXISTS provider_applications_status_created_idx ON provider_applications (status, created_at DESC) `;
      await sql`
        CREATE TABLE IF NOT EXISTS category_slug_redirects (
          old_slug TEXT PRIMARY KEY, new_slug TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 180);
}
export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}
export function normalizeGuatemalaPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('502')) digits = digits.slice(3);
  return digits;
}
export function hmacVerificationCode(email: string, code: string): string {
  const secret = process.env.PROVIDER_EMAIL_CODE_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('Falta configurar PROVIDER_EMAIL_CODE_SECRET en Vercel.');
  return createHmac('sha256', secret).update(email + ':' + code).digest('hex');
}
