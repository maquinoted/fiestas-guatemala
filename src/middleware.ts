import { defineMiddleware } from 'astro:middleware';
import { hasAdminPermission, readAdminSessionToken } from './lib/admin-auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const inAdmin = path === '/sys-config-gt' || path.startsWith('/sys-config-gt/');
  if (!inAdmin) return next();

  // El acceso, cierre de sesión y página informativa no requieren permisos previos.
  if (path === '/sys-config-gt/login' || path === '/sys-config-gt/logout') return next();

  const session = await readAdminSessionToken(context.cookies.get('admin_session')?.value);
  if (!session) return context.redirect('/sys-config-gt/login');

  let requiredPermission:
    | 'proveedores'
    | 'categorias'
    | 'dashboard'
    | 'usuarios'
    | 'roles'
    | undefined;

  if (
    path === '/sys-config-gt' ||
    path === '/sys-config-gt/' ||
    path.startsWith('/sys-config-gt/proveedores') ||
    path.startsWith('/sys-config-gt/nuevoProveedor') ||
    path.startsWith('/sys-config-gt/editar/')
  ) {
    requiredPermission = 'proveedores';
  } else if (
    path.startsWith('/sys-config-gt/categorias') ||
    path.startsWith('/sys-config-gt/nuevaCategoria') ||
    path.startsWith('/sys-config-gt/editar-categoria/')
  ) {
    requiredPermission = 'categorias';
  } else if (path.startsWith('/sys-config-gt/dashboard')) {
    requiredPermission = 'dashboard';
  } else if (path.startsWith('/sys-config-gt/usuarios')) {
    requiredPermission = 'usuarios';
  } else if (path.startsWith('/sys-config-gt/roles')) {
    requiredPermission = 'roles';
  } else if (path === '/sys-config-gt/sin-permiso') {
    // Página de acceso denegado disponible para cualquier sesión autenticada.
  } else {
    // Las rutas administrativas nuevas deben declarar su permiso antes de habilitarse.
    return context.redirect('/sys-config-gt/sin-permiso');
  }

  if (requiredPermission && !hasAdminPermission(session, requiredPermission)) {
    return context.redirect('/sys-config-gt/sin-permiso');
  }

  return next();
});
