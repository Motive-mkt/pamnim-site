/**
 * Session-long "free call offer" countdown.
 *
 * The deadline is stored in sessionStorage, so it keeps counting across page navigation within the
 * same tab/session and starts fresh for a new session (new tab or returning visitor). If
 * sessionStorage is unavailable (private mode, blocked storage) the module falls back to memory, which
 * still survives in-app navigation.
 *
 * This is only a framing device. Nothing here ever disables or delays the contact form.
 */

const STORAGE_KEY = 'pamnim_offer_deadline';
export const OFFER_DURATION_MS = 10 * 60 * 1000;

let memoryDeadline: number | null = null;
const listeners = new Set<() => void>();

function isValid(deadline: number | null): deadline is number {
  // Reject anything that cannot be a deadline we set (garbage, or further away than one full offer)
  return deadline !== null && Number.isFinite(deadline) && deadline - Date.now() <= OFFER_DURATION_MS;
}

function read(): number | null {
  if (typeof window === 'undefined') return memoryDeadline;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const stored = raw ? Number(raw) : NaN;
    if (isValid(stored)) return stored;
  } catch {
    // storage blocked: fall through to memory
  }
  return isValid(memoryDeadline) ? memoryDeadline : null;
}

function write(deadline: number) {
  memoryDeadline = deadline;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(deadline));
  } catch {
    // memory fallback already set
  }
}

/** Returns this session's deadline, starting the 10 minutes now if the session has none yet. */
export function getOfferDeadline(): number {
  const existing = read();
  if (existing !== null) return existing;
  const deadline = Date.now() + OFFER_DURATION_MS;
  write(deadline);
  return deadline;
}

/** Call once at app start so the clock begins on the visitor's first page, wherever they land. */
export function startOfferTimer(): void {
  getOfferDeadline();
}

/** Restarts the countdown at a full 10:00 and tells every listener. */
export function resetOffer(): void {
  write(Date.now() + OFFER_DURATION_MS);
  listeners.forEach((listener) => listener());
}

export function subscribeToOffer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
