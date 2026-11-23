import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const steps = [
  {
    id: 1,
    icon: '🧑‍🌾',
    title: 'Farmer Harvests',
    desc: "Hand-picked at peak freshness from India's finest spice farms",
    color: '#2d8a4e',
    bgLight: '#e8f5e9',
    detail: 'Rajasthan • Kerala • UP',
  },
  {
    id: 2,
    icon: '🌿',
    title: 'Natural Drying',
    desc: 'Sun-dried using traditional methods to preserve natural oils & aroma',
    color: '#558b2f',
    bgLight: '#f1f8e9',
    detail: 'Zero artificial drying',
  },
  {
    id: 3,
    icon: '🏭',
    title: 'Hygiene Cleaning',
    desc: 'Triple-cleaned in our FSSAI-certified facility — free from dust & impurities',
    color: '#1565c0',
    bgLight: '#e3f2fd',
    detail: 'FSSAI Certified',
  },
  {
    id: 4,
    icon: '⚗️',
    title: 'Expert Blending',
    desc: 'Master blenders craft each recipe with decades of spice wisdom',
    color: '#e65100',
    bgLight: '#fff3e0',
    detail: 'Authentic recipes',
  },
  {
    id: 5,
    icon: '📦',
    title: 'Fresh Packaging',
    desc: 'Sealed in airtight, food-grade packs to lock in freshness & flavour',
    color: '#6a1b9a',
    bgLight: '#f3e5f5',
    detail: 'Moisture-proof seal',
  },
  {
    id: 6,
    icon: '🍳',
    title: 'Your Kitchen',
    desc: 'Arrives fresh at your door — ready to make every meal extraordinary',
    color: '#c8371e',
    bgLight: '#ffebee',
    detail: 'Wah Spices Experience',
  },
];

/* ─────────────────────────────────────────────
   Tractor — measures container width in px
   so the emoji travels the FULL track width,
   then loops back seamlessly.
───────────────────────────────────────────── */
function AnimatedTractor() {
  const trackRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);

  /* measure once on mount + on every resize */
  useEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        setTrackWidth(trackRef.current.getBoundingClientRect().width);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* start just off-screen left, end just off-screen right */
  const startX = -56;
  const endX   = trackWidth + 56;

  return (
    <div ref={trackRef} className="relative h-16 mb-8 overflow-hidden">
      {/* Ground line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-green/20" />

      {/* Dashed track */}
      <div className="absolute bottom-0.5 left-0 right-0 flex justify-between px-6">
        {[...Array(50)].map((_, i) => (
          <div key={i} className="w-2 h-0.5 bg-brand-green/15 rounded-full" />
        ))}
      </div>

      {/* Only render once we have a real width so the loop starts correctly */}
      {trackWidth > 0 && (
        <>
          {/* Dust puff — slightly behind tractor */}
          <motion.div
            initial={{ x: startX - 20 }}
            animate={{ x: [startX - 20, endX - 20] }}
            transition={{ duration: 14, ease: 'linear', repeat: Infinity, repeatType: 'loop' }}
            className="absolute bottom-3 text-lg select-none opacity-35"
            style={{ left: 0, willChange: 'transform' }}
          >
            💨
          </motion.div>

          {/* Tractor — flipped so it faces right while moving right */}
          <motion.div
            initial={{ x: startX }}
            animate={{ x: [startX, endX] }}
            transition={{
              duration: 14,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'loop',
            }}
            className="absolute bottom-1 text-3xl select-none"
            style={{ left: 0, willChange: 'transform', transform: 'scaleX(-1)' }}
          >
            🚜
          </motion.div>
        </>
      )}
    </div>
  );
}

