import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart, Plus, Minus, Trash2, Package } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeDrawer, removeItem, updateQuantity, lineKey, useStoreSettings, useCartQuote } from '@/store/slices/cartSlice';

export default function CartDrawer() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.cart.items);
  const isOpen = useAppSelector((s) => s.cart.drawerOpen);

  const totalItems = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
  // Server quote (same pricing as checkout); store settings + local maths until it arrives
  const settings = useStoreSettings();
  const { quote } = useCartQuote();
  const localPrice = items.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0);
  const localMrp = items.reduce((sum, i) => sum + (i.mrp || i.price) * (i.quantity || 1), 0);
  const totalPrice = quote ? quote.subtotal - quote.couponDiscount : localPrice;
  const totalMrp = quote ? quote.subtotalMrp : localMrp;
  const savings = totalMrp - totalPrice;
  const freeAbove = Number(quote?.freeDeliveryAbove ?? settings?.freeDeliveryAbove ?? 0);
  const deliveryCharge = quote ? quote.deliveryCharge
    : (settings && freeAbove > 0 && totalPrice < freeAbove ? Number(settings.deliveryCharge || 0) : 0);
  const amountForFree = quote ? quote.amountForFreeDelivery : (freeAbove > 0 ? Math.max(0, freeAbove - totalPrice) : 0);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 animate-fade-in" onClick={() => dispatch(closeDrawer())} />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-green" />
            <h2 className="font-heading font-bold text-xl text-brand-green-dark">My Cart ({totalItems})</h2>
          </div>
          <button onClick={() => dispatch(closeDrawer())} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-24 h-24 bg-brand-green/10 rounded-full flex items-center justify-center mb-4">
                <Package className="w-12 h-12 text-brand-green/50" />
              </div>
              <h3 className="font-heading font-semibold text-xl text-gray-700 mb-2">Your cart is empty</h3>
              <p className="text-gray-500 text-sm mb-6">Add some delicious Wah Spices masala to get started</p>
              <button onClick={() => dispatch(closeDrawer())} className="btn-primary">Shop Now</button>
            </div>
          ) : (
            items.map((item) => (
              <div key={lineKey(item)} className="flex gap-4 p-4 rounded-2xl border border-gray-100 hover:border-brand-green/20 transition-colors">
                <div
                  className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: item.bgColor || '#1a5c2e' }}
                >
                  {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                    : <img src="/wah_logo.jpg" alt="Wah Spices" className="w-12 h-10 object-contain rounded" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-body font-semibold text-gray-800 text-sm line-clamp-1">{item.name}</h4>
                  <p className="text-xs text-gray-400 mb-2">{item.weight}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-brand-green">₹{item.price}</span>
                      {item.mrp > item.price && <span className="text-xs text-gray-400 line-through ml-1">₹{item.mrp}</span>}
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                      <button
                        onClick={() => dispatch(updateQuantity({ key: lineKey(item), quantity: (item.quantity || 1) - 1 }))}
                        className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-brand-green hover:text-white transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-5 text-center">{item.quantity || 1}</span>
                      <button
                        onClick={() => dispatch(updateQuantity({ key: lineKey(item), quantity: (item.quantity || 1) + 1 }))}
                        className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-brand-green hover:text-white transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => dispatch(removeItem(lineKey(item)))} className="text-gray-300 hover:text-brand-red transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-gray-100 space-y-4">
            {savings > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600 font-medium">🎉 You save ₹{savings}!</span>
                <span className="text-gray-400 line-through">MRP ₹{totalMrp}</span>
              </div>
            )}
            {(settings || quote) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Delivery</span>
                <span className={deliveryCharge === 0 ? 'text-green-600 font-medium' : 'text-gray-800'}>{deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}</span>
              </div>
            )}
            {deliveryCharge > 0 && amountForFree > 0 && (
              <div className="bg-orange-50 rounded-xl p-2.5 text-xs text-orange-700">Add ₹{amountForFree} more for <strong>FREE delivery</strong>!</div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-body font-semibold text-gray-700">Total</span>
              <span className="font-heading font-bold text-2xl text-brand-green">₹{totalPrice + deliveryCharge}</span>
            </div>
            <Link to="/checkout" onClick={() => dispatch(closeDrawer())} className="btn-primary w-full text-center block">
              Proceed to Checkout
            </Link>
            <button onClick={() => dispatch(closeDrawer())} className="w-full text-center text-sm text-gray-500 hover:text-brand-green transition-colors">
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
