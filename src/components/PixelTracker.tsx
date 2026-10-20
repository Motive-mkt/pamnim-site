import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, trackContactClick } from '../lib/metaPixel';

/**
 * Drives Meta Pixel for the single-page app:
 * - PageView on every public route change (the base snippet in index.html handles the very
 *   first load and turns off Meta's automatic history tracking, so nothing fires twice).
 * - Contact event whenever a visitor taps any WhatsApp or tel: link on the public site, using
 *   one delegated listener so every current and future link is covered.
 * Renders nothing.
 */
export default function PixelTracker() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // index.html already tracked the initial load
    }
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      const path = window.location.pathname;

      if (href.startsWith('tel:')) {
        trackContactClick('phone', path);
      } else if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\b/i.test(href)) {
        trackContactClick('whatsapp', path);
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
