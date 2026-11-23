import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Leaf, Shield, Award, Heart, Users, MapPin, Star, Truck, Sparkles, ThumbsUp } from 'lucide-react';
import { useSiteContent } from '@/content/useSiteContent';
import { safeHref } from '@/utils/safeUrl';

// Icon names an admin can pick for a value card; colours cycle in the original order (purely visual).
const VALUE_ICONS = { Leaf, Shield, Award, Heart, Users, MapPin, Star, Truck, Sparkles, ThumbsUp };
const VALUE_COLORS = ['text-green-500 bg-green-50', 'text-blue-500 bg-blue-50', 'text-yellow-500 bg-yellow-50', 'text-red-500 bg-red-50', 'text-purple-500 bg-purple-50', 'text-orange-500 bg-orange-50'];

export default function About() {
  const { block, settings, fill } = useSiteContent();
  const about = block('about');
  const values = (about.values || []).map((v, i) => ({
    ...v, title: fill(v.title), desc: fill(v.desc),
    icon: VALUE_ICONS[v.icon] || Leaf, color: VALUE_COLORS[i % VALUE_COLORS.length],
  }));
  const team = about.team || [];
  const paragraphs = about.missionParagraphs || [];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-brand-green-dark text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 w-64 h-64 bg-brand-orange rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-48 h-48 bg-white rounded-full blur-3xl" />
        </div>
        <div className="container-custom relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <span className="badge bg-white/10 text-green-300 border border-white/20 mb-4">{fill(about.heroBadge)}</span>
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-4">
              {fill(about.heroTitle)}
            </h1>
            <p className="font-accent text-2xl text-brand-orange mb-6">"{settings.tagline}"</p>
            <p className="text-green-200 max-w-2xl mx-auto text-lg leading-relaxed">
              {fill(about.heroText)}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <h2 className="section-title mb-4">
                {fill(about.missionTitle)} <span className="text-gradient">{fill(about.missionHighlight)}</span>
              </h2>
              {paragraphs.map((para, i) => (
                <p key={i} className={`text-gray-600 leading-relaxed ${i === paragraphs.length - 1 ? 'mb-6' : 'mb-4'}`}>
                  {fill(para)}
                </p>
              ))}
              {about.historyButton?.label && (
                <Link to={safeHref(about.historyButton.path, '/history')} className="btn-primary inline-flex items-center gap-2">
                  {fill(about.historyButton.label)}
                </Link>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-brand-green-dark rounded-3xl p-10 text-white text-center">
                <img src="/wah_logo.jpg" alt={settings.siteName} className="h-24 w-auto object-contain mx-auto mb-2" />
                <div className="font-accent text-2xl text-green-300 mb-6">"{settings.tagline}"</div>
                <div className="grid grid-cols-2 gap-4">
                  {(about.stats || []).map((st) => ({ n: fill(st.value), l: fill(st.label) })).map((s) => (
                    <div key={s.l} className="bg-white/10 rounded-2xl p-4">
                      <div className="text-2xl font-heading font-bold text-brand-orange">{s.n}</div>
                      <div className="text-xs text-green-300 mt-1">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-brand-cream spice-pattern-bg">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="section-title">{fill(about.valuesTitle)} <span className="text-gradient">{fill(about.valuesHighlight)}</span></h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="card p-6 text-center hover:-translate-y-2 transition-all"
              >
                <div className={`w-12 h-12 rounded-2xl ${v.color} flex items-center justify-center mx-auto mb-4`}>
                  <v.icon className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-bold text-gray-800 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="section-title">{fill(about.teamTitle)} <span className="text-brand-red">{fill(about.teamHighlight)}</span> {fill(about.teamTitleSuffix)}</h2>
          </motion.div>
          <div className="flex justify-center">
            {team.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card p-8 text-center w-72"
              >
                <img
                  src={member.photo || '/wah_logo.jpg'}
                  alt={member.name}
                  className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-brand-green shadow-brand"
                />
                <h3 className="font-heading font-bold text-gray-800 text-lg">{member.name}</h3>
                <p className="text-sm text-brand-green font-medium mt-1">{member.role}</p>
                <p className="text-xs text-gray-400 mt-1">📍 {member.state}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-brand-green-dark text-white text-center">
        <div className="container-custom">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            {fill(about.ctaTitle)}
          </h2>
          <p className="text-green-300 mb-8 max-w-xl mx-auto">
            {fill(about.ctaText)}
          </p>
          <Link to={safeHref(about.ctaLink, '/products')} className="bg-brand-orange hover:bg-brand-orange-light text-white px-10 py-4 rounded-2xl font-semibold transition-all hover:-translate-y-1">
            {fill(about.ctaButton)}
          </Link>
        </div>
      </section>
    </div>
  );
}
