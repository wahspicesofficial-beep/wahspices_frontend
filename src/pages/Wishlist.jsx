import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { removeFromWishlist } from '@/store/slices/wishlistSlice';
import { addItem } from '@/store/slices/cartSlice';
import { toCartItem } from '@/utils/product';
import toast from 'react-hot-toast';

export default function Wishlist() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.wishlist.items);

  const handleAddToCart = (product) => {
    dispatch(addItem(toCartItem(product)));
    toast.success(`${product.name} added to cart!`, { icon: '🛒', style: { borderRadius: '12px' } });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-32 h-32 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-16 h-16 text-brand-red/40" />
          </div>
          <h2 className="text-3xl font-heading font-bold text-gray-700 mb-3">Wishlist is empty</h2>
          <p className="text-gray-500 mb-8">Save your favourite masalas for later!</p>
          <Link to="/products" className="btn-primary inline-flex items-center gap-2">
            Explore Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-10">
        <div className="container-custom">
          <h1 className="text-3xl font-heading font-bold">My Wishlist ({items.length} item{items.length > 1 ? 's' : ''})</h1>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((product, i) => (
            <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl shadow-card overflow-hidden">
              <Link to={`/product/${product.slug}`}>
                <div className="relative h-48 flex items-center justify-center" style={{ backgroundColor: product.image ? '#f5f5f5' : (product.bgColor || '#1a5c2e') }}>
                  {product.image
                    ? <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                    : <img src="/wah_logo.jpg" alt="Wah Spices" className="w-20 h-16 object-contain" />
                  }
                </div>
              </Link>
              <div className="p-4">
                <Link to={`/product/${product.slug}`}>
                  <h3 className="font-body font-semibold text-gray-800 mb-1 hover:text-brand-green transition-colors">{product.name}</h3>
                </Link>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-bold text-brand-green">₹{product.price}</span>
                  {product.mrp > product.price && <span className="text-xs text-gray-400 line-through">₹{product.mrp}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAddToCart(product)} className="flex-1 btn-primary text-sm flex items-center justify-center gap-1.5 py-2">
                    <ShoppingCart className="w-4 h-4" />Add to Cart
                  </button>
                  <button onClick={() => dispatch(removeFromWishlist(product.id))} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-brand-red hover:border-brand-red transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
