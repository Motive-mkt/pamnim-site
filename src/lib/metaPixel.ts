/**
 * Meta Pixel + Conversions API helpers.
 *
 * The base pixel is loaded in index.html. Every conversion event is sent twice with the same
 * event_id: once from the browser pixel and once through /api/meta-capi (server-to-server),
 * and Meta de-duplicates the pair. The server copy survives ad blockers and iOS privacy
 * restrictions and carries hashed phone/email for better ad matching.
 *
 * Everything here is fire-and-forget: tracking must never throw or block the UI, and staff /
 * client-portal screens must never be tracked (they would inflate PageViews and pollute ad
 * audiences with our own team and clients).
 */

// Routes that are not part of the public marketing site.
// Keep in sync with the inline check in index.html.
const INTERNAL_PREFIXES = [
  '/admin',
  '/dashboard',
  '/login',
  '/signup',
  '/signup-worker',
  '/client-setup',
  '/activate',
  '/client-portal',
  '/tracker',
  '/review',
  '/reviews'
];

export function isInternalPath(pathname: string): boolean {
  return INTERNAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type PixelCall = ['track' | 'trackCustom', string, Record<string, any>?, { eventID: string }?];

function fbq(...args: PixelCall) {
  try {
    const f = typeof window !== 'undefined' ? (window as any).fbq : undefined;
    if (typeof f === 'function') f(...args);
  } catch {
    // tracking must never break the page
  }
}

function readCookie(name: string): string | undefined {
  try {
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  } catch {
    return undefined;
  }
}

function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface TrackedUser {
  phone?: string;
  email?: string;
  name?: string;
}

/** Sends one event to the server-side relay. keepalive lets it finish even if the tab closes. */
function sendToServer(
  eventName: string,
  eventId: string,
  customData: Record<string, any>,
  user?: TrackedUser
) {
  try {
    fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventName,
        eventId,
        eventSourceUrl: window.location.href,
        customData,
        user: {
          ...user,
          fbp: readCookie('_fbp'),
          fbc: readCookie('_fbc')
        }
      })
    }).catch(() => {
      // best effort only
    });
  } catch {
    // best effort only
  }
}

/** Fires an event from the browser and the server with a shared id. */
function track(
  kind: 'track' | 'trackCustom',
  eventName: string,
  eventId: string,
  data: Record<string, any>,
  user?: TrackedUser
) {
  fbq(kind, eventName, data, { eventID: eventId });
  sendToServer(eventName, eventId, data, user);
}

export function trackPageView(pathname: string) {
  if (isInternalPath(pathname)) return;
  fbq('track', 'PageView');
}

/**
 * Fired once per saved lead. Every lead is a standard `Lead`; leads from people who own or
 * lease the space (priority 'high') also fire a custom `QualifiedLead` so ads can be
 * optimised toward real projects instead of "just exploring" enquiries.
 * Free-text fields such as the address are deliberately not sent to Meta. Phone, email and
 * name are only ever sent to the server relay, which hashes them before forwarding.
 */
export function trackLead(params: {
  contentName: string;
  leadTag?: string;
  priority?: 'high' | 'medium' | 'low';
  source?: string;
  user?: TrackedUser;
}) {
  const data: Record<string, any> = { content_name: params.contentName };
  if (params.leadTag) data.lead_tag = params.leadTag;
  if (params.priority) data.lead_priority = params.priority;
  if (params.source) data.source = params.source;

  const id = newEventId();
  track('track', 'Lead', id, data, params.user);
  if (params.priority === 'high') track('trackCustom', 'QualifiedLead', `${id}-q`, data, params.user);
}

/** Fired when a visitor taps a WhatsApp or call link on the public site. */
export function trackContactClick(channel: 'whatsapp' | 'phone', pathname: string) {
  if (isInternalPath(pathname)) return;
  track('track', 'Contact', newEventId(), { contact_channel: channel, placement: pathname });
}
