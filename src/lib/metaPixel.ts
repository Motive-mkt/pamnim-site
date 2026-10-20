/**
 * Meta Pixel helpers.
 *
 * The base pixel is loaded in index.html. Everything here is a safe wrapper: tracking must
 * never throw or block the UI, and staff / client-portal screens must never be tracked
 * (they would inflate PageViews and pollute ad audiences with our own team and clients).
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

function fbq(...args: any[]) {
  try {
    const f = typeof window !== 'undefined' ? (window as any).fbq : undefined;
    if (typeof f === 'function') f(...args);
  } catch {
    // tracking must never break the page
  }
}

export function trackPageView(pathname: string) {
  if (isInternalPath(pathname)) return;
  fbq('track', 'PageView');
}

/**
 * Fired once per saved lead. Every lead is a standard `Lead`; leads from people who own or
 * lease the space (priority 'high') also fire a custom `QualifiedLead` so ads can be
 * optimised toward real projects instead of "just exploring" enquiries.
 * Free-text fields such as the address are deliberately not sent to Meta.
 */
export function trackLead(params: {
  contentName: string;
  leadTag?: string;
  priority?: 'high' | 'medium' | 'low';
  source?: string;
}) {
  const data: Record<string, any> = { content_name: params.contentName };
  if (params.leadTag) data.lead_tag = params.leadTag;
  if (params.priority) data.lead_priority = params.priority;
  if (params.source) data.source = params.source;

  fbq('track', 'Lead', data);
  if (params.priority === 'high') fbq('trackCustom', 'QualifiedLead', data);
}

/** Fired when a visitor taps a WhatsApp or call link on the public site. */
export function trackContactClick(channel: 'whatsapp' | 'phone', pathname: string) {
  if (isInternalPath(pathname)) return;
  fbq('track', 'Contact', { contact_channel: channel, placement: pathname });
}
