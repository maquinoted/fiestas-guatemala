import { sql } from '@vercel/postgres';
import {
  createProviderSessionToken,
  hashProviderPassword,
  normalizeEmail,
  readProviderSessionToken,
  verifyProviderPassword,
} from './provider-applications';

export const CUSTOMER_SESSION_COOKIE = 'customer_session';
export const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

let schemaReady: Promise<void> | null = null;

export function ensureCustomerAccountSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS customer_accounts (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS customer_favorites (
          id BIGSERIAL PRIMARY KEY,
          customer_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
          provider_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(customer_id, provider_id)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS customer_provider_contacts (
          id BIGSERIAL PRIMARY KEY,
          customer_id BIGINT NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
          provider_id BIGINT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
          contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(customer_id, provider_id)
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export function normalizeCustomerEmail(value: string): string {
  return normalizeEmail(value);
}

export {
  createProviderSessionToken as createCustomerSessionToken,
  hashProviderPassword as hashCustomerPassword,
  readProviderSessionToken as readCustomerSessionToken,
  verifyProviderPassword as verifyCustomerPassword,
};
