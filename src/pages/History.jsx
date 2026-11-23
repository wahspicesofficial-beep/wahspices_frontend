import { motion } from 'framer-motion';
{/* static content - no skeleton needed */}

const timeline = [
  {
    year: 'The Beginning',
    title: 'A Small Grocery Shop',
    desc: 'Our journey began with a small grocery shop started by our father and uncle. That humble shop laid the foundation of everything we stand for today — quality, trust, and a passion for authentic flavours.',
    emoji: '🏪',
  },
  {
    year: '2017',
    title: 'Expanding the Business',
    desc: 'In 2017, we expanded the shop and grew the business further. New products, new customers, and a stronger vision — the family\'s hard work started paying off and the business took a new direction.',
    emoji: '🌿',
  },
  {
    year: '2020',
    title: 'Stepping into Wholesale',
    desc: 'In 2020, we stepped into the world of wholesale trade. Our reach grew beyond a single shop and we started operating at a much larger scale — a major milestone in our journey.',
    emoji: '🚚',
  },
  {
    year: '2026',
    title: 'Wah Spices — Yash Hingrajiya',
    desc: 'Today, I — Yash Hingrajiya — am carrying this proud legacy forward. Building on the foundation laid by my father and uncle, I am now bringing premium quality spices across the country under the name Wah Spices. This is not just a business — it is our family\'s heritage.',
    emoji: '🌶️',
  },
];

export default function History() {
  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-16 text-center">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-3">Our History</h1>
            <p className="text-green-300 text-lg">A family's hard work, a dream's journey</p>
          </motion.div>
        </div>
      </div>

      <div className="container-custom py-16 max-w-4xl">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-brand-green/20 -translate-x-1/2 hidden md:block" />

          <div className="space-y-8">
            {timeline.map((item, i) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className={`flex items-start gap-6 md:gap-0 ${
                  i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Content */}
                <div className={`flex-1 ${i % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                  <div className="card p-6 hover:-translate-y-1 transition-all">
                    <div className={`flex items-center gap-3 mb-3 ${i % 2 === 0 ? 'md:justify-end' : ''}`}>
                      <span className="text-2xl">{item.emoji}</span>
                      <span className="text-brand-green font-heading font-bold text-2xl">{item.year}</span>
                    </div>
                    <h3 className="font-heading font-bold text-gray-800 text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>

                {/* Center dot */}
                <div className="hidden md:flex w-12 flex-shrink-0 items-center justify-center relative z-10">
                  <div className="w-5 h-5 bg-brand-green rounded-full border-4 border-white shadow-brand" />
                </div>

                {/* Spacer for alternating */}
                <div className="hidden md:block flex-1" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Future */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="bg-brand-green-dark text-white rounded-3xl p-10">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-3xl font-heading font-bold mb-3">The Journey Continues...</h2>
            <p className="text-green-300 max-w-xl mx-auto">
              Built on the foundation laid by our father and uncle, Yash Hingrajiya is now taking Wah Spices to new heights.
              Quality, trust, and authentic flavour — that is our identity, and it always will be!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
