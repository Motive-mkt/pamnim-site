import { useEffect, useState } from 'react';
import { getOfferDeadline, resetOffer, subscribeToOffer } from '../lib/offerTimer';

/**
 * Remaining time on the session's free-call offer.
 * Always derived from the stored deadline and the real clock, so it stays correct when the tab was in
 * the background or the visitor navigated away and back.
 */
export function useOfferCountdown() {
  const [deadline, setDeadline] = useState(() => getOfferDeadline());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    return subscribeToOffer(() => {
      setDeadline(getOfferDeadline());
      setNow(Date.now());
    });
  }, []);

  useEffect(() => {
    const sync = () => setNow(Date.now());
    sync();
    if (Date.now() >= deadline) return;

    const interval = window.setInterval(() => {
      sync();
      if (Date.now() >= deadline) window.clearInterval(interval);
    }, 1000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [deadline]);

  const remainingMs = Math.max(0, deadline - now);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return {
    expired: remainingMs === 0,
    label: `${minutes}:${seconds}`,
    reset: resetOffer
  };
}
