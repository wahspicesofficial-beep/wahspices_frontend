// Helpers that turn API product payloads into what the UI components expect.

import { ASSET_ORIGIN } from '@/config/apiEndpoints';

// Uploaded files: same site in production (/uploads is proxied to the API), the API host in development.
export const API_ORIGIN = ASSET_ORIGIN;

/** Absolute URL for an image path coming from the API ("/uploads/..." or already absolute). */
export function getImageUrl(url) {
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
  return url; // frontend public asset like /wah_logo.jpg
}

/** Smaller card-sized image for catalog products (falls back to the full image). */
export function getThumbUrl(url) {
  if (!url) return null;
  const m = url.match(/^(.*\/uploads\/products\/catalog\/)([^/]+)$/);
  return getImageUrl(m ? `${m[1]}thumb/${m[2]}` : url);
}

export const formatWeight = (w) => w || '';

/** Pick the variant shown by default: the flagged default, else the smallest in-stock pack. */
export function defaultVariant(product) {
  const vs = product?.variants || [];
  if (!vs.length) return null;
  return vs.find((v) => v.isDefault && v.inStock) || vs.find((v) => v.inStock) || vs[0];
}

/** Normalise one product from the API so every page can rely on the same fields. */
export function normalizeProduct(p) {
  if (!p || typeof p !== 'object') return p;
  const variants = [...(p.variants || [])].sort((a, b) => (a.weightGrams || 0) - (b.weightGrams || 0));
  const out = {
    ...p,
    variants,
    image: getImageUrl(p.imageUrl || p.image),
    thumb: getThumbUrl(p.imageUrl || p.image),
    reviews: p.reviews ?? p.reviewCount ?? 0,
    nutritionPer100g: p.nutritionPer100g ?? (p.nutrition ? {
      calories: p.nutrition.calories != null ? `${p.nutrition.calories} kcal` : undefined,
      protein: p.nutrition.protein,
      fat: p.nutrition.fat,
      carbs: p.nutrition.carbs,
      fiber: p.nutrition.fiber,
    } : undefined),
  };
  if (out.nutritionPer100g) {
    Object.keys(out.nutritionPer100g).forEach((k) => out.nutritionPer100g[k] == null && delete out.nutritionPer100g[k]);
  }
  return out;
}

export const normalizeList = (payload) => {
  const items = payload?.items || payload || [];
  return Array.isArray(items) ? items.map(normalizeProduct) : [];
};

/**
 * Can this product (optionally a specific pack size) be added to the cart?
 * product.inStock is kept in sync with inventory by the backend (0 stock or an admin "out of stock" → false);
 * a variant can additionally be switched off on its own.
 */
export function isPurchasable(product, variant) {
  if (!product || product.inStock === false) return false;
  const vs = product.variants || [];
  if (variant) return variant.inStock !== false;
  return vs.length === 0 || vs.some((v) => v.inStock !== false);
}

/** Lowest price across in-stock variants (for "From ₹X" on cards). */
export function minPrice(product) {
  const vs = (product?.variants || []).filter((v) => v.inStock);
  if (!vs.length) return product?.price;
  return Math.min(...vs.map((v) => v.price));
}

/**
 * Build the cart line for a product + chosen variant.
 * cartKey keeps different pack sizes of the same product as separate cart lines.
 */
export function toCartItem(product, variant) {
  const v = variant || defaultVariant(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.thumb || product.image,
    bgColor: product.bgColor,
    category: product.category,
    variantId: v?.id ?? null,
    weight: v?.weight ?? product.weight,
    price: v?.price ?? product.price,
    mrp: v?.mrp ?? product.mrp,
    cartKey: v ? `${product.id}-${v.id}` : `${product.id}`,
  };
}

export const prettyCategory = (slug) =>
  (slug || '').split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
