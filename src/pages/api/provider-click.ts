import type { APIRoute } from 'astro';
import { isSameOriginRequest } from '../../lib/admin-auth';
import { recordProviderEvent } from '../../lib/provider-metrics';

const actions = new Set(['view', 'whatsapp', 'call', 'instagram', 'tiktok']);
export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!isSameOriginRequest(request, url)) return new Response(null, { status: 403 });
  const payload = await request.json().catch(() => null);
  const providerId = Number(payload?.providerId);
  const action = payload?.action;
  if (!Number.isSafeInteger(providerId) || providerId < 1 || !actions.has(action)) {
    return new Response(null, { status: 400 });
  }
  const visitor = cookies.get('fg_visitor')?.value;
  if (!visitor || !/^[a-f0-9-]{36}$/i.test(visitor)) return new Response(null, { status: 204 });
  try {
    await recordProviderEvent(providerId, `browser:${visitor}`, action);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('No se pudo guardar la métrica:', error);
    return new Response(null, { status: 503 });
  }
};
