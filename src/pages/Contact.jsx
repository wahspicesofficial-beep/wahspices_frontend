import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useSiteContent } from '@/content/useSiteContent';
import { safeHref, safeEmbedUrl } from '@/utils/safeUrl';

const contactSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Name is required'),
  email: yup.string().email('Invalid email address').required('Email is required'),
  phone: yup.string()
    .test('phone', 'Enter a valid 10-digit mobile number', (val) => !val || /^[6-9]\d{9}$/.test(val))
    .optional(),
  subject: yup.string().required('Please select a subject'),
  message: yup.string().min(10, 'Message must be at least 10 characters').required('Message is required'),
});

const SOCIAL_EMOJI = { facebook: '📘', instagram: '📸', youtube: '📺', twitter: '🐦', x: '🐦', linkedin: '💼', whatsapp: '💬' };

/** "Shop No. 17-18, Krishna Township, Mota Varachha, Surat, Gujarat - 394101" → ["Shop No. 17-18, …, Surat", "Gujarat - 394101"] */
function splitAddress(address) {
  const a = String(address || '');
  const i = a.lastIndexOf(',');
  return i > 0 ? [a.slice(0, i).trim(), a.slice(i + 1).trim()] : [a, ''];
}

export default function Contact() {
  const { block, settings, fill, tel, mailto } = useSiteContent();
  const c = block('contact');
  const socials = (block('social').items || []).filter((s) => s.enabled !== false && (s.handle || s.url));
  const [addrMain, addrRest] = splitAddress(settings.address);
  const extraPhones = (c.extraPhones || []).filter(Boolean);
  const extraEmails = (c.extraEmails || []).filter(Boolean);

  const contactInfo = [
    { icon: Phone, title: 'Phone', value: settings.phone, extra: extraPhones, href: tel, sub: c.phoneNote, color: 'text-green-500 bg-green-50' },
    { icon: Mail, title: 'Email', value: settings.email, extra: extraEmails, href: mailto, sub: c.emailNote, color: 'text-blue-500 bg-blue-50' },
    { icon: MapPin, title: 'Address', value: addrMain, sub: `${addrRest}${c.addressSuffix || ''}`, color: 'text-red-500 bg-red-50' },
    { icon: Clock, title: c.hoursTitle, value: c.hours, sub: c.hoursNote, color: 'text-purple-500 bg-purple-50' },
  ];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(contactSchema),
  });

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/contact', data);
      reset();
      const ticket = res.data?.data?.ticketId;
      toast.success(`${fill(c.successMessage)}${ticket ? ` Ticket: ${ticket}` : ''}`, { icon: '✅', style: { borderRadius: '12px' }, duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.error?.message
        || (err.response?.status === 429 ? 'Too many attempts — please wait a few minutes and try again.' : null)
        || 'Could not send your message. Please try again.', { style: { borderRadius: '12px' } });
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-16 text-center">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-3">{fill(c.title)}</h1>
            <p className="text-green-300 text-lg">{fill(c.subtitle)}</p>
          </motion.div>
        </div>
      </div>

      <div className="container-custom py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {contactInfo.map((info, i) => (
            <motion.div
              key={info.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="card p-5 text-center"
            >
              <div className={`w-11 h-11 rounded-xl ${info.color} flex items-center justify-center mx-auto mb-3`}>
                <info.icon className="w-5 h-5" />
              </div>
              <div className="font-heading font-bold text-gray-800 text-sm mb-1">{info.title}</div>
              <div className="text-xs font-medium text-gray-700 mb-0.5">{info.value}</div>
              {(info.extra || []).map((x) => (
                <a key={x} href={info.href(x)} className="block text-xs font-medium text-gray-700 mb-0.5 hover:text-brand-green">{x}</a>
              ))}
              <div className="text-xs text-gray-400">{fill(info.sub)}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-3"
          >
            <div className="card p-8">
              <h2 className="font-heading font-bold text-2xl text-brand-green-dark mb-6">{fill(c.formTitle)}</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Honeypot for bots — hidden from people */}
                <input type="text" {...register('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                    <input type="text" {...register('name')} placeholder="Your name" className="input-field" />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                    <input type="tel" {...register('phone')} placeholder="Your phone number" className="input-field" />
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                  <input type="email" {...register('email')} placeholder="your@email.com" className="input-field" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
                  <select {...register('subject')} className="input-field">
                    <option value="">Select a topic</option>
                    {(c.subjects || []).map((sub) => <option key={sub}>{sub}</option>)}
                  </select>
                  {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
                  <textarea
                    {...register('message')}
                    placeholder="Write your message here..."
                    rows={5}
                    className="input-field resize-none"
                  />
                  {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2 disabled:opacity-70">
                  {isSubmitting
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 space-y-5"
          >
            <div className="card p-6">
              <h3 className="font-heading font-bold text-brand-green-dark mb-4">{fill(c.followTitle)}</h3>
              <div className="space-y-3">
                {socials.map((s) => ({ name: s.platform, handle: s.handle || s.url, url: s.url, icon: SOCIAL_EMOJI[String(s.platform || '').toLowerCase()] || '🔗' })).map((s) => {
                  const body = (
                    <>
                      <span className="text-xl">{s.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-700">{s.name}</div>
                        <div className="text-xs text-brand-green">{s.handle}</div>
                      </div>
                    </>
                  );
                  return s.url
                    ? <a key={s.name} href={safeHref(s.url)} target="_blank" rel="noreferrer" className="flex items-center gap-3">{body}</a>
                    : <div key={s.name} className="flex items-center gap-3">{body}</div>;
                })}
              </div>
            </div>

            <div className="card overflow-hidden">
              {safeEmbedUrl(c.mapEmbedUrl) ? (
                <iframe
                  src={safeEmbedUrl(c.mapEmbedUrl)}
                  title={fill(c.mapLabel) || 'Map'}
                  className="w-full h-48 border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              ) : (
                <div className="bg-brand-green/10 h-48 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-10 h-10 text-brand-green mx-auto mb-2" />
                    <div className="text-sm text-gray-600 font-medium">{fill(c.mapLabel)}</div>
                    <div className="text-xs text-gray-400">{String(settings.address || '').replace(/\s*-\s*\d{6}\s*$/, '')}</div>
                  </div>
                </div>
              )}
              <div className="p-4">
                <a
                  href={c.mapLink ? safeHref(c.mapLink) : `https://maps.google.com/?q=${encodeURIComponent(settings.address || '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-sm text-brand-green hover:underline"
                >
                  Open in Google Maps →
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
