import { Fragment, useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import { DEFAULT_BLOCKS, DEFAULT_SETTINGS } from '@/content/siteDefaults';

/**
 * Website content + public store settings in one place.
 *   const { settings, block, fill, tel, mailto } = useSiteContent();
 *   block('footer').columns, settings.phone, fill('Orders above ₹{{freeDeliveryAbove}}')
 * Until GET /api/site-content answers (or if it fails) everything falls back to the
 * exact text the site shipped with, so the UI never breaks or flashes empty.
 */
export function useSiteContent() {
  const { settings: apiSettings, blocks: apiBlocks, testimonials, status } = useAppSelector((s) => s.siteContent);

  return useMemo(() => {
    // Settings: a blank value from the API never wipes the shipped default (one source of truth = SiteSettings).
    const settings = { ...DEFAULT_SETTINGS };
    if (apiSettings) {
      Object.entries(apiSettings).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') settings[k] = v;
      });
    }

    const vars = { ...settings, year: String(new Date().getFullYear()) };
    const fill = (text) => (typeof text === 'string'
      ? text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => (vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : m))
      : text);

    // Each block is shallow-merged over its default, so a field added later still has a value.
    const block = (key) => {
      const def = DEFAULT_BLOCKS[key] || {};
      const live = apiBlocks?.[key];
      return live && typeof live === 'object' ? { ...def, ...live } : def;
    };

    return {
      loaded: status === 'ready',
      status,
      settings,
      block,
      fill,
      tel: (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`,
      mailto: (email) => `mailto:${email || ''}`,
      featuredTestimonials: Array.isArray(testimonials) ? testimonials : [],
    };
  }, [apiSettings, apiBlocks, testimonials, status]);
}

/** Inline text with **bold** support (used for policy pages). Placeholders must be filled first. */
export function InlineText({ text }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4
    ? <strong key={i}>{p.slice(2, -2)}</strong>
    : <Fragment key={i}>{p}</Fragment>));
}

/** Is this an internal site path (react-router Link) rather than an external URL? */
export const isInternal = (path) => typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
