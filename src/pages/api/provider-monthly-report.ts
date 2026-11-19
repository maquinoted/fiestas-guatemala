import type { APIRoute } from 'astro';
import { createHash, timingSafeEqual } from 'node:crypto';
import { sql } from '@vercel/postgres';
import { Resend } from 'resend';
import { ensureProviderApplicationSchema } from '../../lib/provider-applications';
import { ensureProviderMetrics } from '../../lib/provider-metrics';
import { ensureMonthlyReports } from '../../lib/provider-reports';

export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from('Bearer ' + secret);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response(null, { status: 401 });
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  const year = Number(today.find(part => part.type === 'year')?.value);
  const month = Number(today.find(part => part.type === 'month')?.value);
  const day = Number(today.find(part => part.type === 'day')?.value);
  const sendDay = Math.min(30, new Date(Date.UTC(year, month, 0)).getUTCDate());
  if (day < sendDay) return new Response(null, { status: 204 });

  const monthKey = `${year}-${String(month).padStart(2, '0')}-01`;
  const cutoff = new Date(Date.UTC(year, month - 1, sendDay, 14));
  const cutoffText = new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala', dateStyle: 'long', timeStyle: 'short',
  }).format(cutoff);
  const period = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', month: 'long', year: 'numeric' }).format(cutoff);
  await Promise.all([ensureProviderApplicationSchema(), ensureProviderMetrics(), ensureMonthlyReports()]);
  const { rows: providers } = await sql`
    SELECT p.id, p.nombre, p.telefono, p.whatsapp, p.instagram_url, p.tiktok_url,
      COALESCE(NULLIF(TRIM(app.contact_email), ''), NULLIF(TRIM(p.email), '')) AS email,
      COUNT(e.action) FILTER (WHERE e.action = 'view')::int AS views,
      COUNT(e.action) FILTER (WHERE e.action = 'whatsapp')::int AS wa,
      COUNT(e.action) FILTER (WHERE e.action = 'call')::int AS calls,
      COUNT(e.action) FILTER (WHERE e.action = 'instagram')::int AS ig,
      COUNT(e.action) FILTER (WHERE e.action = 'tiktok')::int AS tt
    FROM proveedores p
    LEFT JOIN LATERAL (
      SELECT contact_email FROM provider_applications
      WHERE provider_id = p.id AND status = 'approved' ORDER BY reviewed_at DESC NULLS LAST, id DESC LIMIT 1
    ) app ON TRUE
    LEFT JOIN provider_daily_events e ON e.provider_id = p.id AND e.day >= ${monthKey}::date AND e.created_at < ${cutoff.toISOString()}::timestamptz
    LEFT JOIN provider_monthly_reports r ON r.provider_id = p.id AND r.month = ${monthKey}::date
    WHERE p.activo = TRUE AND r.provider_id IS NULL
    GROUP BY p.id, app.contact_email ORDER BY p.id
  `;
  for (const provider of providers) {
    const lines = [
      `Estimado equipo de ${provider.nombre}:`,
      '',
      `En ${period}, tu ficha en FiestasGuatemala.com recibió ${provider.views} visitas únicas por día.`,
    ];
    if (provider.whatsapp || provider.telefono) lines.push(`• WhatsApp: ${provider.wa} clics.`);
    if (provider.telefono) lines.push(`• Llamar: ${provider.calls} clics.`);
    if (provider.instagram_url) lines.push(`• Instagram: ${provider.ig} clics.`);
    if (provider.tiktok_url) lines.push(`• TikTok: ${provider.tt} clics.`);
    lines.push('', `Datos al ${cutoffText}, hora de Guatemala.`, '', 'Equipo de FiestasGuatemala.com');
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.email || '') ? provider.email : null;
    await sql`
      INSERT INTO provider_monthly_reports (provider_id, month, cutoff, body, recipient)
      VALUES (${provider.id}, ${monthKey}::date, ${cutoff.toISOString()}, ${lines.join('\n')}, ${email})
      ON CONFLICT DO NOTHING
    `;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return Response.json({ reports: providers.length, sent: 0, email: 'unconfigured' }, { status: 503 });
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || 'Fiestas Guatemala <contacto@fiestasguatemala.com>';
  const { rows: pending } = await sql`
    SELECT r.provider_id, r.body, r.recipient, p.nombre FROM provider_monthly_reports r
    JOIN proveedores p ON p.id = r.provider_id AND p.activo = TRUE
    WHERE r.month = ${monthKey}::date AND r.recipient IS NOT NULL AND r.sent_at IS NULL
    ORDER BY r.provider_id
  `;
  let sent = 0;
  for (let index = 0; index < pending.length; index += 100) {
    const batch = pending.slice(index, index + 100);
    const batchKey = createHash('sha256').update(batch.map(report => report.provider_id).join(',')).digest('hex');
    const result = await resend.batch.send(batch.map(report => ({
      from, to: report.recipient,
      subject: `Así le fue a ${report.nombre} en FiestasGuatemala.com en ${period}`,
      text: report.body,
    })), { idempotencyKey: `fixture-report-${monthKey}-${batchKey}` });
    if (result.error) {
      console.error('Resend rechazó el lote de reportes:', result.error.message);
      continue;
    }
    const ids = batch.map(report => Number(report.provider_id));
    await sql`
      UPDATE provider_monthly_reports SET sent_at = NOW()
      WHERE month = ${monthKey}::date AND provider_id IN (SELECT CAST(value AS BIGINT) FROM json_array_elements_text(${JSON.stringify(ids)}::json))
    `;
    sent += batch.length;
  }
  return Response.json({ reports: providers.length, sent, pending: pending.length - sent });
};
