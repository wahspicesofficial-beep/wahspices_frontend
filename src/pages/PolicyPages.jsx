import { motion } from 'framer-motion';
import { useSiteContent, InlineText } from '@/content/useSiteContent';

function PolicyLayout({ title, emoji, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-16 text-center">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-5xl mb-3">{emoji}</div>
            <h1 className="text-4xl md:text-5xl font-heading font-bold">{title}</h1>
            {lastUpdated && <p className="text-green-300 mt-2 text-sm">Last updated: {lastUpdated}</p>}
          </motion.div>
        </div>
      </div>
      <div className="container-custom py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-card p-8 md:p-12 prose max-w-none"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-heading font-bold text-brand-green-dark mb-3">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

/**
 * Renders one policy page from its website-content block (policy-shipping, policy-return …).
 * Section body: one paragraph per line, "## " starts a sub-heading, **bold** is supported,
 * and {{email}} / {{freeDeliveryAbove}} … are replaced with the live store settings.
 */
function Policy({ contentKey }) {
  const { block, fill } = useSiteContent();
  const page = block(contentKey);
  return (
    <PolicyLayout title={fill(page.title)} emoji={page.emoji} lastUpdated={fill(page.lastUpdated)}>
      {(page.sections || []).map((sec, i) => (
        <Section key={`${i}-${sec.title}`} title={fill(sec.title)}>
          {String(sec.body || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line, j) => (
            line.startsWith('## ')
              ? <h3 key={j} className="font-heading font-bold text-gray-800">{fill(line.slice(3))}</h3>
              : <p key={j}><InlineText text={fill(line)} /></p>
          ))}
        </Section>
      ))}
    </PolicyLayout>
  );
}

export function ShippingPolicy() { return <Policy contentKey="policy-shipping" />; }
export function ReturnPolicy() { return <Policy contentKey="policy-return" />; }
export function PrivacyPolicy() { return <Policy contentKey="policy-privacy" />; }
export function QualityPolicy() { return <Policy contentKey="policy-quality" />; }
export function TermsConditions() { return <Policy contentKey="policy-terms" />; }
