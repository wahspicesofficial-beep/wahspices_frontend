import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Check, MapPin, CreditCard, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { placeOrder } from '@/store/slices/orderSlice';
import { clearCart, lineKey, useCartQuote, useStoreSettings } from '@/store/slices/cartSlice';
import { fetchAddresses, addAddress } from '@/store/slices/authSlice';
import api from '@/services/api';
import toast from 'react-hot-toast';

const addressSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Full name is required'),
  phone: yup.string().matches(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number').required('Phone is required'),
  email: yup.string().email('Invalid email address').required('Email is required'),
  pincode: yup.string().matches(/^\d{6}$/, 'Enter a valid 6-digit PIN code').required('PIN code is required'),
  city: yup.string().required('City is required'),
  state: yup.string().required('State is required'),
  address: yup.string().min(10, 'Please enter a complete address').required('Address is required'),
});

const steps = ['Address', 'Payment', 'Confirm'];

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-sdk')) return resolve(true);
    const script = document.createElement('script');
    script.id = 'razorpay-sdk';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState({ name: '', phone: '', email: '', pincode: '', address: '', city: '', state: '' });
  const [paymentMethod, setPaymentMethod] = useState('upi');

  const {
    register: regAddr,
    handleSubmit: hsAddr,
    reset: resetAddr,
    formState: { errors: addrErrors },
  } = useForm({ resolver: yupResolver(addressSchema) });
  const [upiId, setUpiId] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [placed, setPlaced] = useState(null);   // server response of the placed order (amounts actually charged)
  const [paymentLoading, setPaymentLoading] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items } = useAppSelector((s) => s.cart);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.auth.user);
  const savedAddresses = useAppSelector((s) => s.auth.addresses);
  const couponCode = useAppSelector((s) => s.cart.couponResult?.code || null);
  const { loading } = useAppSelector((s) => s.orders);
  const settings = useStoreSettings();
  const { quote, loading: quoteLoading } = useCartQuote();

  // Totals come from the server quote — the exact amount POST /api/orders will charge
  const localTotal = items.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  const localMrp = items.reduce((sum, i) => sum + (i.mrp || i.price) * (i.quantity || 1), 0);
  const itemsTotal = quote ? quote.subtotal : localTotal;
  const totalMrp = quote ? quote.subtotalMrp : localMrp;
  const savings = totalMrp - itemsTotal;
  const couponDiscount = quote?.couponDiscount || 0;
  const deliveryCharge = quote ? quote.deliveryCharge : 0;
  const grandTotal = quote ? quote.grandTotal : localTotal;
  const codAvailable = (quote?.codAvailable ?? settings?.codAvailable) !== false;
  const blockReason = quote?.blockReason || null;

  useEffect(() => { loadRazorpayScript(); }, []);
  useEffect(() => { if (isAuthenticated) dispatch(fetchAddresses()); }, [dispatch, isAuthenticated]);

  // Prefill the address form from the default saved address
  const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
  useEffect(() => {
    if (!defaultAddr && !user) return;
    resetAddr({
      name: defaultAddr?.name || user?.name || '',
      phone: defaultAddr?.phone || user?.phone || '',
      email: user?.email || '',
      pincode: defaultAddr?.pincode || '',
      city: defaultAddr?.city || '',
      state: defaultAddr?.state || '',
      address: defaultAddr ? [defaultAddr.addressLine, defaultAddr.landmark].filter(Boolean).join(', ') : '',
    });
  }, [defaultAddr?.id, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!codAvailable && paymentMethod === 'cod') setPaymentMethod('upi'); }, [codAvailable, paymentMethod]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="text-center card p-10 max-w-md w-full">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-heading font-bold text-gray-800 mb-3">Login Required</h2>
          <p className="text-gray-500 mb-6">Please login to proceed with checkout</p>
          <Link to="/login" className="btn-primary block text-center">Login / Register</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !orderPlaced && !paymentLoading) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-2xl font-heading font-bold text-gray-800 mb-3">Cart is empty</h2>
          <Link to="/products" className="btn-primary">Shop Now</Link>
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="card p-10 max-w-lg w-full text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-green-500" />
          </motion.div>
          <h2 className="text-3xl font-heading font-bold text-brand-green-dark mb-2">Order Placed! 🎉</h2>
          <p className="text-gray-500 mb-2">Your order has been confirmed successfully.</p>
          <p className="text-sm text-gray-400 mb-6">Order ID: <strong className="text-brand-green">{placedOrderId}</strong></p>
          <div className="bg-brand-cream rounded-2xl p-4 mb-6 text-left">
            <div className="text-sm text-gray-600 font-medium mb-2">Order Summary</div>
            <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Items Total</span><span>₹{placed?.subtotal ?? itemsTotal}</span></div>
            {Number(placed?.couponDiscount) > 0 && <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Coupon</span><span className="text-green-600">-₹{placed.couponDiscount}</span></div>}
            <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Delivery</span><span className="text-green-600">{Number(placed?.deliveryCharge ?? deliveryCharge) === 0 ? 'FREE' : `₹${placed?.deliveryCharge ?? deliveryCharge}`}</span></div>
            <div className="flex justify-between font-bold text-brand-green mt-2 pt-2 border-t border-gray-200"><span>Grand Total</span><span>₹{placed?.amount ?? grandTotal}</span></div>
          </div>
          <div className="text-sm text-gray-500 mb-6">📦 {placed?.estimatedDelivery ? `Expected delivery by ${placed.estimatedDelivery}` : `Expected delivery in ${settings?.avgDeliveryDays || '3-5'} business days`}</div>
          <div className="flex gap-3">
            <Link to={`/track-order?order=${placedOrderId}`} className="flex-1 btn-outline text-center">Track Order</Link>
            <Link to="/profile/orders" className="flex-1 btn-outline text-center">My Orders</Link>
            <Link to="/products" className="flex-1 btn-primary text-center">Shop More</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // The backend needs a saved address id: reuse an identical saved address, else save this one.
  const resolveAddressId = async () => {
    const norm = (v) => String(v || '').trim().toLowerCase();
    const match = savedAddresses.find((a) => norm(a.name) === norm(address.name) && norm(a.phone) === norm(address.phone)
      && norm([a.addressLine, a.landmark].filter(Boolean).join(', ')) === norm(address.address)
      && norm(a.city) === norm(address.city) && norm(a.state) === norm(address.state) && norm(a.pincode) === norm(address.pincode));
    if (match) return match.id;
    const res = await dispatch(addAddress({
      name: address.name, phone: address.phone, addressLine: address.address, city: address.city,
      state: address.state, pincode: address.pincode, landmark: null, type: 'Home', isDefault: savedAddresses.length === 0,
    }));
    if (!addAddress.fulfilled.match(res)) { toast.error(res.payload || 'Could not save the delivery address'); return null; }
    return res.payload?.id ?? null;
  };

  const handlePlaceOrder = async () => {
    if (blockReason) { toast.error(blockReason); return null; }
    const paymentMethodMap = { upi: 'UPI', card: 'Card', netbanking: 'NetBanking', cod: 'CashOnDelivery', wallet: 'Wallet' };
    const addressId = await resolveAddressId();
    if (!addressId) return null;
    const orderData = {
      addressId,
      paymentMethod: paymentMethodMap[paymentMethod] || 'UPI',
      couponCode,
      notes: null,
      expectedTotal: quote ? quote.grandTotal : undefined,
      items: items.map((i) => ({ productId: i.productId ?? i.id, variantId: i.variantId ?? null, quantity: i.quantity || 1 })),
    };

    const res = await dispatch(placeOrder(orderData));
    if (!placeOrder.fulfilled.match(res)) {
      toast.error(res.payload || 'Failed to place order. Please try again.');
      return null;
    }

    setPlaced(res.payload);
    return res.payload;
  };

  const handleCOD = async () => {
    const order = await handlePlaceOrder();
    if (!order) return;

    dispatch(clearCart());
    setPlacedOrderId(order.orderNumber || order.orderId);
    setOrderPlaced(true);
    toast.success('Order placed successfully!', { icon: '🎉', style: { borderRadius: '12px' } });
  };

  const handleOnlinePayment = async () => {
    setPaymentLoading(true);
    try {
      // Step 1: place the order in our backend
      const order = await handlePlaceOrder();
      if (!order) { setPaymentLoading(false); return; }
      // the order exists now (stock reserved) — clear the cart even if the customer closes the payment popup
      dispatch(clearCart());

      // Step 2: create Razorpay order
      const rzpRes = await api.post('/payments/create-order', { orderId: order.id });
      const rzpData = rzpRes.data.data;

      // Step 3: open Razorpay checkout modal
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast.error('Payment gateway failed to load. Please try again.');
        setPaymentLoading(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: rzpData.keyId,
        amount: rzpData.amountInPaise,
        currency: rzpData.currency,
        name: 'WAH! Spices',
        description: `Order #${rzpData.orderNumber}`,
        order_id: rzpData.razorpayOrderId,
        prefill: {
          name: rzpData.customerName,
          email: rzpData.customerEmail,
          contact: rzpData.customerPhone,
        },
        theme: { color: '#1a5c2e' },
        handler: async (response) => {
          // Step 4: verify payment signature in our backend
          try {
            await api.post('/payments/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setPlacedOrderId(rzpData.orderNumber);
            setOrderPlaced(true);
            toast.success('Payment successful! Order confirmed.', { icon: '✅', style: { borderRadius: '12px' } });
          } catch (err) {
            toast.error(err?.response?.data?.error?.message || 'Payment verification failed. Contact support with your order ID.');
          }
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled. Your order is saved — you can track it from My Orders.', { icon: 'ℹ️' });
            setPaymentLoading(false);
            navigate('/profile/orders');
          },
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Payment failed. Please try again.');
      setPaymentLoading(false);
    }
  };

  const handleFinalStep = () => {
    if (paymentMethod === 'cod') {
      handleCOD();
    } else {
      handleOnlinePayment();
    }
  };

  const isWorking = loading || paymentLoading;

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-10">
        <div className="container-custom">
          <h1 className="text-3xl font-heading font-bold mb-4">Checkout</h1>
          <div className="flex items-center gap-3">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i <= step ? 'bg-brand-orange text-white' : 'bg-white/20 text-white/50'}`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm hidden sm:block ${i <= step ? 'text-white' : 'text-white/50'}`}>{s}</span>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-white/30" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Step 0 — Address */}
            {step === 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
                <h2 className="font-heading font-bold text-2xl text-brand-green-dark mb-6 flex items-center gap-2"><MapPin className="w-6 h-6" /> Delivery Address</h2>
                <form onSubmit={hsAddr((data) => { setAddress(data); setStep(1); })} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'name',    label: 'Full Name *',     placeholder: 'Enter your full name',             full: false },
                    { key: 'phone',   label: 'Phone Number *',  placeholder: '10-digit mobile number',           full: false },
                    { key: 'email',   label: 'Email Address *', placeholder: 'your@email.com',                   full: true  },
                    { key: 'pincode', label: 'PIN Code *',      placeholder: '6-digit PIN code',                 full: false },
                    { key: 'city',    label: 'City *',          placeholder: 'Your city',                        full: false },
                    { key: 'state',   label: 'State *',         placeholder: 'Your state',                       full: false },
                    { key: 'address', label: 'Full Address *',  placeholder: 'House no, Street, Area, Landmark', full: true  },
                  ].map((field) => (
                    <div key={field.key} className={field.full ? 'sm:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                      <input type="text" {...regAddr(field.key)} placeholder={field.placeholder} className="input-field" />
                      {addrErrors[field.key] && <p className="text-red-500 text-xs mt-1">{addrErrors[field.key].message}</p>}
                    </div>
                  ))}
                  <div className="sm:col-span-2 mt-2">
                    <button type="submit" className="btn-primary flex items-center gap-2">Continue to Payment <ChevronRight className="w-4 h-4" /></button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Step 1 — Payment */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
                <h2 className="font-heading font-bold text-2xl text-brand-green-dark mb-6 flex items-center gap-2"><CreditCard className="w-6 h-6" /> Payment Method</h2>
                <div className="space-y-4">
                  {[
                    { id: 'upi',        label: 'UPI / QR Code',          icon: '📱', desc: 'Pay via GPay, PhonePe, Paytm etc.'  },
                    { id: 'card',       label: 'Credit / Debit Card',     icon: '💳', desc: 'All major cards accepted'           },
                    { id: 'netbanking', label: 'Net Banking',             icon: '🏦', desc: 'All major banks supported'         },
                    { id: 'cod',        label: 'Cash on Delivery',        icon: '💵', desc: 'Pay when you receive your order'   },
                  ].filter((m) => m.id !== 'cod' || codAvailable).map((method) => (
                    <label key={method.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === method.id ? 'border-brand-green bg-brand-green/5' : 'border-gray-100 hover:border-gray-200'}`}>
                      <input type="radio" name="payment" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} className="accent-brand-green w-4 h-4" />
                      <span className="text-2xl">{method.icon}</span>
                      <div><div className="font-medium text-gray-800">{method.label}</div><div className="text-xs text-gray-500">{method.desc}</div></div>
                    </label>
                  ))}
                  {!codAvailable && (
                    <div className="bg-orange-50 rounded-xl p-3 text-xs text-orange-700">Cash on Delivery is currently not available — please pay online.</div>
                  )}
                  {paymentMethod === 'upi' && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">UPI ID (optional — enter in Razorpay popup)</label>
                      <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" className="input-field" />
                    </div>
                  )}
                  {paymentMethod !== 'cod' && (
                    <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                      <span>🔒</span>
                      <span>Payments are secured by Razorpay. You will be redirected to a secure payment popup.</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setStep(0)} className="btn-outline">Back</button>
                  <button onClick={() => setStep(2)} className="btn-primary flex items-center gap-2">Review Order <ChevronRight className="w-4 h-4" /></button>
                </div>
              </motion.div>
            )}

            {/* Step 2 — Confirm */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
                <h2 className="font-heading font-bold text-2xl text-brand-green-dark mb-6 flex items-center gap-2"><Package className="w-6 h-6" /> Review Order</h2>
                <div className="bg-brand-cream rounded-2xl p-4 mb-5">
                  <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery to</div>
                  <div className="text-sm text-gray-600">
                    <strong>{address.name || 'Customer Name'}</strong> · {address.phone || 'Phone'}<br />
                    {address.address || '123 Main St'}, {address.city || 'City'}, {address.state || 'State'} - {address.pincode || '000000'}
                  </div>
                  <button onClick={() => setStep(0)} className="text-xs text-brand-green mt-2 hover:underline">Change Address</button>
                </div>
                <div className="bg-brand-cream rounded-2xl p-4 mb-5">
                  <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment</div>
                  <div className="text-sm text-gray-600 capitalize">{paymentMethod === 'cod' ? '💵 Cash on Delivery' : paymentMethod === 'upi' ? '📱 UPI / Razorpay' : paymentMethod === 'card' ? '💳 Card / Razorpay' : '🏦 Net Banking / Razorpay'}</div>
                  <button onClick={() => setStep(1)} className="text-xs text-brand-green mt-1 hover:underline">Change</button>
                </div>
                <div className="space-y-3 mb-5">
                  {items.map((item) => (
                    <div key={lineKey(item)} className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: item.bgColor || '#1a5c2e' }}>
                        <img src="/wah_logo.jpg" alt="Wah Spices" className="w-10 h-8 object-contain rounded" />
                      </div>
                      <div className="flex-1"><div className="text-sm font-medium text-gray-800">{item.name}</div><div className="text-xs text-gray-400">{item.weight ? `${item.weight} · ` : ''}Qty: {item.quantity || 1}</div></div>
                      <div className="font-bold text-brand-green text-sm">₹{item.price * (item.quantity || 1)}</div>
                    </div>
                  ))}
                </div>
                {blockReason && <div className="bg-red-50 rounded-xl p-3 text-sm text-red-600 mb-4">{blockReason}</div>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-outline">Back</button>
                  <button onClick={handleFinalStep} disabled={isWorking || !!blockReason || (quoteLoading && !quote)} className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                    {isWorking
                      ? <><span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
                      : paymentMethod === 'cod'
                        ? `Place Order · ₹${grandTotal}`
                        : `Pay ₹${grandTotal} via Razorpay`}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div>
            <div className="card p-6 sticky top-24">
              <h2 className="font-heading font-bold text-lg text-brand-green-dark mb-4">Order Summary</h2>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-gray-500">MRP Total</span><span className="line-through text-gray-400">₹{totalMrp}</span></div>
                {savings > 0 && <div className="flex justify-between text-green-600"><span>Your Savings</span><span>-₹{savings}</span></div>}
                {couponDiscount > 0 && <div className="flex justify-between text-green-600"><span>Coupon ({quote?.couponCode})</span><span>-₹{couponDiscount}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className={deliveryCharge === 0 ? 'text-green-600' : ''}>{deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}</span></div>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="font-bold text-gray-800">Total</span>
                <span className="font-heading font-bold text-2xl text-brand-green">₹{grandTotal}</span>
              </div>
              {savings > 0 && <div className="mt-2 bg-green-50 text-green-600 text-xs rounded-xl px-3 py-2 text-center font-medium">🎉 You're saving ₹{savings} on this order!</div>}
              <div className="mt-4 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                🔒 Secured by Razorpay
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
