import { sql } from '@vercel/postgres';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { put } from '@vercel/blob';
import sharp from 'sharp';

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
          municipality TEXT NOT NULL, price_from INTEGER NOT NULL DEFAULT 0, image_url TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL DEFAULT '',
          terms_version TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'rejected')),
          admin_note TEXT NOT NULL DEFAULT '', reviewed_by BIGINT,
          reviewed_at TIMESTAMPTZ, provider_id BIGINT REFERENCES proveedores(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE provider_applications ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS provider_applications_account_email_unique ON provider_applications (contact_email) WHERE password_hash <> ''`;
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

let providerDetailsSchemaReady: Promise<void> | null = null;

export function ensureProviderDetailsSchema(): Promise<void> {
  if (!providerDetailsSchemaReady) {
    providerDetailsSchemaReady = (async () => {
      await sql`ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS eventos_atendidos TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS capacidad_eventos TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS servicios_incluidos TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS instalaciones TEXT NOT NULL DEFAULT ''`;
      await sql`UPDATE proveedores SET descripcion = RTRIM(LEFT(descripcion, GREATEST(1, 500 - STRPOS(REVERSE(LEFT(descripcion, 500)), ' ')))) WHERE LENGTH(COALESCE(descripcion, '')) > 500`;
    })().catch((error) => { providerDetailsSchemaReady = null; throw error; });
  }
  return providerDetailsSchemaReady;
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
function providerEmailCodeSecret(): string {
  return process.env.PROVIDER_EMAIL_CODE_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS || '';
}
export function hmacVerificationCode(email: string, code: string): string {
  const secret = providerEmailCodeSecret();
  if (!secret) throw new Error('Falta configurar PROVIDER_EMAIL_CODE_SECRET en Vercel.');
  return createHmac('sha256', secret).update(email + ':' + code).digest('hex');
}

export const PROVIDER_EMAIL_PENDING_COOKIE = 'provider_email_pending';
export const PROVIDER_EMAIL_VERIFIED_COOKIE = 'provider_email_verified';

export function createProviderEmailToken(email: string, maxAgeSeconds: number): string {
  const secret = providerEmailCodeSecret();
  if (!secret) throw new Error('Falta configurar la llave de verificación de correo.');
  const payload = Buffer.from(JSON.stringify({
    email: normalizeEmail(email),
    exp: Date.now() + maxAgeSeconds * 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + signature;
}

export function readProviderEmailToken(token?: string): string | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  const secret = providerEmailCodeSecret();
  if (!payload || !signature || extra || !secret) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(session.email) ||
        !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return normalizeEmail(session.email);
  } catch {
    return null;
  }
}



export const PROVIDER_SESSION_COOKIE = 'provider_session';
export const PROVIDER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const PROVIDER_IMAGE_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const PROVIDER_IMAGE_MAX_OUTPUT_BYTES = 450 * 1024;

function providerSessionSecret(): string {
  return process.env.PROVIDER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS || '';
}

export function createProviderSessionToken(applicationId: number): string {
  const secret = providerSessionSecret();
  if (!secret) throw new Error('Falta configurar la llave de sesión del sitio.');
  const payload = Buffer.from(JSON.stringify({
    sub: applicationId,
    exp: Date.now() + PROVIDER_SESSION_MAX_AGE * 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + signature;
}

export function readProviderSessionToken(token?: string): number | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  const secret = providerSessionSecret();
  if (!payload || !signature || extra || !secret) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(session.sub) || session.sub < 1 || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session.sub as number;
  } catch {
    return null;
  }
}

export function hashProviderPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve('scrypt$' + salt.toString('base64url') + '$' + derivedKey.toString('base64url'));
    });
  });
}

export function verifyProviderPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, saltText, hashText] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return Promise.resolve(false);
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(hashText, 'base64url');
  if (!salt.length || !expected.length) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, expected.length, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected));
    });
  });
}

export async function uploadProviderImage(file: File, slug: string): Promise<string> {
  if (!file || file.size <= 0) throw new Error('Selecciona una imagen para el perfil.');
  if (file.size > PROVIDER_IMAGE_MAX_INPUT_BYTES) throw new Error('La foto original debe pesar 8 MB o menos.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Sube una imagen JPG, PNG o WebP.');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('El almacenamiento de imágenes no está configurado.');

  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width < 600 || metadata.height < 600) {
    throw new Error('La foto debe tener al menos 600 × 600 píxeles.');
  }
  if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) throw new Error('El archivo no es una imagen JPG, PNG o WebP válida.');

  let quality = 78;
  let optimized = await sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize(800, 800, { fit: 'cover', position: 'attention' }).webp({ quality, effort: 5 }).toBuffer();
  while (optimized.byteLength > PROVIDER_IMAGE_MAX_OUTPUT_BYTES && quality > 54) {
    quality -= 8;
    optimized = await sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize(800, 800, { fit: 'cover', position: 'attention' }).webp({ quality, effort: 5 }).toBuffer();
  }
  if (optimized.byteLength > PROVIDER_IMAGE_MAX_OUTPUT_BYTES) throw new Error('La foto no se pudo comprimir al tamaño permitido. Prueba con otra imagen.');
  const fileName = 'proveedor-' + (normalizeSlug(slug) || 'perfil') + '-' + Date.now() + '-' + randomBytes(5).toString('hex') + '.webp';
  const uploaded = await put(fileName, optimized, {
    access: 'public',
    contentType: 'image/webp',
    token,
  });
  return uploaded.url;
}
