import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Package, Heart, LogOut, Edit3, MapPin, Phone, Mail, Plus, Trash2, Edit2, Star, Home, Briefcase, X, Camera } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutUser, updateProfile, getProfile, fetchAddresses, addAddress, updateAddress, deleteAddress } from '@/store/slices/authSlice';
import { fetchOrders, fetchOrderDetail, cancelOrder, previewReturn, requestReturn, cancelReturn } from '@/store/slices/orderSlice';
import { SkOrderHistory } from '@/components/ui/Skeleton';
import { clearCart } from '@/store/slices/cartSlice';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { fetchFile, saveBlob, fileErrorMessage, invoiceFileName } from '@/utils/fileDownload';
import MarketingEmailToggle from '@/components/notifications/MarketingEmailToggle';

const profileSchema = yup.object({
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Name is required'),
  email: yup.string().email('Invalid email address').required('Email is required'),
  phone: yup.string()
    .test('phone', 'Enter a valid 10-digit mobile number', (val) => !val || /^[6-9]\d{9}$/.test(val))
    .optional(),
});

const statusColor = {
  Delivered: 'bg-green-100 text-green-700',
  'In Transit': 'bg-blue-100 text-blue-700',
  Processing: 'bg-yellow-100 text-yellow-700',
  Cancelled: 'bg-red-100 text-red-700',
  'Out for Delivery': 'bg-blue-100 text-blue-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Confirmed: 'bg-blue-100 text-blue-700',
  Packed: 'bg-blue-100 text-blue-700',
  Dispatched: 'bg-blue-100 text-blue-700',
  'Return Requested': 'bg-orange-100 text-orange-700',
  Returned: 'bg-purple-100 text-purple-700',
  Refunded: 'bg-green-100 text-green-700',
};
// "OutForDelivery" → "Out for Delivery"
const human = (v) => String(v || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ For /g, ' for ');
const orderLabel = (v) => (v === 'Pending' ? 'Order Placed' : human(v));
const payLabel = (method, status) => {
  const m = method === 'CashOnDelivery' ? 'Cash on Delivery' : method;
  const st = status === 'Pending' && method === 'CashOnDelivery' ? 'pay on delivery' : human(status).toLowerCase();
  return `${m} · ${st}`;
};
const asDate = (d) => (d ? new Date(/Z|[+-]\d\d:?\d\d$/.test(d) ? d : `${d}Z`) : null);
const RETURN_CONDITIONS = [
  { value: 'Unopened', label: 'Unopened' }, { value: 'Opened', label: 'Opened' }, { value: 'Damaged', label: 'Damaged' },
  { value: 'WrongProduct', label: 'Wrong product' }, { value: 'Expired', label: 'Expired' }, { value: 'DefectivePacking', label: 'Defective packing' },
];

const emptyAddr = { name: '', phone: '', addressLine: '', city: '', state: '', pincode: '', landmark: '', type: 'Home', isDefault: false };

