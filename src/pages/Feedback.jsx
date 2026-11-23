import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useSiteContent } from '@/content/useSiteContent';

const feedbackSchema = yup.object({
  name: yup.string().optional(),
  email: yup.string().email('Invalid email address').optional(),
  product: yup.string().optional(),
  message: yup.string().min(10, 'Please write at least 10 characters').required('Your feedback is required'),
  recommend: yup.string().optional(),
});

export default function Feedback() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [ratingError, setRatingError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { block, fill } = useSiteContent();
  const fb = block('feedback');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(feedbackSchema),
  });

  const onSubmit = async (data) => {
    if (rating === 0) { setRatingError('Please select a star rating'); return; }
    setRatingError('');
    try {
      await api.post('/feedback', { ...data, rating });
      setSubmitted(true);
      toast.success('Thank you for your feedback!', { icon: '🙏', style: { borderRadius: '12px' } });
    } catch (err) {
      toast.error(err.response?.data?.error?.message
        || (err.response?.status === 429 ? 'Too many attempts — please wait a few minutes and try again.' : null)
        || 'Could not submit your feedback. Please try again.', { style: { borderRadius: '12px' } });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-12 text-center max-w-md w-full"
        >
          <div className="text-6xl mb-4">🙏</div>
          <h2 className="text-3xl font-heading font-bold text-brand-green-dark mb-3">{fill(fb.thankYouTitle)}</h2>
          <p className="text-gray-500 mb-2">{fill(fb.thankYouText)}</p>
          <p className="text-sm text-gray-400">{fill(fb.thankYouNote)}</p>
          <div className="flex gap-1 justify-center mt-4">
            {[...Array(rating)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-yellow-400" fill="currentColor" />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-16 text-center">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-3">{fill(fb.title)}</h1>
            <p className="text-green-300">{fill(fb.subtitle)}</p>
          </motion.div>
        </div>
      </div>

      <div className="container-custom py-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Honeypot for bots — hidden from people */}
            <input type="text" {...register('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {/* Star Rating */}
            <div className="text-center mb-6">
              <h3 className="font-heading font-bold text-xl text-gray-800 mb-3">
                {fill(fb.ratingQuestion)}
              </h3>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => { setRating(star); setRatingError(''); }}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className="w-10 h-10 transition-colors"
                      fill={(hover || rating) >= star ? '#f5a623' : 'none'}
                      stroke={(hover || rating) >= star ? '#f5a623' : '#d1d5db'}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-2 text-sm text-gray-400">
                {rating === 0 ? 'Click to rate' : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'][rating]}
              </div>
              {ratingError && <p className="text-red-500 text-xs mt-1">{ratingError}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
                <input type="text" {...register('name')} placeholder="Full name" className="input-field" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" {...register('email')} placeholder="your@email.com" className="input-field" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Used</label>
              <select {...register('product')} className="input-field">
                <option value="">Select a product</option>
                {(fb.products || []).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {fill(fb.recommendQuestion)}
              </label>
              <div className="flex gap-3">
                {(fb.recommendOptions || []).map((opt) => (
                  <label
                    key={opt}
                    className="flex-1 py-2.5 text-center rounded-xl border-2 text-sm cursor-pointer transition-all border-gray-200 text-gray-600 hover:border-gray-300 has-[:checked]:border-brand-green has-[:checked]:bg-brand-green/5 has-[:checked]:text-brand-green has-[:checked]:font-medium"
                  >
                    <input type="radio" {...register('recommend')} value={opt} className="sr-only" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Feedback *</label>
              <textarea
                {...register('message')}
                placeholder="Tell us about your experience with Wah Spices products..."
                rows={5}
                className="input-field resize-none"
              />
              {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full btn-primary disabled:opacity-70">
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
