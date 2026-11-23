import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Truck, CheckCircle, Clock, MapPin, Phone, ChevronRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { trackOrder, clearTrackingData } from '@/store/slices/orderSlice';
import { SkTimeline } from '@/components/ui/Skeleton';
import { useSiteContent } from '@/content/useSiteContent';
import { safeHref } from '@/utils/safeUrl';

const statusConfig = {
  processing:       { label: 'Processing',       color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  dispatched:       { label: 'Dispatched',        color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  in_transit:       { label: 'In Transit',        color: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' },
  out_for_delivery: { label: 'Out for Delivery',  color: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  delivered:        { label: 'Delivered',         color: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  cancelled:        { label: 'Cancelled',         color: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
  return_requested: { label: 'Return Requested',  color: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  returned:         { label: 'Returned',          color: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' },
  refunded:         { label: 'Refunded',          color: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
};

// Backend OrderStatus enum names → display config
const STATUS_KEY = {
  Pending: 'processing', Confirmed: 'processing', Processing: 'processing', Packed: 'processing',
  Dispatched: 'dispatched', InTransit: 'in_transit', OutForDelivery: 'out_for_delivery', Delivered: 'delivered',
  Cancelled: 'cancelled', ReturnRequested: 'return_requested', Returned: 'returned', Refunded: 'refunded',
};
const PROCESSING_LABEL = { Pending: 'Order Placed', Confirmed: 'Confirmed', Processing: 'Processing', Packed: 'Packed' };

function getStatusKey(status) {
  if (!status) return 'processing';
  if (STATUS_KEY[status]) return STATUS_KEY[status];
  const s = status.toLowerCase().replace(/\s+/g, '_');
  return s in statusConfig ? s : 'processing';
}

// API dates are UTC without a zone suffix
const asDate = (d) => (d ? new Date(/Z|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`) : null);

export default function TrackOrder() {
  const [query, setQuery] = useState('');
  const [contact, setContact] = useState('');
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const dispatch = useAppDispatch();
  const { trackingData: order, loading, error } = useAppSelector((s) => s.orders);
  const { settings: site, block, tel, mailto } = useSiteContent();
  const supportHours = block('contact').phoneNote;

  useEffect(() => {
    const preFilledOrder = searchParams.get('order');
    const preFilledContact = searchParams.get('contact') || '';
    if (preFilledOrder) {
      setQuery(preFilledOrder);
      setContact(preFilledContact);
      // logged-in customers can open their own orders without phone/email
      if (preFilledContact || localStorage.getItem('wah_session')) dispatch(trackOrder({ orderNumber: preFilledOrder, contact: preFilledContact }));
    }
    return () => { dispatch(clearTrackingData()); };
  }, [dispatch, searchParams]);

  const handleTrack = (e) => {
    e.preventDefault();
    const id = query.trim().toUpperCase().replace(/^#/, '');
    if (!id) return;
    dispatch(trackOrder({ orderNumber: id, contact: contact.trim() }));
  };

  const statusKey = order ? getStatusKey(order.status) : null;
  const cfg = statusKey ? { ...statusConfig[statusKey], label: PROCESSING_LABEL[order.status] || statusConfig[statusKey].label } : null;
  const addr = order?.deliveryAddress || order?.shippingAddress;
  const placedAt = asDate(order?.createdAt || order?.date);

  const timeline = order?.timeline || order?.trackingTimeline || [];
  const currentStepIndex = timeline.findLastIndex ? timeline.findLastIndex((t) => t.done || t.isCompleted) : -1;

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-14 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-5xl mb-3">📦</div>
          <h1 className="text-4xl md:text-5xl font-body font-black mb-2">Track Your Order</h1>
          <p className="text-green-300 font-body">Enter your Order ID and phone / email to get live delivery updates</p>
        </motion.div>
      </div>

      <div className="container-custom py-10 max-w-3xl">
        <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} onSubmit={handleTrack} className="bg-white rounded-2xl shadow-card p-6 mb-8">
          <label className="block text-sm font-body font-semibold text-gray-700 mb-3">Order ID / AWB Number</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. WAH12345678"
                className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all text-sm"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary px-6 flex items-center gap-2 disabled:opacity-60">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Track <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
          <label className="block text-sm font-body font-semibold text-gray-700 mt-4 mb-3">
            Phone Number / Email {isAuthenticated && <span className="font-normal text-gray-400">(optional for orders in your account)</span>}
          </label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email used for the order"
              className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl font-body text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all text-sm"
            />
          </div>
        </motion.form>

        {loading && (
          <div className="bg-white rounded-2xl shadow-card p-6">
            <SkTimeline steps={5} />
          </div>
        )}

        <AnimatePresence>
          {error && !loading && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center mb-8">
              <div className="text-4xl mb-2">😕</div>
              <h3 className="font-body font-bold text-red-700 mb-1">Order Not Found</h3>
              <p className="text-sm text-red-500 font-body">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {order && cfg && (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="bg-white rounded-2xl shadow-card p-6">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
                  <div>
                    <div className="text-xs font-body text-gray-400 uppercase tracking-wider mb-1">Order ID</div>
                    <div className="font-body font-black text-xl text-brand-green-dark">#{order.orderNumber || order.id}</div>
                    <div className="text-xs text-gray-500 font-body mt-1">
                      Placed on {placedAt ? placedAt.toLocaleDateString('en-IN') : '—'}
                      {order.courier && <> &nbsp;·&nbsp; {order.courier}</>}
                      {order.awbNumber && <> &nbsp;·&nbsp; <span className="font-medium">{order.awbNumber}</span></>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-body font-semibold ${cfg.color}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                    {cfg.label}
                  </span>
                </div>

                {timeline.length > 0 && (
                  <div className="relative">
                    <div className="h-1.5 bg-gray-100 rounded-full mb-6">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(((currentStepIndex + 1) / timeline.length) * 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-brand-green rounded-full"
                      />
                    </div>
                    <div className="space-y-4">
                      {timeline.map((step, i) => {
                        const isDone = step.done || step.isCompleted;
                        const isActive = i === currentStepIndex;
                        const StepIcon = step.icon || (i === 0 ? Package : i < timeline.length - 1 ? Truck : CheckCircle);
                        return (
                          <motion.div key={step.step || step.title || i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-start gap-4">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-all ${isActive ? 'bg-brand-orange border-brand-orange shadow-lg scale-110' : isDone ? 'bg-brand-green border-brand-green' : 'bg-white border-gray-200'}`}>
                              <StepIcon className={`w-4 h-4 ${isDone || isActive ? 'text-white' : 'text-gray-300'}`} />
                            </div>
                            <div className="flex-1 pb-4 border-b border-gray-50 last:border-0">
                              <div className={`font-body font-semibold text-sm ${isActive ? 'text-brand-orange' : isDone ? 'text-brand-green-dark' : 'text-gray-400'}`}>
                                {step.label || step.step || step.title}
                                {isActive && <span className="ml-2 text-[10px] bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Current</span>}
                              </div>
                              <div className={`text-xs font-body mt-0.5 ${isDone ? 'text-gray-500' : 'text-gray-300'}`}>{step.date || step.timestamp}</div>
                              {step.note && isDone && <div className="text-xs font-body mt-0.5 text-gray-400">{step.note}</div>}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl shadow-card p-5">
                  <h3 className="font-body font-bold text-gray-800 mb-4 flex items-center gap-2"><Package className="w-4 h-4 text-brand-green" /> Items Ordered</h3>
                  <div className="space-y-3">
                    {(order.items || []).map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-body font-medium text-gray-800">{item.productName || item.name}</div>
                          <div className="text-xs text-gray-400 font-body">{item.weight} × {item.quantity || item.qty}</div>
                        </div>
                        <div className="text-sm font-body font-bold text-brand-green">₹{item.lineTotal ?? item.price * (item.quantity || item.qty || 1)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                    <span className="text-sm font-body font-semibold text-gray-700">{order.paymentStatus === 'Paid' ? 'Total Paid' : 'Order Total'}</span>
                    <span className="font-body font-black text-brand-green text-lg">₹{order.grandTotal || order.totalAmount}</span>
                  </div>
                  {order.paymentMethod && (
                    <div className="mt-1 text-xs text-gray-400 font-body text-right">
                      via {order.paymentMethod === 'CashOnDelivery' ? 'Cash on Delivery' : order.paymentMethod}
                      {order.paymentStatus && <> · Payment {order.paymentStatus === 'PartiallyRefunded' ? 'partially refunded' : order.paymentStatus.toLowerCase()}</>}
                    </div>
                  )}
                  {order.return && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs font-body text-gray-600">
                      Return <strong>{order.return.returnNumber}</strong>: {order.return.status.replace(/([a-z])([A-Z])/g, '$1 $2')}
                      {order.return.status === 'Refunded' && <> · ₹{order.return.refundAmount} refunded</>}
                      {order.return.rejectionReason && <> · {order.return.rejectionReason}</>}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-card p-5">
                  <h3 className="font-body font-bold text-gray-800 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-red" /> Delivery Info</h3>
                  <div className="space-y-3">
                    {addr && (
                      <div>
                        <div className="text-[10px] font-body font-semibold text-gray-400 uppercase tracking-wider mb-1">Delivering to</div>
                        <div className="text-sm font-body text-gray-700 leading-relaxed">
                          {typeof addr === 'string' ? addr : [addr.name, addr.addressLine || addr.address, addr.city, `${addr.state || ''}${addr.pincode ? ` - ${addr.pincode}` : ''}`].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    )}
                    {(addr?.phone || order.phone) && <div className="flex items-center gap-2 text-sm font-body text-gray-600"><Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />{addr?.phone || order.phone}</div>}
                    {order.courier && (
                      <div className="flex items-center gap-2 text-sm font-body text-gray-600">
                        <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{order.courier}{order.awbNumber && <> · AWB {order.awbNumber}</>}</span>
                        {order.courierTrackingUrl && <a href={safeHref(order.courierTrackingUrl)} target="_blank" rel="noreferrer" className="text-brand-green underline ml-1">Track</a>}
                      </div>
                    )}
                    {order.status === 'Delivered' && order.deliveredAt && (
                      <div className="flex items-center gap-2 text-sm font-body"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-gray-600">Delivered on <strong className="text-brand-green">{asDate(order.deliveredAt).toLocaleDateString('en-IN')}</strong></span></div>
                    )}
                    {order.estimatedDelivery && (
                      <div className="flex items-center gap-2 text-sm font-body">
                        <Clock className="w-4 h-4 text-brand-orange flex-shrink-0" />
                        <span className="text-gray-600">Expected by <strong className="text-brand-green">{order.estimatedDelivery}</strong></span>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <a href={tel(site.phone)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-brand-green text-brand-green font-body font-semibold text-sm hover:bg-brand-green hover:text-white transition-all">
                      📞 Call Support
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-brand-green/5 rounded-2xl p-5 flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">💬</span>
                <div>
                  <div className="font-body font-semibold text-brand-green-dark text-sm mb-0.5">Need help with your order?</div>
                  <div className="text-xs text-gray-500 font-body">
                    Contact us at{' '}
                    <a href={mailto(site.email)} className="text-brand-green underline">{site.email}</a>{' '}
                    or call{' '}
                    <a href={tel(site.phone)} className="text-brand-green underline">{site.phone}</a>{' '}
                    ({supportHours}).
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!order && !error && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center py-12">
            <div className="text-6xl mb-4">🚚</div>
            <h3 className="font-body font-bold text-gray-600 text-lg mb-2">Where is my order?</h3>
            <p className="text-sm text-gray-400 font-body max-w-sm mx-auto">Enter your order ID and the phone or email used for the order to see delivery updates, courier details and estimated delivery date.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
