import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight, Package } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { removeItem, updateQuantity, clearCart, applyCoupon, removeCoupon, lineKey, useCartQuote, useStoreSettings } from '@/store/slices/cartSlice';
import toast from 'react-hot-toast';

export default function Cart() {
  const dispatch = useAppDispatch();
  const { items, couponResult } = useAppSelector((s) => s.cart);
  const [couponCode, setCouponCode] = useState('');

  const settings = useStoreSettings();
  const { quote } = useCartQuote();

  // Server quote = exactly what the order will charge; local maths only fills the gap until it arrives.
  const localPrice = items.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  const localMrp = items.reduce((sum, i) => sum + (i.mrp || i.price) * (i.quantity || 1), 0);
  const freeAbove = Number(quote?.freeDeliveryAbove ?? settings?.freeDeliveryAbove ?? 0);
  const totalItems = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const totalPrice = quote ? quote.subtotal : localPrice;
  const totalMrp = quote ? quote.subtotalMrp : localMrp;
  const savings = totalMrp - totalPrice;
  const couponDiscount = quote ? quote.couponDiscount : (couponResult?.discountAmount || 0);
  const deliveryCharge = quote
    ? quote.deliveryCharge
    : (freeAbove > 0 && totalPrice - couponDiscount < freeAbove ? Number(settings?.deliveryCharge ?? 0) : 0);
  const grandTotal = quote ? quote.grandTotal : totalPrice - couponDiscount + deliveryCharge;
  const amountForFree = quote ? quote.amountForFreeDelivery : Math.max(0, freeAbove - (totalPrice - couponDiscount));
  const lineIssue = (item) => quote?.items?.find((l) => l.productId === (item.productId ?? item.id) && (l.variantId ?? null) === (item.variantId ?? null) && !l.available)?.message;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    const res = await dispatch(applyCoupon(couponCode));
    if (applyCoupon.fulfilled.match(res)) {
      toast.success('Coupon applied!', { icon: '🎉', style: { borderRadius: '12px' } });
    } else {
      toast.error(res.payload || 'Invalid coupon code');
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-32 h-32 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-16 h-16 text-brand-green/40" />
          </div>
          <h2 className="text-3xl font-heading font-bold text-gray-700 mb-3">Your cart is empty</h2>
          <p className="text-gray-500 mb-8 font-body">Discover our premium masala collection and add some spice to your life!</p>
          <Link to="/products" className="btn-primary inline-flex items-center gap-2">Shop Now <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-10">
        <div className="container-custom">
          <h1 className="text-3xl font-heading font-bold">My Cart ({totalItems} item{totalItems > 1 ? 's' : ''})</h1>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, i) => (
              <motion.div key={lineKey(item)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} exit={{ opacity: 0, x: -100 }} className="bg-white rounded-2xl p-5 shadow-card flex gap-5">
                <div className="w-20 h-24 rounded-xl flex-shrink-0 flex flex-col items-center justify-center" style={{ backgroundColor: item.image ? '#f5f5f5' : (item.bgColor || '#1a5c2e') }}>
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                    : <><img src="/wah_logo.jpg" alt="Wah Spices" className="w-14 h-10 object-contain rounded" /><div className="text-white/70 text-xs text-center leading-tight px-1 mt-1">{item.name}</div></>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-body font-semibold text-gray-800 mb-0.5">{item.name}</h3>
                  <p className="text-xs text-gray-400 mb-1">{item.weight}{item.packType ? ` — ${item.packType}` : ''}</p>
                  {item.state && <p className="text-xs text-brand-orange mb-3">📍 {item.state}</p>}
                  {lineIssue(item) && <p className="text-xs text-brand-red mb-2">{lineIssue(item)}</p>}

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <span className="text-xl font-heading font-bold text-brand-green">₹{item.price * (item.quantity || 1)}</span>
                      <span className="text-xs text-gray-400 ml-2">₹{item.price}/piece</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                        <button onClick={() => dispatch(updateQuantity({ key: lineKey(item), quantity: (item.quantity || 1) - 1 }))} className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-brand-green hover:text-white transition-colors"><Minus className="w-3 h-3" /></button>
                        <span className="w-6 text-center font-bold">{item.quantity || 1}</span>
                        <button onClick={() => dispatch(updateQuantity({ key: lineKey(item), quantity: (item.quantity || 1) + 1 }))} className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-brand-green hover:text-white transition-colors"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => dispatch(removeItem(lineKey(item)))} className="text-gray-300 hover:text-brand-red transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            <button onClick={() => dispatch(clearCart())} className="text-sm text-gray-400 hover:text-brand-red transition-colors">
              Clear all items
            </button>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-card p-6 sticky top-24">
              <h2 className="font-heading font-bold text-xl text-brand-green-dark mb-5">Order Summary</h2>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Price ({totalItems} items)</span>
                  <span className="text-gray-400 line-through">₹{totalMrp}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Discount</span>
                    <span className="text-green-600 font-medium">-₹{savings}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Coupon ({couponResult?.code}) <button onClick={() => dispatch(removeCoupon())} className="text-xs text-gray-400 hover:text-brand-red ml-1">✕</button></span>
                    <span className="text-green-600 font-medium">-₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery</span>
                  <span className={deliveryCharge === 0 ? 'text-green-600 font-medium' : 'text-gray-800'}>{deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}</span>
                </div>
                {deliveryCharge > 0 && amountForFree > 0 && (
                  <div className="bg-orange-50 rounded-xl p-3 text-xs text-orange-700">Add ₹{amountForFree} more for <strong>FREE delivery</strong>!</div>
                )}
                {quote?.blockReason && (
                  <div className="bg-red-50 rounded-xl p-3 text-xs text-red-600">{quote.blockReason}</div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 mb-5">
                <div className="flex justify-between items-center">
                  <span className="font-body font-bold text-gray-800">Total Amount</span>
                  <span className="font-heading font-bold text-2xl text-brand-green">₹{grandTotal}</span>
                </div>
                {savings > 0 && <div className="text-green-600 text-xs mt-1 text-right">🎉 You save ₹{savings} on this order!</div>}
              </div>

              <div className="flex gap-2 mb-5">
                <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Apply coupon code" className="input-field flex-1 text-sm py-2" />
                <button onClick={handleApplyCoupon} className="btn-outline text-sm px-4 py-2">Apply</button>
              </div>

              <Link to="/checkout" className="btn-primary w-full flex items-center justify-center gap-2 text-center">
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/products" className="block text-center text-sm text-gray-500 hover:text-brand-green transition-colors mt-4">Continue Shopping</Link>

              <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                {['🔒 Secure', '📦 Fast Ship', '↩️ Easy Returns'].map((t) => <div key={t} className="text-xs text-gray-500">{t}</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
