import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Renders its children on <body>, outside every page container. A `position: fixed` overlay that
// lives inside a scrolling/clipping/transformed ancestor (a table wrapper, an animated card, a
// dashboard panel) can end up clipped or laid out inline; on <body> it always covers the screen.
export default function ModalPortal({ children, lockScroll = true }: { children: ReactNode; lockScroll?: boolean }) {
  useEffect(() => {
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lockScroll]);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