/* Animated farmer illustration */
function FarmerIllustration() {
  return (
    <div className="relative mx-auto w-48 h-48 mb-8">
      {/* Field ground */}
      <motion.div
        animate={{ scaleX: [1, 1.03, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-0 left-0 right-0 h-8 bg-brand-green/20 rounded-full"
      />

      {/* Crops */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-around items-end">
        {['🌶️', '🧄', '🌿', '🌱', '🫚'].map((crop, i) => (
          <motion.span
            key={i}
            className="text-xl"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
          >
            {crop}
          </motion.span>
        ))}
      </div>

      {/* Farmer */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-6xl select-none"
      >
        🧑‍🌾
      </motion.div>

      {/* Sun rotating */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute top-2 right-4 text-3xl select-none"
      >
        ☀️
      </motion.div>

      {/* Floating spice particles */}
      {['✨', '🌶️', '⭐'].map((p, i) => (
        <motion.span
          key={i}
          className="absolute text-base select-none"
          style={{ left: `${20 + i * 28}%`, bottom: '60%' }}
          animate={{ y: [0, -20, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
        >
          {p}
        </motion.span>
      ))}
    </div>
  );
}

/* Arrow connector between steps */
function StepArrow({ index }) {
  return (
    <div className="hidden md:flex items-center justify-center flex-shrink-0 w-8">
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15 * index + 0.5, duration: 0.4 }}
        className="origin-left"
      >
        <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
          <path
            d="M0 8H24M24 8L18 2M24 8L18 14"
            stroke="#1a5c2e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}

export default function FarmToKitchen() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section className="section-padding bg-white overflow-hidden" ref={ref}>
      <div className="container-custom">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-2 bg-brand-green/10 text-brand-green text-sm font-body font-semibold px-4 py-1.5 rounded-full mb-4">
            🌾 Farm to Kitchen Journey
          </span>
          <h2 className="text-3xl md:text-5xl font-body font-black text-gray-900 mb-3">
            From the <span className="text-brand-green">Farmer's Field</span>
            <br className="hidden md:block" /> to Your{' '}
            <span className="text-brand-red">Kitchen</span>
          </h2>
          <p className="text-gray-500 font-body text-base md:text-lg max-w-2xl mx-auto">
            Every Wah Spices masala travels a pure, transparent journey — from India's finest spice farms
            directly to your home, with no shortcuts taken.
          </p>
        </motion.div>

        {/* Farmer illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mb-4"
        >
          <FarmerIllustration />
        </motion.div>

        {/* Tractor track — always loops */}
        <AnimatedTractor />

        {/* Journey Steps */}
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-3 md:gap-1 mt-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex md:flex-col items-center md:items-stretch gap-2 md:gap-0 flex-1"
            >
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * index + 0.3 }}
                className="flex-1"
              >
                <div
                  className="rounded-2xl p-4 md:p-5 text-center h-full flex flex-col items-center justify-start border border-gray-100 hover:border-transparent hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 cursor-default"
                  style={{ backgroundColor: step.bgLight }}
                >
                  {/* Step number */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-body font-bold mb-2"
                    style={{ backgroundColor: step.color }}
                  >
                    {step.id}
                  </div>

                  {/* Icon */}
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      delay: index * 0.4,
                      ease: 'easeInOut',
                    }}
                    className="text-4xl mb-2 select-none"
                  >
                    {step.icon}
                  </motion.div>

                  <h3 className="font-body font-bold text-sm mb-1 leading-tight" style={{ color: step.color }}>
                    {step.title}
                  </h3>
                  <p className="text-gray-500 text-[11px] font-body leading-relaxed hidden md:block">
                    {step.desc}
                  </p>
                  <p className="text-gray-500 text-xs font-body md:hidden">{step.detail}</p>

                  <div
                    className="mt-2 text-[10px] font-body font-semibold px-2 py-0.5 rounded-full hidden md:block"
                    style={{ backgroundColor: step.color + '20', color: step.color }}
                  >
                    {step.detail}
                  </div>
                </div>
              </motion.div>

              {index < steps.length - 1 && (
                <div className="flex-shrink-0">
                  <div className="md:hidden text-brand-green/40 text-xl">↓</div>
                  <StepArrow index={index} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-12 bg-brand-green-dark rounded-3xl p-8 md:p-10 text-center text-white"
        >
          <div className="text-4xl mb-3">🌱 → 🌶️ → 📦 → 🍳</div>
          <h3 className="font-body font-black text-2xl md:text-3xl mb-2">
            Pure. Authentic. <span className="text-brand-orange">WAH!</span>
          </h3>
          <p className="text-green-300 font-body mb-6 max-w-lg mx-auto">
            Every step of our journey is designed with one goal — to bring the best of India's
            spice heritage straight to your kitchen table.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {['No Artificial Colours', 'No Preservatives', '100% Pure & Natural'].map((b) => (
              <div key={b} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-sm font-body">
                <span className="w-5 h-5 bg-brand-green rounded-full flex items-center justify-center text-white text-xs flex-shrink-0">
                  ✓
                </span>
                {b}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