export default function Profile() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, addresses } = useAppSelector((s) => s.auth);
  const { items: orders, loading: ordersLoading } = useAppSelector((s) => s.orders);
  const location = useLocation();
  // ?order=<id> (links in order emails) opens that order's details in "My Orders"
  const focusOrderId = new URLSearchParams(location.search).get('order');
  const [activeSection, setActiveSection] = useState(location.pathname.endsWith('/orders') || focusOrderId ? 'orders' : 'overview');
  const [autoOpenId, setAutoOpenId] = useState(focusOrderId);   // consumed once
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });

  // address state
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [editAddr, setEditAddr]           = useState(null);
  const [addrForm, setAddrForm]           = useState(emptyAddr);
  const [deleteAddrId, setDeleteAddrId]   = useState(null);

  const {
    register: regProfile,
    handleSubmit: hsProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: { name: user?.name || '', email: user?.email || '', phone: user?.phone || '' },
  });

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(getProfile());
    }
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (activeSection === 'orders' && isAuthenticated) dispatch(fetchOrders());
    if (activeSection === 'address' && isAuthenticated) dispatch(fetchAddresses());
  }, [dispatch, activeSection, isAuthenticated]);

  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
      resetProfile({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
    }
  }, [user, resetProfile]);

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  const handleLogout = async () => {
    await dispatch(logoutUser());
    dispatch(clearCart());
    toast.success('Logged out successfully', { icon: '👋', style: { borderRadius: '12px' } });
  };

  const handleSaveProfile = hsProfile(async (data) => {
    const res = await dispatch(updateProfile(data));
    if (updateProfile.fulfilled.match(res)) {
      setEditMode(false);
      toast.success('Profile updated!', { icon: '✅', style: { borderRadius: '12px' } });
    } else {
      toast.error('Failed to update profile');
    }
  });

  // ── Address handlers ────────────────────────────────
  const openAddAddr = () => {
    setEditAddr(null);
    setAddrForm({ ...emptyAddr, name: user?.name || '', phone: user?.phone || '' });
    setShowAddrModal(true);
  };
  const openEditAddr = (addr) => {
    setEditAddr(addr);
    setAddrForm({ name: addr.name, phone: addr.phone, addressLine: addr.addressLine, city: addr.city, state: addr.state, pincode: addr.pincode, landmark: addr.landmark || '', type: addr.type || 'Home', isDefault: addr.isDefault });
    setShowAddrModal(true);
  };
  const handleSaveAddr = async () => {
    if (!addrForm.name.trim() || !addrForm.phone.trim() || !addrForm.addressLine.trim() || !addrForm.city.trim() || !addrForm.state.trim() || !addrForm.pincode.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    if (editAddr) {
      const res = await dispatch(updateAddress({ id: editAddr.id, ...addrForm }));
      if (updateAddress.fulfilled.match(res)) {
        toast.success('Address updated!', { style: { borderRadius: '12px' } });
        if (addrForm.isDefault) dispatch(fetchAddresses());
      } else { toast.error(res.payload || 'Failed to update'); return; }
    } else {
      const res = await dispatch(addAddress(addrForm));
      if (addAddress.fulfilled.match(res)) {
        toast.success('Address added!', { icon: '📍', style: { borderRadius: '12px' } });
        if (addrForm.isDefault) dispatch(fetchAddresses());
      } else { toast.error(res.payload || 'Failed to add'); return; }
    }
    setShowAddrModal(false);
  };
  const handleDeleteAddr = async () => {
    const res = await dispatch(deleteAddress(deleteAddrId));
    if (deleteAddress.fulfilled.match(res)) toast.success('Address deleted', { style: { borderRadius: '12px' } });
    else toast.error(res.payload || 'Failed to delete');
    setDeleteAddrId(null);
  };
  const handleSetDefault = async (addr) => {
    const res = await dispatch(updateAddress({ id: addr.id, name: addr.name, phone: addr.phone, addressLine: addr.addressLine, city: addr.city, state: addr.state, pincode: addr.pincode, landmark: addr.landmark || '', type: addr.type, isDefault: true }));
    if (updateAddress.fulfilled.match(res)) {
      toast.success('Default address updated', { style: { borderRadius: '12px' } });
      dispatch(fetchAddresses());
    }
  };

  const navItems = [
    { id: 'overview', icon: User, label: 'Overview' },
    { id: 'orders', icon: Package, label: 'My Orders' },
    { id: 'wishlist', icon: Heart, label: 'Wishlist' },
    { id: 'address', icon: MapPin, label: 'Addresses' },
  ];

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-10">
        <div className="container-custom">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center text-white text-2xl font-heading font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold">{user?.name || 'Valued Customer'}</h1>
              <p className="text-green-300 text-sm">{user?.email || user?.phone || 'Wah Spices Member'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="card p-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${activeSection === item.id ? 'bg-brand-green text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-brand-red hover:bg-red-50 transition-all mt-4 border-t border-gray-100 pt-4">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">
            {activeSection === 'overview' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading font-bold text-xl text-brand-green-dark">Profile Details</h2>
                  <button onClick={() => setEditMode(!editMode)} className="flex items-center gap-2 btn-ghost">
                    <Edit3 className="w-4 h-4" />{editMode ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[{ icon: User, label: 'Full Name', key: 'name' }, { icon: Mail, label: 'Email', key: 'email' }, { icon: Phone, label: 'Phone', key: 'phone' }].map((field) => (
                    <div key={field.key}>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1.5">
                        <field.icon className="w-3.5 h-3.5" /> {field.label}
                      </label>
                      {editMode ? (
                        <>
                          <input type="text" {...regProfile(field.key)} className="input-field" />
                          {profileErrors[field.key] && <p className="text-red-500 text-xs mt-1">{profileErrors[field.key].message}</p>}
                        </>
                      ) : (
                        <div className="text-gray-800 font-medium py-2 px-4 bg-gray-50 rounded-xl">{profileData[field.key] || '—'}</div>
                      )}
                    </div>
                  ))}
                </div>
                {editMode && <button onClick={handleSaveProfile} className="mt-6 btn-primary">Save Changes</button>}
                <MarketingEmailToggle />
              </motion.div>
            )}

            {activeSection === 'orders' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <h2 className="font-heading font-bold text-xl text-brand-green-dark">My Orders</h2>
                {ordersLoading && orders.length === 0 ? (
                  <SkOrderHistory count={3} />
                ) : orders.length === 0 ? (
                  <div className="card p-8 text-center">
                    <div className="text-4xl mb-3">📦</div>
                    <p className="text-gray-500 mb-4">You haven't placed any orders yet</p>
                    <Link to="/products" className="btn-primary inline-block">Shop Now</Link>
                  </div>
                ) : (
                  orders.map((order) => (
                    <OrderCard key={order.id} order={order} autoOpen={autoOpenId != null && String(order.id) === autoOpenId} onAutoOpened={() => setAutoOpenId(null)} onChanged={() => dispatch(fetchOrders())} />
                  ))
                )}
              </motion.div>
            )}

            {activeSection === 'wishlist' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="font-heading font-bold text-xl text-brand-green-dark mb-4">My Wishlist</h2>
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">❤️</div>
                  <p className="text-gray-500 mb-4">View your saved products</p>
                  <Link to="/wishlist" className="btn-primary inline-block">Go to Wishlist</Link>
                </div>
              </motion.div>
            )}

            {activeSection === 'address' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-bold text-xl text-brand-green-dark">My Addresses</h2>
                  <button onClick={openAddAddr} className="btn-primary flex items-center gap-2 text-sm py-2">
                    <Plus className="w-4 h-4" /> Add Address
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="card p-10 text-center">
                    <div className="text-5xl mb-3">📍</div>
                    <p className="text-gray-500 font-body mb-4">No saved addresses yet</p>
                    <button onClick={openAddAddr} className="btn-primary inline-flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add Your First Address
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                      <div key={addr.id} className={`card p-5 relative flex flex-col gap-3 ${addr.isDefault ? 'ring-2 ring-brand-green' : ''}`}>
                        {/* badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-body font-semibold px-2.5 py-1 rounded-full ${addr.type === 'Office' ? 'bg-blue-50 text-blue-600' : 'bg-brand-green/10 text-brand-green'}`}>
                            {addr.type === 'Office' ? <Briefcase className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                            {addr.type || 'Home'}
                          </span>
                          {addr.isDefault && (
                            <span className="inline-flex items-center gap-1 text-xs font-body font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Default
                            </span>
                          )}
                        </div>
                        {/* details */}
                        <div>
                          <div className="font-body font-semibold text-gray-800 text-sm">{addr.name}</div>
                          <div className="text-xs text-gray-500 font-body mt-0.5">{addr.phone}</div>
                          <div className="text-sm text-gray-600 font-body mt-1.5 leading-snug">
                            {addr.addressLine}
                            {addr.landmark && <span className="text-gray-400">, {addr.landmark}</span>}
                          </div>
                          <div className="text-sm text-gray-600 font-body">{addr.city}, {addr.state} – {addr.pincode}</div>
                        </div>
                        {/* actions */}
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                          {!addr.isDefault && (
                            <button onClick={() => handleSetDefault(addr)} className="text-xs text-brand-green hover:underline font-body font-medium flex items-center gap-1">
                              <Star className="w-3 h-3" /> Set Default
                            </button>
                          )}
                          <button onClick={() => openEditAddr(addr)} className="ml-auto p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteAddrId(addr.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add / Edit modal */}
                {showAddrModal && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-body font-bold text-lg text-gray-900">{editAddr ? 'Edit Address' : 'Add New Address'}</h3>
                        <button onClick={() => setShowAddrModal(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
                      </div>
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {[
                          { label: 'Full Name *', key: 'name', placeholder: 'Recipient name' },
                          { label: 'Phone *', key: 'phone', placeholder: '10-digit mobile' },
                          { label: 'Address Line *', key: 'addressLine', placeholder: 'Flat / House No., Street, Area' },
                          { label: 'Landmark', key: 'landmark', placeholder: 'Near landmark (optional)' },
                          { label: 'City *', key: 'city', placeholder: 'City' },
                          { label: 'State *', key: 'state', placeholder: 'State' },
                          { label: 'Pincode *', key: 'pincode', placeholder: '6-digit pincode' },
                        ].map((f) => (
                          <div key={f.key}>
                            <label className="block text-sm font-body font-semibold text-gray-700 mb-1">{f.label}</label>
                            <input
                              type="text"
                              value={addrForm[f.key]}
                              onChange={(e) => setAddrForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              className="input-field"
                            />
                          </div>
                        ))}
                        <div>
                          <label className="block text-sm font-body font-semibold text-gray-700 mb-1">Type</label>
                          <div className="flex gap-3">
                            {['Home', 'Office'].map((t) => (
                              <button
                                key={t} type="button"
                                onClick={() => setAddrForm((p) => ({ ...p, type: t }))}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-body font-medium transition-all ${addrForm.type === t ? 'border-brand-green bg-brand-green/10 text-brand-green' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                              >
                                {t === 'Office' ? <Briefcase className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={addrForm.isDefault}
                            onChange={(e) => setAddrForm((p) => ({ ...p, isDefault: e.target.checked }))}
                            className="w-4 h-4 accent-brand-green" />
                          <span className="text-sm font-body font-medium text-gray-700">Set as default address</span>
                        </label>
                      </div>
                      <div className="flex gap-3 mt-5">
                        <button onClick={() => setShowAddrModal(false)} className="flex-1 btn-outline">Cancel</button>
                        <button onClick={handleSaveAddr} className="flex-1 btn-primary">{editAddr ? 'Update' : 'Save Address'}</button>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Delete confirm */}
                {deleteAddrId && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
                      <div className="text-4xl mb-3">🗑️</div>
                      <h3 className="font-body font-bold text-gray-800 text-lg mb-2">Delete Address?</h3>
                      <p className="text-sm text-gray-500 font-body mb-5">This address will be removed permanently.</p>
                      <div className="flex gap-3">
                        <button onClick={() => setDeleteAddrId(null)} className="flex-1 btn-outline">Cancel</button>
                        <button onClick={handleDeleteAddr} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-body font-semibold transition-colors">Delete</button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── One order in "My Orders": items, payment, return/refund status, cancel + return actions ──────────
function OrderCard({ order, onChanged, autoOpen = false, onAutoOpened }) {
  const dispatch = useAppDispatch();
  const cardRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [noInvoice, setNoInvoice] = useState(false);

  const o = detail || order;
  const ret = o.return;

  const loadDetail = async () => {
    const res = await dispatch(fetchOrderDetail(order.id));
    if (fetchOrderDetail.fulfilled.match(res)) setDetail(res.payload);
    else toast.error(res.payload || 'Could not load order details');
  };
  const toggle = () => { if (!open && !detail) loadDetail(); setOpen(!open); };

  // opened from an email link (?order=<id>): expand once and bring it into view
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpened.current) return;
    autoOpened.current = true;
    onAutoOpened?.();
    setOpen(true);
    dispatch(fetchOrderDetail(order.id)).then((res) => { if (fetchOrderDetail.fulfilled.match(res)) setDetail(res.payload); });
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [autoOpen, dispatch, order.id, onAutoOpened]);

  const doCancel = async () => {
    if (!cancelReason.trim()) { toast.error('Please tell us why you are cancelling'); return; }
    setBusy(true);
    const res = await dispatch(cancelOrder({ orderId: order.id, reason: cancelReason.trim() }));
    setBusy(false);
    if (cancelOrder.fulfilled.match(res)) {
      toast.success(res.payload?.message || 'Order cancelled', { style: { borderRadius: '12px' } });
      setShowCancel(false); setDetail(null); setOpen(false); onChanged();
    } else toast.error(res.payload || 'Failed to cancel order');
  };

  // GST invoice PDF (404 = not generated yet → friendly message, hide the link for this card)
  const downloadInvoice = async () => {
    setInvoiceBusy(true);
    try {
      const { blob, filename } = await fetchFile(`/invoices/order/${order.id}/pdf`);
      saveBlob(blob, filename || invoiceFileName(o.orderNumber || order.id));
    } catch (err) {
      if (err.response?.status === 404) {
        setNoInvoice(true);
        toast("Your invoice isn't ready yet — it will be available once your order is confirmed.", { icon: '🧾', style: { borderRadius: '12px' } });
      } else toast.error(await fileErrorMessage(err, 'Could not download the invoice'));
    }
    setInvoiceBusy(false);
  };

  const doCancelReturn = async () => {
    if (!window.confirm('Cancel this return request?')) return;
    const res = await dispatch(cancelReturn(ret.id));
    if (cancelReturn.fulfilled.match(res)) { toast.success('Return request cancelled'); setDetail(null); setOpen(false); onChanged(); }
    else toast.error(res.payload || 'Failed to cancel return');
  };

  return (
    <div className="card p-6 scroll-mt-24" ref={cardRef}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-body font-semibold text-gray-800 text-sm">#{o.orderNumber || o.id}</div>
          <div className="text-xs text-gray-400 mt-0.5">{asDate(o.createdAt || o.date)?.toLocaleDateString('en-IN')}</div>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusColor[orderLabel(o.status)] || statusColor[human(o.status)] || 'bg-gray-100 text-gray-600'}`}>
          {orderLabel(o.status)}
        </span>
      </div>
      <div className="text-sm text-gray-600 mb-1">
        {o.items?.map((i) => `${i.productName || i.name}${i.weight ? ` (${i.weight})` : ''} × ${i.quantity}`).join(', ') || 'Order items'}
      </div>
      <div className="text-xs text-gray-400 mb-3">{payLabel(o.paymentMethod, o.paymentStatus)}{Number(o.refundedAmount) > 0 && ` · ₹${o.refundedAmount} refunded`}</div>
      {ret && (
        <div className="bg-orange-50 rounded-xl p-3 text-xs text-orange-700 mb-3">
          Return <strong>{ret.returnNumber}</strong>: {human(ret.status)}
          {ret.status === 'Refunded'
            ? <> · ₹{ret.refundAmount} refunded via {human(ret.refundMethod)}{ret.refundReferenceId && ` (ref ${ret.refundReferenceId})`}</>
            : ret.status === 'Rejected' ? <> · {ret.rejectionReason}</> : <> · refund ₹{ret.refundAmount} after we receive the items</>}
          {ret.courierName && ret.status === 'PickedUp' && <> · picked up by {ret.courierName}{ret.awbNumber && ` (AWB ${ret.awbNumber})`}</>}
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-heading font-bold text-brand-green">₹{o.grandTotal || o.total}</span>
        <div className="flex items-center gap-3">
          <button onClick={toggle} className="text-xs text-gray-500 hover:underline">{open ? 'Hide details' : 'View details'}</button>
          {o.canCancel && <button onClick={() => setShowCancel(true)} className="text-xs text-brand-red hover:underline">Cancel Order</button>}
          {o.canReturn && <button onClick={() => { if (!detail) loadDetail(); setShowReturn(true); }} className="text-xs text-brand-orange hover:underline">Request Return</button>}
          {ret && ['Requested', 'Approved'].includes(ret.status) && <button onClick={doCancelReturn} className="text-xs text-gray-500 hover:underline">Cancel Return</button>}
          {!noInvoice && <button onClick={downloadInvoice} disabled={invoiceBusy} className="text-xs text-brand-green hover:underline disabled:opacity-50">{invoiceBusy ? 'Downloading…' : 'Download invoice'}</button>}
          <Link to={`/track-order?order=${o.orderNumber || o.id}`} className="text-xs text-brand-green hover:underline">Track Order</Link>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm space-y-3">
          {!detail ? <div className="text-xs text-gray-400">Loading…</div> : (
            <>
              <div className="space-y-1">
                {detail.items.map((i) => (
                  <div key={i.id} className="flex justify-between text-gray-600">
                    <span>{i.productName} {i.weight && <span className="text-gray-400">({i.weight})</span>} × {i.quantity}</span>
                    <span>₹{i.lineTotal}</span>
                  </div>
                ))}
                <div className="flex justify-between text-gray-500 text-xs pt-1"><span>Subtotal</span><span>₹{detail.subtotal}</span></div>
                {Number(detail.couponDiscount) > 0 && <div className="flex justify-between text-green-600 text-xs"><span>Coupon {detail.couponCode}</span><span>-₹{detail.couponDiscount}</span></div>}
                <div className="flex justify-between text-gray-500 text-xs"><span>Delivery</span><span>{Number(detail.deliveryCharge) === 0 ? 'FREE' : `₹${detail.deliveryCharge}`}</span></div>
                <div className="flex justify-between font-semibold text-gray-800"><span>Total</span><span>₹{detail.grandTotal}</span></div>
              </div>
              <div className="text-xs text-gray-500">
                Deliver to: {detail.deliveryAddress?.name}, {detail.deliveryAddress?.addressLine}, {detail.deliveryAddress?.city}, {detail.deliveryAddress?.state} - {detail.deliveryAddress?.pincode}
              </div>
              {detail.courier && <div className="text-xs text-gray-500">Courier: {detail.courier}{detail.awbNumber && ` · AWB ${detail.awbNumber}`}</div>}
              {detail.payment?.gatewayPaymentId && <div className="text-xs text-gray-500">Payment ID: {detail.payment.gatewayPaymentId}</div>}
              {detail.cancellationReason && <div className="text-xs text-gray-500">Cancellation reason: {detail.cancellationReason}</div>}
              {ret?.id && <ReturnPhotos returnId={ret.id} />}
              {detail.history?.length > 0 && (
                <div className="space-y-1">
                  {detail.history.map((h, idx) => (
                    <div key={idx} className="flex gap-2 text-xs">
                      <span className="text-gray-400 whitespace-nowrap">{asDate(h.createdAt)?.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-gray-700 font-medium">{orderLabel(h.status)}</span>
                      {h.note && <span className="text-gray-500">— {h.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-body font-bold text-gray-800 text-lg mb-2">Cancel order #{o.orderNumber}?</h3>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} maxLength={300} placeholder="Reason for cancelling" className="input-field mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)} className="flex-1 btn-outline">Keep Order</button>
              <button onClick={doCancel} disabled={busy} className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-body font-semibold transition-colors disabled:opacity-50">Cancel Order</button>
            </div>
          </motion.div>
        </div>
      )}

      {showReturn && detail && (
        <ReturnModal order={detail} onClose={() => setShowReturn(false)} onDone={() => { setShowReturn(false); setDetail(null); setOpen(false); onChanged(); }} />
      )}
    </div>
  );
}

function ReturnModal({ order, onClose, onDone }) {
  const dispatch = useAppDispatch();
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState(() => order.items.map((i) => ({ orderItemId: i.id, name: `${i.productName}${i.weight ? ` (${i.weight})` : ''}`, max: i.quantity, quantity: i.quantity, selected: true, condition: 'Unopened' })));
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState([]); // [{ file, url }]

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = (fileList) => {
    const next = [...photos];
    for (const f of Array.from(fileList || [])) {
      if (next.length >= MAX_PHOTOS) { toast.error(`You can attach up to ${MAX_PHOTOS} photos`); break; }
      if (!PHOTO_TYPES.includes(f.type)) { toast.error(`${f.name}: only JPG, PNG or WebP images`); continue; }
      if (f.size > MAX_PHOTO_BYTES) { toast.error(`${f.name} is larger than 5 MB`); continue; }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPhotos(next);
  };
  const removePhoto = (idx) => setPhotos((ps) => { URL.revokeObjectURL(ps[idx].url); return ps.filter((_, i) => i !== idx); });

  const chosen = lines.filter((l) => l.selected && l.quantity > 0);
  const payload = chosen.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity, reason: reason.trim(), condition: l.condition }));
  const key = JSON.stringify(payload.map((p) => [p.orderItemId, p.quantity]));

  useEffect(() => {
    if (!chosen.length) { setPreview(null); return; }
    dispatch(previewReturn({ orderId: order.id, items: payload })).then((res) => {
      if (previewReturn.fulfilled.match(res)) setPreview(res.payload);
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (idx, patch) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (!chosen.length) { toast.error('Select at least one item to return'); return; }
    if (!reason.trim()) { toast.error('Please tell us why you are returning'); return; }
    const body = { orderId: order.id, type: 'Refund', reason: reason.trim(), items: payload, preferredRefundMethod: 'OriginalPaymentMethod' };
    const done = (r) => {
      toast.success(`Return ${r?.returnNumber || ''} requested. We'll arrange a pickup.`, { icon: '📦', style: { borderRadius: '12px' } });
      onDone();
    };
    setBusy(true);
    if (photos.length) {
      // multipart: the same JSON body + up to 5 photos (validated again on the server)
      const fd = new FormData();
      fd.append('request', JSON.stringify(body));
      photos.forEach((p) => fd.append('photos', p.file, p.file.name));
      try {
        const res = await api.post('/returns', fd, { timeout: 120000 });
        setBusy(false);
        done(res.data?.data);
      } catch (err) {
        setBusy(false);
        toast.error(err.response?.data?.error?.message || 'Failed to submit return request');
      }
      return;
    }
    const res = await dispatch(requestReturn(body));
    setBusy(false);
    if (requestReturn.fulfilled.match(res)) done(res.payload);
    else toast.error(res.payload || 'Failed to submit return request');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-body font-bold text-lg text-gray-900">Return items from #{order.orderNumber}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {lines.map((l, idx) => (
            <div key={l.orderItemId} className="border border-gray-100 rounded-xl p-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={l.selected} onChange={(e) => setLine(idx, { selected: e.target.checked })} className="w-4 h-4 accent-brand-green" />
                <span className="text-sm font-medium text-gray-800 flex-1">{l.name}</span>
              </label>
              {l.selected && (
                <div className="flex gap-3 mt-2">
                  <select value={l.quantity} onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} className="input-field py-2 text-sm w-24">
                    {Array.from({ length: l.max }, (_, n) => n + 1).map((n) => <option key={n} value={n}>Qty {n}</option>)}
                  </select>
                  <select value={l.condition} onChange={(e) => setLine(idx, { condition: e.target.value })} className="input-field py-2 text-sm flex-1">
                    {RETURN_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
          <div>
            <label className="block text-sm font-body font-semibold text-gray-700 mb-1">Reason *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="What went wrong?" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-body font-semibold text-gray-700 mb-1">Photos <span className="font-normal text-gray-400">(optional, up to {MAX_PHOTOS})</span></label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, idx) => (
                <div key={p.url} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100">
                  <img src={p.url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(idx)} aria-label="Remove photo" className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-brand-green hover:text-brand-green cursor-pointer">
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Add</span>
                  <input type="file" accept={PHOTO_TYPES.join(',')} multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                </label>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">JPG, PNG or WebP · max 5 MB each. Photos of the damage help us approve faster.</div>
          </div>
          {preview && (
            <div className="bg-brand-cream rounded-xl p-3 text-sm text-gray-700">
              Estimated refund: <strong className="text-brand-green">₹{preview.taxSummary?.grandRefundAmount}</strong>
              {preview.taxSummary?.deliveryNote && <div className="text-xs text-gray-600 mt-0.5">{preview.taxSummary.deliveryNote}</div>}
              <div className="text-xs text-gray-500 mt-0.5">Refunded to your original payment method once we receive the items.</div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 btn-primary disabled:opacity-50">Submit Return</button>
        </div>
      </motion.div>
    </div>
  );
}

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Return photos are private: fetched with the customer's token and shown from in-memory blob URLs
function ReturnPhotos({ returnId }) {
  const [urls, setUrls] = useState([]);
  const [big, setBig] = useState(null);
  useEffect(() => {
    let alive = true;
    const made = [];
    (async () => {
      try {
        const res = await api.get(`/returns/${returnId}`);
        const list = res.data?.data?.photos || [];
        for (const p of list) {
          const b = await api.get(p.url, { responseType: 'blob' });
          const u = URL.createObjectURL(b.data);
          made.push(u);
          if (alive) setUrls((x) => [...x, u]);
        }
      } catch { /* photos are optional — the return itself is shown above */ }
    })();
    return () => { alive = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [returnId]);
  if (!urls.length) return null;
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">Your return photos</div>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <button key={u} type="button" onClick={() => setBig(u)} className="w-14 h-14 rounded-lg overflow-hidden border border-gray-100">
            <img src={u} alt={`Return photo ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {big && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setBig(null)}>
          <img src={big} alt="Return photo" className="max-w-full max-h-[85vh] rounded-xl" />
          <button type="button" onClick={() => setBig(null)} aria-label="Close" className="absolute top-4 right-4 bg-white rounded-full p-2"><X className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
}
