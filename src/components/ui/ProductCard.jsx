import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Star, MapPin } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addItem } from '@/store/slices/cartSlice';
import { toggleWishlistItem } from '@/store/slices/wishlistSlice';
import toast from 'react-hot-toast';
import { defaultVariant, toCartItem, isPurchasable } from '@/utils/product';

export default function ProductCard({ product }) {
  const [isHovered, setIsHovered] = useState(false);
  const dispatch = useAppDispatch();
  const wishlistItems = useAppSelector((s) => s.wishlist.items);
  const wishlisted = wishlistItems.some((i) => i.id === product.id);

  const variant = defaultVariant(product);
  const price = variant?.price ?? product.price;
  const mrp = variant?.mrp ?? product.mrp;
  const weight = variant?.weight ?? product.weight;
  const sizeCount = product.variants?.length || 0;
  const outOfStock = !isPurchasable(product);
  const [imgSrc, setImgSrc] = useState(product.thumb || product.image);
  // Image failures are often temporary (API restarting, flaky network): thumb → full image → retry a few
  // times with back-off, and once more when the tab regains focus or the network comes back.
  const retries = useRef(0);
  const retryTimer = useRef(null);
  const original = product.thumb || product.image;
  useEffect(() => { retries.current = 0; setImgSrc(original); }, [original]);
  useEffect(() => () => clearTimeout(retryTimer.current), []);
  useEffect(() => {
    if (imgSrc || !original) return undefined;
    const again = () => { retries.current = 0; setImgSrc(original); };
    window.addEventListener('online', again);
    window.addEventListener('focus', again);
    return () => { window.removeEventListener('online', again); window.removeEventListener('focus', again); };
  }, [imgSrc, original]);
  const handleImgError = () => {
    const base = (imgSrc || '').split('?')[0];
    if (product.image && base !== product.image.split('?')[0] && retries.current === 0) { setImgSrc(product.image); return; }
    if (retries.current < 3) {
      retries.current += 1;
      const n = retries.current;
      setImgSrc(null);
      retryTimer.current = setTimeout(() => setImgSrc(`${original}${original.includes('?') ? '&' : '?'}retry=${n}`), 1500 * n);
      return;
    }
    setImgSrc(null);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (outOfStock) return;
    dispatch(addItem(toCartItem(product, variant)));
    toast.success(`${product.name}${weight ? ` (${weight})` : ''} added to cart!`, {
      icon: '🛒',
      style: { borderRadius: '12px', fontFamily: 'Poppins, sans-serif' },
    });
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    dispatch(toggleWishlistItem(product));
    toast.success(wishlisted ? 'Removed from wishlist' : `${product.name} added to wishlist!`, {
      icon: wishlisted ? '💔' : '❤️',
      style: { borderRadius: '12px', fontFamily: 'Poppins, sans-serif' },
    });
  };

  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <Link to={`/product/${product.slug}`} className="block">
      <div
        className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ transform: isHovered ? 'translateY(-4px)' : 'translateY(0)' }}
      >
        <div
          className={`relative flex items-center justify-center overflow-hidden ${imgSrc ? 'aspect-[4/5]' : 'h-52'}`}
          style={{ backgroundColor: imgSrc ? '#f5efe3' : (product.bgColor || '#1a5c2e') }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={handleImgError}
              className="w-full h-full object-contain transition-transform duration-300"
              style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
            />
          ) : (
            <>
              <div className="absolute w-36 h-36 bg-white/5 rounded-full -top-10 -right-10" />
              <div className="absolute w-24 h-24 bg-white/5 rounded-full -bottom-6 -left-6" />
              <div
                className="relative z-10 flex flex-col items-center gap-2 transition-transform duration-300"
                style={{ transform: isHovered ? 'scale(1.08)' : 'scale(1)' }}
              >
                <div className="w-20 h-28 bg-white/10 backdrop-blur-sm rounded-xl border-2 border-white/25 flex flex-col items-center justify-center p-2 shadow-lg">
                  <img src="/wah_logo.jpg" alt="Wah Spices" className="w-14 h-10 object-contain rounded" />
                  <div className="w-8 h-px bg-white/40 mb-1" />
                  <div className="text-white/90 font-body text-center text-[10px] leading-tight font-medium">{product.name}</div>
                  <div className="mt-2 text-white/50 text-[9px] font-body">{weight}</div>
                </div>
              </div>
            </>
          )}

          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {outOfStock && (
              <span className="bg-gray-800/85 text-white text-[10px] font-body font-bold px-2 py-0.5 rounded-full shadow">
                Out of stock
              </span>
            )}
            {discount > 0 && (
              <span className="bg-brand-red text-white text-[10px] font-body font-bold px-2 py-0.5 rounded-full shadow">
                {discount}% OFF
              </span>
            )}
            {product.badge && (
              <span className="bg-brand-orange text-white text-[10px] font-body font-bold px-2 py-0.5 rounded-full shadow">
                {product.badge}
              </span>
            )}
          </div>

          <button
            onClick={handleWishlist}
            className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 shadow ${
              wishlisted ? 'bg-brand-red text-white' : 'bg-white/85 text-gray-400 hover:text-brand-red hover:bg-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5" fill={wishlisted ? 'currentColor' : 'none'} />
          </button>

          {product.state && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/35 backdrop-blur-sm text-white text-[10px] font-body px-2 py-0.5 rounded-full">
              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate max-w-[80px]">{product.state}</span>
            </div>
          )}
        </div>

        <div className="p-3.5">
          <h3 className="font-body font-semibold text-gray-800 text-sm mb-0.5 truncate">{product.name}</h3>
          {weight && (
            <p className="text-[11px] text-gray-500 font-body mb-1">
              {weight}{sizeCount > 1 && <span className="text-brand-green font-medium"> · +{sizeCount - 1} more size{sizeCount > 2 ? 's' : ''}</span>}
            </p>
          )}

          {product.stateLabel && (
            <p className="text-[11px] text-gray-400 font-body mb-2 truncate">{product.stateLabel}</p>
          )}

          <div className="flex items-center gap-1 mb-3">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-2.5 h-2.5"
                  fill={i < Math.floor(product.rating || 0) ? '#f5a623' : 'none'}
                  stroke={i < Math.floor(product.rating || 0) ? '#f5a623' : '#e5e7eb'}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-400 font-body">
              ({product.reviews >= 1000 ? `${(product.reviews / 1000).toFixed(1)}k` : (product.reviews || 0)})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-body font-bold text-brand-green text-base">₹{price}</span>
              {mrp > price && <span className="font-body text-xs text-gray-400 line-through">₹{mrp}</span>}
            </div>

            <button
              onClick={handleAddToCart}
              disabled={outOfStock}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-body font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: isHovered && !outOfStock ? '#1a5c2e' : '#1a5c2e15', color: isHovered && !outOfStock ? '#fff' : '#1a5c2e' }}
            >
              <ShoppingCart className="w-3 h-3" />
              {outOfStock ? 'Out of stock' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
