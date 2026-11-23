import { useEffect } from 'react';

export default function AdminModal({ onClose, children, className = '' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ${className}`}
      onClick={onClose}
    >
      {children}
    </div>
  );
}
