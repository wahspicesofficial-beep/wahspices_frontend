import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Instagram, Youtube, Twitter, Linkedin, MessageCircle, Link2 } from 'lucide-react';
import { useSiteContent, isInternal } from '@/content/useSiteContent';
import { safeHref } from '@/utils/safeUrl';

// Social platform → icon (unknown platforms fall back to a generic link icon)
const SOCIAL_ICONS = { facebook: Facebook, instagram: Instagram, youtube: Youtube, twitter: Twitter, x: Twitter, linkedin: Linkedin, whatsapp: MessageCircle };

export default function Footer() {
  const { block, settings, fill } = useSiteContent();
  const footer = block('footer');
  const socials = (block('social').items || []).filter((s) => s.enabled !== false);
  const columns = Array.isArray(footer.columns) ? footer.columns : [];

  return (
    <footer className="bg-brand-green-dark text-white">
      {/* Main Footer — brand col + 4 link cols = 6-col grid */}
      <div className="container-custom py-14">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-6">

          {/* ── Brand Column (spans 2 cols on lg) ── */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            {/* Logo */}
            <div className="mb-3">
              <img
                src="/wah_logo.jpg"
                alt="Wah Spices"
                className="h-20 w-auto object-contain bg-white rounded-xl p-1"
              />
            </div>

            <p className="text-brand-orange text-base font-body italic mb-4">
              "{settings.tagline}"
            </p>

            <p className="text-green-200 text-sm font-body leading-relaxed mb-5">
              {fill(footer.description)}
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(footer.badges || []).map((badge) => (
                <span
                  key={badge}
                  className="text-xs bg-white/10 border border-white/20 px-2.5 py-1 rounded-full text-green-100 font-body"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-200 font-body">
                <Phone className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>{settings.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-200 font-body">
                <Mail className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>{settings.email}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-green-200 font-body">
                <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </div>
            </div>
          </div>

          {/* ── 4 Link Columns — each takes 1 col on lg ── */}
          {columns.map(({ title, links }) => (
            <div key={title} className="col-span-1">
              <h3 className="font-body font-bold text-white mb-4 text-sm uppercase tracking-wider">
                {title}
              </h3>
              <ul className="space-y-2.5">
                {(links || []).map((link) => (
                  <li key={`${link.label}${link.path}`}>
                    {isInternal(link.path) ? (
                      <Link
                        to={link.path}
                        className="text-sm text-green-300 hover:text-brand-orange transition-colors font-body leading-snug block"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={safeHref(link.path)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-green-300 hover:text-brand-orange transition-colors font-body leading-snug block"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container-custom py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-green-400 font-body text-center sm:text-left">
            {fill(footer.copyright)}{settings.fssai ? ` | FSSAI Lic. No. ${settings.fssai}` : ''}{settings.udyamNumber ? ` | Udyam Reg. No. ${settings.udyamNumber}` : ''}
          </p>

          <div className="flex items-center gap-3">
            {socials.map(({ platform: label, url }) => ({ label, url, Icon: SOCIAL_ICONS[String(label || '').toLowerCase()] || Link2 })).map(({ label, url, Icon }) => (
              <a
                key={label}
                href={safeHref(url)}
                {...(url ? { target: '_blank', rel: 'noreferrer' } : {})}
                aria-label={label}
                className="w-9 h-9 bg-white/10 hover:bg-brand-orange rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
