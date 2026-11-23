import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchSiteContent } from '@/store/slices/siteContentSlice';
import { useSiteContent } from '@/content/useSiteContent';

/** Full-page maintenance screen in the site's own look (cream background, green brand, logo). */
function MaintenanceScreen() {
  const { block, fill, settings, tel, mailto } = useSiteContent();
  const m = block('maintenance');
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="card p-10 md:p-12 text-center max-w-lg w-full">
        <img src="/wah_logo.jpg" alt={settings.siteName} className="h-24 w-auto object-contain mx-auto mb-6" />
        <div className="text-5xl mb-4">🌶️</div>
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-brand-green-dark mb-3">{fill(m.title)}</h1>
        <p className="text-gray-500 font-body leading-relaxed mb-4">{fill(m.message)}</p>
        {m.note && <p className="text-sm text-gray-400 font-body mb-6">{fill(m.note)}</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {settings.phone && <a href={tel(settings.phone)} className="btn-primary">📞 {settings.phone}</a>}
          {settings.email && <a href={mailto(settings.email)} className="btn-outline">{settings.email}</a>}
        </div>
        <p className="font-accent text-xl text-brand-orange mt-8">&quot;{settings.tagline}&quot;</p>
      </div>
    </div>
  );
}

/**
 * Wraps the public (customer) layout: loads website content once and, when the store is in
 * maintenance mode, shows the maintenance screen instead of the pages. Admins who are signed in
 * (admin token present) still see the site so they can check it, with a small notice bar.
 */
export default function SiteContentGate({ children }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.siteContent.status);
  const { settings } = useSiteContent();

  useEffect(() => {
    if (status === 'idle') dispatch(fetchSiteContent());
  }, [dispatch, status]);

  if (settings.maintenanceMode) {
    let isAdmin = false;
    try { isAdmin = !!localStorage.getItem('wah_admin_session'); } catch { isAdmin = false; }
    if (!isAdmin) return <MaintenanceScreen />;
    return (
      <>
        <div className="bg-brand-red text-white text-xs text-center py-1.5 font-body">
          Maintenance mode is ON — customers see the maintenance page. You are seeing the site because you are signed in as admin.
        </div>
        {children}
      </>
    );
  }
  return children;
}
