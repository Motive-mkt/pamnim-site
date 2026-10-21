/**
 * Meta Conversions API relay (Vercel serverless function, POST /api/meta-capi).
 *
 * The browser pixel loses events to ad blockers, iOS privacy settings and closed tabs.
 * The site sends the same event here too, with a shared event_id so Meta de-duplicates the
 * pair, and this function forwards it server-to-server with hashed customer details.
 *
 * Environment variables (Vercel project settings):
 *   META_CAPI_ACCESS_TOKEN  required. Events Manager > Data sources > pixel > Settings >
 *                           Conversions API > Generate access token. If it is missing the
 *                           function does nothing (202) and the browser pixel keeps working.
 *   META_PIXEL_ID           optional, defaults to the site pixel.
 *   META_TEST_EVENT_CODE    optional. Set it to see events under "Test events" in Events
 *                           Manager, and remove it afterwards.
 *   META_GRAPH_VERSION      optional, defaults to v24.0.
 */
import { createHash } from 'node:crypto';

const DEFAULT_PIXEL_ID = '26632441953100460';
const DEFAULT_GRAPH_VERSION = 'v24.0';

// Only these events can be relayed, so the endpoint cannot be used to push arbitrary data.
const ALLOWED_EVENTS = new Set(['Lead', 'QualifiedLead', 'Contact']);

const ALLOWED_HOSTS = new Set([
  'pamniminteriors.com',
  'www.pamniminteriors.com',
  'pamnim-site.vercel.app',
  'pamnim-site-motive-mkts-projects.vercel.app'
]);

function hostAllowed(host: string): boolean {
  return ALLOWED_HOSTS.has(host) || host.endsWith('-motive-mkts-projects.vercel.app');
}

function hostOf(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Kenyan numbers: 0712 345 678, 712345678, +254 712 345 678 all become 254712345678. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9) digits = `254${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!email.includes('@') || email.endsWith('@provided.local')) return null;
  return email.length <= 200 ? email : null;
}

function cleanString(value: unknown, max = 200): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

/** Only primitive custom data is forwarded (no nested objects, no free-text addresses). */
function cleanCustomData(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 15)) {
    if (!/^[a-z_]{1,40}$/.test(key)) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 200);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export function buildUserData(user: any, ip: string | undefined, userAgent: string | undefined) {
  const data: Record<string, any> = { country: [sha256('ke')] };

  const phone = normalizePhone(user?.phone);
  if (phone) data.ph = [sha256(phone)];

  const email = normalizeEmail(user?.email);
  if (email) data.em = [sha256(email)];

  const name = cleanString(user?.name)?.toLowerCase().replace(/[^\p{L}\s'-]/gu, '');
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts[0]) data.fn = [sha256(parts[0])];
    if (parts.length > 1) data.ln = [sha256(parts[parts.length - 1])];
  }

  // Browser identifiers Meta uses for matching. They must be sent unhashed.
  const fbp = cleanString(user?.fbp, 100);
  const fbc = cleanString(user?.fbc, 200);
  if (fbp && /^fb\.\d\.\d+\.\d+$/.test(fbp)) data.fbp = fbp;
  if (fbc && /^fb\.\d\.\d+\.[\w-]+$/.test(fbc)) data.fbc = fbc;

  if (ip) data.client_ip_address = ip;
  if (userAgent) data.client_user_agent = userAgent.slice(0, 500);
  return data;
}

function readBody(req: any): any {
  const body = req.body;
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return typeof body === 'object' ? body : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // Same-site requests only. Browsers always send Origin on a cross-origin POST, and the site
  // posts from its own origin, so anything else is rejected.
  const originHost = hostOf(req.headers?.origin) || hostOf(req.headers?.referer);
  if (!originHost || !hostAllowed(originHost)) {
    return res.status(403).json({ ok: false, error: 'forbidden_origin' });
  }

  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) {
    // Not configured yet: succeed quietly so the website is never affected.
    return res.status(202).json({ ok: true, skipped: 'not_configured' });
  }

  const body = readBody(req);
  const eventName = cleanString(body?.eventName, 50);
  const eventId = cleanString(body?.eventId, 120);
  if (!eventName || !ALLOWED_EVENTS.has(eventName) || !eventId) {
    return res.status(400).json({ ok: false, error: 'invalid_event' });
  }

  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || undefined;
  const userAgent = cleanString(req.headers?.['user-agent'], 500);

  const sourceHost = hostOf(body?.eventSourceUrl);
  const sourceUrl =
    sourceHost && hostAllowed(sourceHost) ? String(body.eventSourceUrl).slice(0, 500) : `https://${originHost}/`;

  const payload: Record<string, any> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: sourceUrl,
        action_source: 'website',
        user_data: buildUserData(body?.user, ip, userAgent),
        custom_data: cleanCustomData(body?.customData)
      }
    ]
  };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const pixelId = process.env.META_PIXEL_ID || DEFAULT_PIXEL_ID;
  const version = process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
  const url = `https://graph.facebook.com/${version}/${pixelId}/events`;

  try {
    // Token goes in the Authorization header, not the URL, so it never lands in logs.
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const result: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Meta CAPI rejected event', response.status, result?.error?.message || result);
      return res.status(502).json({ ok: false, error: 'meta_rejected' });
    }
    return res.status(200).json({ ok: true, events_received: result?.events_received ?? 1 });
  } catch (err: any) {
    console.error('Meta CAPI request failed', err?.message || err);
    return res.status(502).json({ ok: false, error: 'meta_unreachable' });
  }
}
