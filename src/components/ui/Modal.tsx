import { ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that titles the dialog, for screen readers */
  labelledBy?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Disable closing on backdrop click (e.g. while a request is in flight) */
  dismissable?: boolean;
  className?: string;
  children: ReactNode;
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl'
};

/**
 * Shared dialog shell: backdrop, Escape to close, scroll lock, focus return and a panel
 * that scrolls inside the viewport so its header is never cut off at the top.
 */
export default function Modal({
  open,
  onClose,
  labelledBy,
  size = 'md',
  dismissable = true,
  className,
  children
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);

    // Move focus into the dialog
    const t = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button') ||
        panelRef.current;
      target?.focus({ preventScroll: true });
    }, 30);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, dismissable, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissable ? onClose : undefined}
            className="absolute inset-0 bg-charcoal/55"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain',
              'rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl focus:outline-none',
              SIZES[size],
              className
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
