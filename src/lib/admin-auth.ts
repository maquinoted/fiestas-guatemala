import { sql } from '@vercel/postgres';
import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24;

export const ADMIN_PERMISSIONS = [
  'proveedores',
  'categorias',
  'dashboard',
  'usuarios',
  'roles',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminSession = {
  userId: number | null;
  roleId: number;
  roleName: string;
  displayName: string;
  username: string;
  permissions: AdminPermission[];
  isMaster: boolean;
};

type SessionPayload = {
  sub: number | null;
  roleId: number;
  exp: number;
};

let schemaReady: Promise<void> | null = null;

export function ensureAdminSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS admin_roles (
          id BIGSERIAL PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          nombre TEXT NOT NULL,
          descripcion TEXT NOT NULL DEFAULT '',
          permisos JSONB NOT NULL DEFAULT '[]'::jsonb,
          activo BOOLEAN NOT NULL DEFAULT TRUE,
          sistema BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id BIGSERIAL PRIMARY KEY,
          nombre TEXT NOT NULL,
          usuario TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
          activo BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        INSERT INTO admin_roles (slug, nombre, descripcion, permisos, sistema)
        VALUES
          ('administrador', 'Administrador', 'Acceso completo al panel.', ${JSON.stringify(ADMIN_PERMISSIONS)}::jsonb, TRUE),
          ('editor', 'Editor de contenido', 'Gestiona proveedores y categorías.', ${JSON.stringify(['proveedores', 'categorias'])}::jsonb, FALSE)
        ON CONFLICT (slug) DO NOTHING
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS || '';
}

export function createAdminSessionToken(userId: number | null, roleId: number): string {
  const secret = sessionSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET o ADMIN_PASS no está configurado.');

  const payload: SessionPayload = {
    sub: userId,
    roleId,
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function permissionsFromDatabase(value: unknown): AdminPermission[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((permission): permission is AdminPermission =>
    ADMIN_PERMISSIONS.includes(permission as AdminPermission),
  );
}

export async function readAdminSessionToken(token?: string): Promise<AdminSession | null> {
  if (!token) return null;
  const [encoded, providedSignature, extra] = token.split('.');
  const secret = sessionSecret();
  if (!encoded || !providedSignature || extra || !secret) return null;

  const expected = createHmac('sha256', secret).update(encoded).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
  if (!Number.isInteger(payload.roleId) || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
    return null;
  }

  await ensureAdminSchema();

  if (payload.sub === null) {
    const { rows } = await sql`
      SELECT id, nombre, permisos, activo
      FROM admin_roles
      WHERE id = ${payload.roleId}
      LIMIT 1
    `;
    const role = rows[0];
    if (!role?.activo) return null;
    return {
      userId: null,
      roleId: Number(role.id),
      roleName: role.nombre,
      displayName: 'Cuenta maestra',
      username: process.env.ADMIN_USER || 'admin',
      permissions: permissionsFromDatabase(role.permisos),
      isMaster: true,
    };
  }

  if (!Number.isInteger(payload.sub) || payload.sub <= 0) return null;
  const { rows } = await sql`
    SELECT u.id, u.nombre, u.usuario, u.activo,
           r.id AS role_id, r.nombre AS role_name, r.permisos, r.activo AS role_active
    FROM admin_users u
    INNER JOIN admin_roles r ON r.id = u.role_id
    WHERE u.id = ${payload.sub}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user?.activo || !user.role_active) return null;
  return {
    userId: Number(user.id),
    roleId: Number(user.role_id),
    roleName: user.role_name,
    displayName: user.nombre,
    username: user.usuario,
    permissions: permissionsFromDatabase(user.permisos),
    isMaster: false,
  };
}

export function hasAdminPermission(
  session: AdminSession | null,
  permission: AdminPermission,
): boolean {
  return !!session && (session.isMaster || session.permissions.includes(permission));
}

export function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`);
    });
  });
}

export function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
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
