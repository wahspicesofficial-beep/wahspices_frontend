import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteContent, isInternal } from '@/content/useSiteContent';
import { safeHref } from '@/utils/safeUrl';

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-body font-medium text-gray-800 pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-brand-green flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          className="px-5 pb-4 bg-brand-green/5 text-sm text-gray-600 leading-relaxed"
        >
          {a}
        </motion.div>
      )}
    </div>
  );
}

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const { block, fill } = useSiteContent();
  const help = block('help');
  // FAQ text may reference store settings ({{email}}, {{freeDeliveryAbove}} …) — fill them in once.
  const faqs = (help.faqs || []).map((f) => ({
    category: f.category,
    questions: (f.questions || []).map((x) => ({ q: fill(x.q), a: fill(x.a) })),
  }));

  const allCategories = ['all', ...faqs.map((f) => f.category)];

  const filteredFaqs = faqs.filter((f) => {
    if (activeCategory !== 'all' && f.category !== activeCategory) return false;
    if (!searchQuery) return true;
    return f.questions.some(
      (q) =>
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Header */}
      <div className="bg-brand-green-dark text-white py-16 text-center">
        <div className="container-custom max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-3">{fill(help.title)}</h1>
            <p className="text-green-300 mb-8">{fill(help.subtitle)}</p>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={help.searchPlaceholder}
                className="w-full pl-12 pr-4 py-4 rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-orange font-body text-base"
              />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container-custom py-12 max-w-4xl">
        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {(help.quickLinks || []).map((link) => (isInternal(link.path) ? (
            <Link key={link.label} to={link.path} className="card p-5 text-center hover:-translate-y-1 transition-all">
              <div className="text-3xl mb-2">{link.icon}</div>
              <div className="text-sm font-medium text-gray-700">{link.label}</div>
            </Link>
          ) : (
            <a key={link.label} href={safeHref(link.path)} target="_blank" rel="noreferrer" className="card p-5 text-center hover:-translate-y-1 transition-all">
              <div className="text-3xl mb-2">{link.icon}</div>
              <div className="text-sm font-medium text-gray-700">{link.label}</div>
            </a>
          )))}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-6">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all capitalize ${
                activeCategory === cat
                  ? 'bg-brand-green text-white shadow-brand'
                  : 'bg-white text-gray-600 hover:bg-brand-green/10 border border-gray-200'
              }`}
            >
              {cat === 'all' ? 'All Topics' : cat}
            </button>
          ))}
        </div>

        {/* FAQs */}
        {filteredFaqs.map((section) => (
          <div key={section.category} className="mb-8">
            <h2 className="font-heading font-bold text-xl text-brand-green-dark mb-4">
              {section.category}
            </h2>
            <div className="space-y-3">
              {section.questions.map((faq) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        <div className="mt-12 text-center bg-brand-green-dark text-white rounded-3xl p-10">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="font-heading font-bold text-2xl mb-2">{fill(help.ctaTitle)}</h2>
          <p className="text-green-300 mb-6">{fill(help.ctaText)}</p>
          <Link to={safeHref(help.ctaLink, '/contact')} className="bg-brand-orange hover:bg-brand-orange-light text-white px-8 py-3 rounded-xl font-semibold transition-colors">
            {fill(help.ctaButton)}
          </Link>
        </div>
      </div>
    </div>
  );
}
