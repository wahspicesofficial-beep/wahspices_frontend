import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { imageSrc, resolveLink, typeChipClass } from './notificationUtils';

/**
 * Modal-style card for one broadcast (offer / sale / new product …): image, title, text, optional button, close.
 * Accessible: role="dialog" + aria-modal, labelled by the title, focus moves in and is trapped, Esc / backdrop /
 * × close it, focus returns to where it was. Animations only when the user hasn't asked for reduced motion.
 */
export default function BroadcastBanner({ item, onClose, onAction }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const link = resolveLink(item.buttonUrl);
  const titleId = `broadcast-title-${item.id}`;
  const descId = `broadcast-desc-${item.id}`;

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [item.id, onClose]);

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/55 p-4 motion-safe:animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="broadcast-banner"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={item.message ? descId : undefined}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl motion-safe:animate-scale-in max-h-[90vh] flex flex-col"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-md hover:bg-white hover:text-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
        >
          <X className="h-5 w-5" />
        </button>

        {item.imageUrl && (
          <div className="bg-brand-cream">
            <img src={imageSrc(item.imageUrl)} alt="" className="block max-h-72 w-full object-cover" />
          </div>
        )}

        <div className="overflow-y-auto p-6 font-body">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${typeChipClass(item.type)}`}>
            {item.typeLabel || item.type}
          </span>
          <h2 id={titleId} className="mt-3 pr-8 font-heading text-xl font-bold leading-snug text-brand-green-dark">{item.title}</h2>
          {item.message && (
            <p id={descId} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{item.message}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {link && item.buttonLabel && (
              <button type="button" onClick={() => onAction(link)} className="btn-primary">
                {item.buttonLabel}
              </button>
            )}
            <button type="button" onClick={onClose} className={link && item.buttonLabel ? 'btn-ghost' : 'btn-primary'}>
              {link && item.buttonLabel ? 'Maybe later' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
