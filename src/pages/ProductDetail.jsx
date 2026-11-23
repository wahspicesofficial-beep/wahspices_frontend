import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, Star, MapPin, Check, Leaf, Shield, ChevronRight, Plus, Minus, Share2, BadgeCheck, Clock } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchProductBySlug, fetchRelatedProducts, fetchProductReviews, fetchMyReview, submitReview } from '@/store/slices/productSlice';
import { addItem, openDrawer } from '@/store/slices/cartSlice';
import { toggleWishlistItem } from '@/store/slices/wishlistSlice';
import ProductCard from '@/components/ui/ProductCard';
import { SkProductDetail } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { defaultVariant, toCartItem, prettyCategory, isPurchasable } from '@/utils/product';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  const { currentProduct: product, relatedProducts, reviews, reviewsTotal, reviewsPage, reviewsLoading, myReview, loading } = useAppSelector((s) => s.products);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const storeSettings = useAppSelector((s) => s.siteContent?.settings);
  const wishlistItems = useAppSelector((s) => s.wishlist.items);
  const wishlisted = product ? wishlistItems.some((i) => i.id === product.id) : false;

  useEffect(() => {
    dispatch(fetchProductBySlug(slug));
  }, [dispatch, slug]);

  useEffect(() => {
    if (product?.id) {
      dispatch(fetchRelatedProducts({ id: product.id, category: product.category }));
      dispatch(fetchProductReviews(product.id));
      if (isAuthenticated) dispatch(fetchMyReview(product.id));
      setSelectedVariantId(defaultVariant(product)?.id ?? null);
      setQuantity(1);
    }
  }, [dispatch, product?.id, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !product) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <SkProductDetail />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <div className="text-6xl mb-4">🫙</div>
          <h2 className="text-2xl font-heading font-bold text-gray-700 mb-2">Product not found</h2>
          <Link to="/products" className="btn-primary">Browse Products</Link>
        </div>
      </div>
    );
  }

  const variants = product.variants || [];
  const variant = variants.find((v) => v.id === selectedVariantId) || defaultVariant(product);
  const price = variant?.price ?? product.price;
  const mrp = variant?.mrp ?? product.mrp;
  const weight = variant?.weight ?? product.weight;
  const inStock = isPurchasable(product, variant);
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  // Rating / count come from approved reviews only (recomputed by the backend on every moderation)
  const reviewCount = Number(product.reviews) || 0;
  const rating = reviewCount > 0 ? Number(product.rating) || 0 : 0;
  const ratingText = rating.toFixed(1);
  const freeAbove = storeSettings?.freeDeliveryAbove;
  const deliveryDays = storeSettings?.avgDeliveryDays;

  const handleAddToCart = () => {
    if (!inStock) return;
    dispatch(addItem({ ...toCartItem(product, variant), quantity }));
    toast.success(`${product.name}${weight ? ` (${weight})` : ''} added to cart!`, { icon: '🛒', style: { borderRadius: '12px' } });
    dispatch(openDrawer());
  };

  const handleBuyNow = () => {
    if (!inStock) return;
    dispatch(addItem({ ...toCartItem(product, variant), quantity }));
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-white border-b border-gray-100">
        <div className="container-custom py-3 flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-brand-green">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to="/products" className="hover:text-brand-green">Products</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-brand-green font-medium">{product.name}</span>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div
              className={`relative rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl ${product.image ? 'aspect-[4/5] w-full max-w-[512px] mx-auto' : 'aspect-square'}`}
              style={{ backgroundColor: product.image ? '#f5efe3' : (product.bgColor || '#1a5c2e') }}
            >
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
              ) : (
                <>
                  <div className="absolute w-64 h-64 bg-white/5 rounded-full -top-16 -right-16" />
                  <div className="absolute w-48 h-48 bg-white/5 rounded-full -bottom-12 -left-12" />
                  <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-44 h-60 bg-white/10 backdrop-blur-sm rounded-2xl border-4 border-white/25 flex flex-col items-center justify-center p-4 shadow-2xl">
                      <img src="/wah_logo.jpg" alt="Wah Spices" className="w-24 h-16 object-contain rounded-lg mb-1" />
                      <div className="w-20 h-0.5 bg-white/30 my-2" />
                      <div className="text-white font-heading font-semibold text-lg text-center leading-tight">{product.name}</div>
                      <div className="mt-3 text-white/70 text-xs">{weight}</div>
                    </div>
                  </motion.div>
                </>
              )}
              {discount > 0 && <div className="absolute top-4 left-4 bg-brand-red text-white text-sm font-bold px-3 py-1 rounded-full">{discount}% OFF</div>}
              {product.badge && <div className="absolute top-4 right-4 bg-brand-orange text-white text-sm font-bold px-3 py-1 rounded-full">{product.badge}</div>}
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[{ icon: Leaf, label: 'Natural', color: 'text-green-500' }, { icon: Shield, label: 'FSSAI', color: 'text-blue-500' }, { icon: Check, label: 'Veg', color: 'text-green-600' }, { icon: '🇮🇳', label: 'Made in India', isEmoji: true }].map((item) => (
                <div key={item.label} className="bg-white rounded-xl p-3 text-center shadow-card">
                  {item.isEmoji ? <div className="text-2xl mb-1">{item.icon}</div> : <item.icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />}
                  <div className="text-xs text-gray-600 font-body">{item.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div className="flex items-center gap-2">
              <Link to={`/products?category=${product.category}`} className="badge-green">{prettyCategory(product.category)}</Link>
              {product.subCategory && <Link to={`/products?category=${product.category}&sub=${product.subCategory}`} className="badge bg-orange-50 text-orange-700 text-xs">{prettyCategory(product.subCategory)}</Link>}
              {product.state && <span className="badge bg-orange-50 text-orange-700 text-xs"><MapPin className="w-3 h-3" /> {product.state}</span>}
            </div>

            <h1 className="text-3xl md:text-4xl font-body font-black text-brand-green-dark leading-tight">{product.name}</h1>

            <div className="flex items-center gap-3">
              {reviewCount > 0 && (
                <div className="flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-xl">
                  <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                  <span className="font-bold text-sm text-gray-800">{ratingText}</span>
                </div>
              )}
              <button type="button" onClick={() => setActiveTab('reviews')} className="text-sm text-gray-500 hover:text-brand-green">
                {reviewCount > 0 ? `${reviewCount.toLocaleString()} review${reviewCount === 1 ? '' : 's'}` : 'No reviews yet'}
              </button>
              <span className={`text-sm font-medium ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                {inStock ? '✓ In Stock' : '✗ Out of Stock'}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-body font-black text-brand-green">₹{price}</span>
              {mrp > price && <span className="text-base text-gray-400 line-through font-body">₹{mrp}</span>}
              {discount > 0 && <span className="bg-green-50 text-green-600 text-sm font-bold px-2 py-0.5 rounded-lg">{discount}% OFF</span>}
            </div>
            <p className="text-xs text-gray-400 -mt-3">MRP inclusive of all taxes{weight ? ` · ${weight} pack` : ''}</p>

            {variants.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Select Pack Size:</div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const active = v.id === variant?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!v.inStock}
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`min-w-[84px] px-3 py-2 rounded-xl border-2 text-left transition-all ${
                          active ? 'border-brand-green bg-brand-green/5 shadow-sm' : 'border-gray-200 bg-white hover:border-brand-green/50'
                        } ${!v.inStock ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                      >
                        <div className={`text-sm font-bold ${active ? 'text-brand-green' : 'text-gray-800'}`}>{v.weight}</div>
                        <div className="text-xs text-gray-500">₹{v.price}{v.mrp > v.price && <span className="line-through ml-1 text-gray-300">₹{v.mrp}</span>}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-gray-600 leading-relaxed">{product.description}</p>

            {product.usages?.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Perfect for:</div>
                <div className="flex flex-wrap gap-2">
                  {product.usages.map((use) => <span key={use} className="badge-orange text-xs">{use}</span>)}
                </div>
              </div>
            )}

            <div className="bg-brand-cream rounded-2xl p-4">
              {weight && <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Net Weight</span><span className="font-semibold text-gray-800">{weight}</span></div>}
              {product.packType && <div className="flex items-center justify-between text-sm mt-2"><span className="text-gray-600">Pack Type</span><span className="font-semibold text-gray-800">{({ BoxPack: 'Box Pack', PouchPack: 'Pouch Pack', GlassJar: 'Glass Jar' })[product.packType] || product.packType}</span></div>}
              {product.hsnCode && <div className="flex items-center justify-between text-sm mt-2"><span className="text-gray-600">HSN Code</span><span className="font-semibold text-gray-800">{product.hsnCode}</span></div>}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">Quantity:</span>
              <div className="flex items-center gap-3 bg-gray-100 rounded-xl p-1">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-brand-green hover:text-white transition-colors"><Minus className="w-4 h-4" /></button>
                <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-brand-green hover:text-white transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
              <span className="text-sm text-gray-500">Total: <strong className="text-brand-green">₹{price * quantity}</strong></span>
            </div>

            <div className="flex gap-3">
              <button onClick={handleAddToCart} disabled={!inStock} className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <ShoppingCart className="w-5 h-5" />{inStock ? 'Add to Cart' : 'Out of Stock'}
              </button>
              <button onClick={handleBuyNow} disabled={!inStock} className="flex-1 btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                Buy Now
              </button>
              <button
                onClick={() => { dispatch(toggleWishlistItem(product)); toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist!', { icon: wishlisted ? '💔' : '❤️', style: { borderRadius: '12px' } }); }}
                className={`p-3 rounded-xl border-2 transition-all ${wishlisted ? 'border-brand-red bg-brand-red/5 text-brand-red' : 'border-gray-200 text-gray-400 hover:border-brand-red hover:text-brand-red'}`}
              >
                <Heart className="w-5 h-5" fill={wishlisted ? 'currentColor' : 'none'} />
              </button>
              <button className="p-3 rounded-xl border-2 border-gray-200 text-gray-400 hover:border-brand-green hover:text-brand-green transition-all">
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-green-50 rounded-2xl p-4 text-sm">
              <div className="flex items-center gap-2 text-green-700"><span className="text-lg">🚚</span><span className="font-medium">{freeAbove > 0 ? `Free delivery on orders above ₹${freeAbove}` : freeAbove === 0 ? 'Free delivery on all orders' : 'Free delivery on orders above ₹499'}</span></div>
              <div className="flex items-center gap-2 text-green-600 mt-1.5"><span className="text-lg">📦</span><span>{deliveryDays ? `Usually delivered in ${deliveryDays} business days` : 'Usually delivered in 3-5 business days'}</span></div>
            </div>
          </motion.div>
        </div>

        <div className="bg-white rounded-3xl shadow-card overflow-hidden mb-12">
          <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
            {['description', 'ingredients', 'nutrition', 'reviews'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 font-body font-medium text-sm capitalize whitespace-nowrap transition-all border-b-2 ${activeTab === tab ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="p-8">
            {activeTab === 'description' && (
              <div className="prose max-w-none">
                {product.description
                  ? <p className="text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
                  : <p className="text-gray-500">A detailed description for this product will be added soon.</p>}
                {product.usages?.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-heading font-bold text-brand-green-dark mb-3">Best Used In:</h4>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {product.usages.map((use) => <li key={use} className="flex items-center gap-2 text-gray-600 text-sm"><Check className="w-4 h-4 text-brand-green" />{use}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'ingredients' && (
              <div>
                <h4 className="font-heading font-bold text-brand-green-dark mb-3">Ingredients:</h4>
                {product.ingredients
                  ? <p className="text-gray-600 whitespace-pre-line">{product.ingredients}</p>
                  : <p className="text-gray-500">Ingredient details for this product will be added soon.</p>}
                <div className="mt-6 p-4 bg-green-50 rounded-xl">
                  <div className="text-green-700 text-sm font-medium">✓ No Artificial Colors &nbsp; ✓ No Added Preservatives &nbsp; ✓ 100% Natural</div>
                </div>
              </div>
            )}
            {activeTab === 'nutrition' && (
              <div>
                <h4 className="font-heading font-bold text-brand-green-dark mb-4">Nutritional Information (per 100g)</h4>
                {product.nutritionPer100g ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {Object.entries(product.nutritionPer100g).map(([key, val]) => (
                      <div key={key} className="bg-gray-50 rounded-xl p-4 text-center">
                        <div className="font-bold text-brand-green text-lg">{val}</div>
                        <div className="text-xs text-gray-500 capitalize mt-1">{key}</div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-500">Nutritional information not available.</p>}
              </div>
            )}
            {activeTab === 'reviews' && (
              <ReviewsTab
                product={product}
                rating={rating}
                ratingText={ratingText}
                reviewCount={reviewCount}
                reviews={reviews}
                reviewsTotal={reviewsTotal}
                reviewsLoading={reviewsLoading}
                onLoadMore={() => dispatch(fetchProductReviews({ productId: product.id, page: reviewsPage + 1 }))}
                myReview={myReview}
                isAuthenticated={isAuthenticated}
                onSubmit={async (form) => {
                  const res = await dispatch(submitReview({ productId: product.id, ...form }));
                  if (submitReview.fulfilled.match(res)) {
                    toast.success(res.payload?.message || 'Thanks for your review!', { style: { borderRadius: '12px' } });
                    // Auto-approved (verified purchase) reviews change the rating right away
                    if (res.payload?.review?.status === 'Approved') dispatch(fetchProductBySlug(product.slug));
                    return true;
                  }
                  toast.error(res.payload || 'Could not submit your review', { style: { borderRadius: '12px' } });
                  return false;
                }}
              />
            )}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div>
            <h2 className="section-title mb-6">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const fmtReviewDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function Stars({ value, size = 'w-5 h-5' }) {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => {
        const on = i < Math.round(value);
        return <Star key={i} className={size} fill={on ? '#f5a623' : 'none'} stroke={on ? '#f5a623' : '#d1d5db'} />;
      })}
    </div>
  );
}

/** Reviews tab: approved reviews + rating breakdown from the API, and the customer's own review / form. */
function ReviewsTab({ product, rating, ratingText, reviewCount, reviews, reviewsTotal, reviewsLoading, onLoadMore, myReview, isAuthenticated, onSubmit }) {
  const breakdown = product.ratingBreakdown || {};
  const rows = [5, 4, 3, 2, 1].map((star) => ({ star, count: breakdown[`star${star}`] || 0 }));
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div>
      {reviewCount > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="text-6xl font-heading font-bold text-brand-green">{ratingText}</div>
            <div>
              <div className="mb-1"><Stars value={rating} /></div>
              <div className="text-sm text-gray-500">Based on {reviewCount.toLocaleString()} review{reviewCount === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div className="flex-1 max-w-sm space-y-1.5">
            {rows.map((r) => (
              <div key={r.star} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-8 flex items-center gap-0.5">{r.star}<Star className="w-3 h-3 text-yellow-400" fill="currentColor" /></span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
                <span className="w-6 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <MyReviewPanel myReview={myReview} isAuthenticated={isAuthenticated} onSubmit={onSubmit} />

      {reviews.length > 0 ? (
        <>
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-100 pb-4 mb-4 last:border-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center text-white text-xs font-bold">{(review.userName || 'U')[0].toUpperCase()}</div>
                <span className="font-medium text-sm text-gray-800">{review.userName || 'Customer'}</span>
                <div className="flex gap-0.5">{[...Array(5)].map((_, j) => <Star key={j} className="w-3 h-3" fill={j < review.rating ? '#f5a623' : 'none'} stroke={j < review.rating ? '#f5a623' : '#d1d5db'} />)}</div>
                {review.isVerifiedPurchase && <span className="inline-flex items-center gap-1 text-[11px] text-green-700 font-medium"><BadgeCheck className="w-3.5 h-3.5" /> Verified purchase</span>}
                <span className="text-xs text-gray-400 ml-auto">{fmtReviewDate(review.createdAt)}</span>
              </div>
              {review.title && <div className="font-semibold text-sm text-gray-800 mb-1">{review.title}</div>}
              <p className="text-sm text-gray-600 whitespace-pre-line">{review.comment}</p>
              {review.adminReply && (
                <div className="mt-3 ml-4 pl-3 border-l-2 border-brand-green/40 bg-green-50/60 rounded-r-xl py-2 pr-3">
                  <div className="text-xs font-semibold text-brand-green mb-0.5">Reply from WAH! Spices</div>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{review.adminReply}</p>
                </div>
              )}
            </div>
          ))}
          {reviews.length < reviewsTotal && (
            <div className="text-center">
              <button type="button" onClick={onLoadMore} disabled={reviewsLoading} className="btn-outline text-sm disabled:opacity-50">
                {reviewsLoading ? 'Loading…' : `Show more reviews (${reviewsTotal - reviews.length})`}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-sm">No reviews yet. Be the first to review!</p>
      )}
    </div>
  );
}

const EMPTY_REVIEW = { rating: 0, title: '', comment: '' };

function MyReviewPanel({ myReview, isAuthenticated, onSubmit }) {
  const [form, setForm] = useState(EMPTY_REVIEW);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated) {
    return (
      <div className="mb-8 p-4 bg-brand-cream rounded-2xl text-sm text-gray-600 flex flex-wrap items-center gap-3">
        <span>Bought this masala? Share your experience with other cooks.</span>
        <Link to="/login" className="text-brand-green font-semibold hover:underline">Sign in to write a review</Link>
      </div>
    );
  }

  if (myReview && myReview.status === 'Pending') {
    return (
      <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm">
        <div className="flex items-center gap-2 font-semibold text-amber-800"><Clock className="w-4 h-4" /> Your review is awaiting approval</div>
        <p className="text-amber-700 mt-1">Thanks for reviewing! It will appear here once our team has checked it.</p>
      </div>
    );
  }

  if (myReview && myReview.status === 'Approved') {
    return (
      <div className="mb-8 p-4 bg-green-50 rounded-2xl text-sm text-green-700 flex items-center gap-2">
        <Check className="w-4 h-4" /> Thanks — your review is published below.
      </div>
    );
  }

  const rejected = myReview?.status === 'Rejected';
  const shown = hover || form.rating;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) { setError('Please choose a star rating.'); return; }
    if (form.comment.trim().length < 10) { setError('Please write at least 10 characters about the product.'); return; }
    setError('');
    setSaving(true);
    const ok = await onSubmit({ rating: form.rating, title: form.title.trim() || null, comment: form.comment.trim() });
    setSaving(false);
    if (ok) { setForm(EMPTY_REVIEW); setOpen(false); }
  };

  if (!open) {
    return (
      <div className="mb-8">
        {rejected && (
          <div className="mb-3 p-4 bg-red-50 rounded-2xl text-sm text-red-700">
            Your earlier review wasn't published{myReview.rejectionReason ? `: ${myReview.rejectionReason}` : '.'} You can write a new one.
          </div>
        )}
        <button type="button" onClick={() => setOpen(true)} className="btn-outline text-sm">Write a review</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-8 p-5 bg-brand-cream rounded-2xl space-y-3">
      <div className="font-heading font-bold text-brand-green-dark">Write a review</div>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => setForm((f) => ({ ...f, rating: n }))}>
            <Star className="w-7 h-7" fill={n <= shown ? '#f5a623' : 'none'} stroke={n <= shown ? '#f5a623' : '#d1d5db'} />
          </button>
        ))}
      </div>
      <input
        className="input-field"
        maxLength={150}
        placeholder="Title (optional)"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />
      <textarea
        className="input-field resize-none"
        rows={4}
        maxLength={2000}
        placeholder="How did it taste? What did you cook with it?"
        value={form.comment}
        onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? 'Submitting…' : 'Submit review'}</button>
        <button type="button" onClick={() => { setOpen(false); setError(''); }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <span className="text-xs text-gray-400 ml-auto">Reviews are published after a quick check.</span>
      </div>
    </form>
  );
}
