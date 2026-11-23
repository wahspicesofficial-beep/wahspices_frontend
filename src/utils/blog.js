// "Recipes & Knowledge" — published blog posts and recipes from the public API, normalised to one card shape.
import api from '@/services/api';
import { getImageUrl } from '@/utils/product';

const CATEGORY_COLORS = { Recipe: '#c8371e', Health: '#2e7d32', Knowledge: '#1565c0' };

export const formatBlogDate = (d) =>
  (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Blog post → card/detail shape used by Blog.jsx and Home.jsx */
export function normalizePost(p) {
  return {
    ...p,
    type: 'post',
    key: `post-${p.id}`,
    href: `/blog/${p.slug}`,
    image: getImageUrl(p.imageUrl),
    bgColor: p.bgColor || CATEGORY_COLORS[p.category] || '#1a5c2e',
    date: formatBlogDate(p.publishedAt),
    tags: Array.isArray(p.tags) ? p.tags : [],
    relatedProducts: p.relatedProducts || [],
  };
}

/** Recipe → same shape; every recipe shows under the "Recipe" category on the website */
export function normalizeRecipe(r) {
  const time = [r.prepTime && `Prep ${r.prepTime}`, r.cookTime && `Cook ${r.cookTime}`].filter(Boolean).join(' · ');
  return {
    ...r,
    type: 'recipe',
    key: `recipe-${r.id}`,
    href: `/blog/${r.slug}?type=recipe`,
    category: 'Recipe',
    recipeCategory: r.category,
    excerpt: r.description || '',
    author: 'WAH! Spices Kitchen',
    readTime: r.cookTime || r.prepTime || '',
    timeText: time,
    image: getImageUrl(r.imageUrl),
    bgColor: CATEGORY_COLORS.Recipe,
    date: formatBlogDate(r.publishedAt),
    tags: Array.isArray(r.tags) ? r.tags : [],
    masala: r.relatedProduct?.name || null,
    relatedProducts: r.relatedProduct ? [r.relatedProduct] : [],
  };
}

/** Load published posts + recipes (featured first, then newest). Returns { items, categories }. */
export async function fetchRecipesAndKnowledge({ limit = 50 } = {}) {
  const [posts, recipes] = await Promise.all([
    api.get('/blog', { params: { limit } }).then((r) => r.data.data).catch(() => null),
    api.get('/recipes', { params: { limit } }).then((r) => r.data.data).catch(() => null),
  ]);
  if (!posts && !recipes) throw new Error('Could not load recipes and articles');
  const items = [
    ...(recipes?.items || []).map(normalizeRecipe),
    ...(posts?.items || []).map(normalizePost),
  ].sort((a, b) => (b.featured === a.featured ? new Date(b.publishedAt) - new Date(a.publishedAt) : b.featured ? 1 : -1));
  const categories = [...new Set([
    ...((recipes?.items || []).length ? ['Recipe'] : []),
    ...(posts?.categories || []),
  ])];
  return { items, categories };
}

/** Detail by slug: `type=recipe` checks recipes first, otherwise posts first (slugs live in separate tables). */
export async function fetchRecipeOrPost(slug, type) {
  const order = type === 'recipe' ? ['recipes', 'blog'] : ['blog', 'recipes'];
  for (const kind of order) {
    try {
      const res = await api.get(`/${kind}/${encodeURIComponent(slug)}`);
      return kind === 'recipes' ? normalizeRecipe(res.data.data) : normalizePost(res.data.data);
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }
  }
  return null;
}
