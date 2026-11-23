import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, Tag, ChevronRight, ArrowLeft, Users, ChefHat } from 'lucide-react';
import { fetchRecipesAndKnowledge, fetchRecipeOrPost } from '@/utils/blog';
import { getImageUrl } from '@/utils/product';
import { SkBlogGrid } from '@/components/ui/Skeleton';
import { safeHref } from '@/utils/safeUrl';

const categoryEmoji = (c) => (c === 'Recipe' ? '🍳' : c === 'Health' ? '💚' : '📚');

function BlogCard({ blog, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
    >
      <Link to={blog.href} className="block group">
        <div className="card overflow-hidden hover:-translate-y-2 transition-all duration-300">
          <div
            className="h-48 flex items-end p-5 relative"
            style={{ backgroundColor: blog.bgColor }}
          >
            {blog.image ? (
              <>
                <img src={blog.image} alt={blog.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <span className="text-8xl">{categoryEmoji(blog.category)}</span>
              </div>
            )}
            <div className="relative z-10">
              <span className="badge bg-white/20 backdrop-blur-sm text-white text-xs">{blog.category}</span>
            </div>
            <div className="absolute top-3 right-3 text-xs text-white/60">{blog.readTime}</div>
          </div>
          <div className="p-5">
            <h3 className="font-heading font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-brand-green transition-colors text-lg">
              {blog.title}
            </h3>
            <p className="text-sm text-gray-500 line-clamp-2 mb-4">{blog.excerpt}</p>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {blog.date}
              </span>
              <span className="text-brand-green font-medium group-hover:gap-2 flex items-center gap-1 transition-all">
                Read More <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function BlogDetailView({ slug }) {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type');
  const [blog, setBlog] = useState(undefined); // undefined = loading, null = not found
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setBlog(undefined);
    setError(false);
    fetchRecipeOrPost(slug, type)
      .then((b) => { if (alive) setBlog(b); })
      .catch(() => { if (alive) { setError(true); setBlog(null); } });
    return () => { alive = false; };
  }, [slug, type]);

  if (blog === undefined) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <div className="py-16 bg-brand-green-dark"><div className="container-custom"><div className="sk w-2/3 h-10 rounded" /></div></div>
        <div className="container-custom py-10 max-w-4xl"><div className="bg-white rounded-3xl shadow-card p-8 md:p-12 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk w-full h-4 rounded" />)}
        </div></div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-heading font-bold mb-2">{error ? 'Could not load this article' : 'Article not found'}</h2>
          <Link to="/blog" className="btn-primary">Back to Blog</Link>
        </div>
      </div>
    );
  }

  const isRecipe = blog.type === 'recipe';
  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Header */}
      <div className="py-16 text-white relative overflow-hidden" style={{ backgroundColor: blog.bgColor }}>
        {blog.image && (
          <>
            <img src={blog.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/55" />
          </>
        )}
        <div className="container-custom relative">
          <Link to="/blog" className="flex w-fit items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>
          <div className="badge bg-white/20 text-white mb-4">{blog.category}</div>
          <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4 max-w-3xl">{blog.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm">
            {blog.author && <span>✍️ {blog.author}</span>}
            {blog.date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {blog.date}</span>}
            {isRecipe ? (
              <>
                {blog.timeText && <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {blog.timeText}</span>}
                {blog.servings > 0 && <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Serves {blog.servings}</span>}
                {blog.difficulty && <span className="flex items-center gap-1"><ChefHat className="w-4 h-4" /> {blog.difficulty}</span>}
              </>
            ) : (
              blog.readTime && <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {blog.readTime}</span>
            )}
          </div>
        </div>
      </div>

      <div className="container-custom py-10 max-w-4xl">
        <div className="bg-white rounded-3xl shadow-card p-8 md:p-12">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {blog.tags?.map((tag) => (
              <span key={tag} className="badge-green text-xs">
                <Tag className="w-3 h-3" /> {tag}
              </span>
            ))}
          </div>

          {/* Content */}
          {isRecipe ? <RecipeBody recipe={blog} /> : <PostContent content={blog.content} />}

          {blog.videoUrl && (
            <a href={safeHref(getImageUrl(blog.videoUrl))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-6 text-brand-green font-semibold hover:underline">
              ▶ Watch the video
            </a>
          )}

          {/* Related Masala */}
          {blog.relatedProducts.map((p) => (
            <div key={p.id} className="mt-8 bg-brand-green/5 rounded-2xl p-5 flex items-center gap-4">
              {p.imageUrl
                ? <img src={getImageUrl(p.imageUrl)} alt={p.name} className="w-12 h-12 rounded-xl object-cover" />
                : <div className="w-12 h-12 bg-brand-green rounded-xl flex items-center justify-center text-white font-bold">W!</div>}
              <div>
                <div className="font-heading font-bold text-brand-green-dark">{p.name}</div>
                <div className="text-sm text-gray-500">
                  {isRecipe ? 'Used in this recipe' : 'Mentioned in this article'}
                  {p.inStock === false && <span className="ml-2 text-red-500">· Out of stock</span>}
                </div>
              </div>
              <Link to={`/product/${p.slug}`} className="ml-auto btn-primary text-sm">{p.inStock === false ? 'View' : 'Buy Now'}</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Blog() {
  const { slug } = useParams();
  if (slug) return <BlogDetailView slug={slug} />;
  return <BlogList />;
}

function BlogList() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [data, setData] = useState({ items: [], categories: [] });
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    fetchRecipesAndKnowledge()
      .then((d) => { if (alive) { setData(d); setStatus('ready'); } })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, []);

  const blogCategories = ['all', ...data.categories];
  const filtered = activeCategory === 'all' ? data.items : data.items.filter((b) => b.category === activeCategory);

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-green-dark text-white py-16 text-center">
        <div className="container-custom">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-6xl font-heading font-bold mb-3">
              Recipes & <span className="text-brand-orange">Knowledge</span>
            </h1>
            <p className="text-green-300 text-lg">Authentic recipes and spice wisdom from across India</p>
          </motion.div>
        </div>
      </div>

      <div className="container-custom py-8">
        {/* Category Filter */}
        {blogCategories.length > 2 && <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-8">
          {blogCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all capitalize ${
                activeCategory === cat
                  ? 'bg-brand-green text-white shadow-brand'
                  : 'bg-white text-gray-600 hover:bg-brand-green/10 border border-gray-200'
              }`}
            >
              {cat === 'all' ? 'All Articles' : cat}
            </button>
          ))}
        </div>}

        {status === 'loading' ? (
          <SkBlogGrid count={6} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🍳</div>
            <h3 className="font-heading font-bold text-2xl text-gray-700 mb-2">
              {status === 'error' ? 'Could not load recipes right now' : 'Fresh recipes are on their way'}
            </h3>
            <p className="text-gray-500 mb-6">
              {status === 'error' ? 'Please check your connection and try again.' : 'Our kitchen is cooking up new recipes and spice stories. Meanwhile, explore our masalas.'}
            </p>
            <Link to="/products" className="btn-primary">Browse Products</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((blog, i) => (
              <BlogCard key={blog.key} blog={blog} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Article text: blank-line paragraphs, **Heading** lines, "- " bullets and "1. " numbered lines. */
function PostContent({ content }) {
  return (
    <div className="prose max-w-none">
      {(content || '').split('\n').map((raw, i) => {
        const paragraph = raw.trim();
        if (!paragraph) return null;
        if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
          return <h3 key={i} className="font-heading font-bold text-brand-green-dark text-xl mt-6 mb-2">{paragraph.replace(/\*\*/g, '')}</h3>;
        }
        if (paragraph.startsWith('- ')) {
          return <li key={i} className="text-gray-600 leading-relaxed mb-1 ml-4">{paragraph.slice(2)}</li>;
        }
        return <p key={i} className="text-gray-600 leading-relaxed mb-4">{paragraph}</p>;
      })}
    </div>
  );
}

function RecipeBody({ recipe }) {
  return (
    <div className="prose max-w-none">
      {recipe.description && <p className="text-gray-600 leading-relaxed mb-4">{recipe.description}</p>}
      {recipe.ingredients?.length > 0 && (
        <>
          <h3 className="font-heading font-bold text-brand-green-dark text-xl mt-6 mb-2">Ingredients</h3>
          <ul>{recipe.ingredients.map((ing, i) => <li key={i} className="text-gray-600 leading-relaxed mb-1 ml-4">{ing}</li>)}</ul>
        </>
      )}
      {recipe.steps?.length > 0 && (
        <>
          <h3 className="font-heading font-bold text-brand-green-dark text-xl mt-6 mb-2">Method</h3>
          <ol className="list-decimal ml-6">{recipe.steps.map((st, i) => <li key={i} className="text-gray-600 leading-relaxed mb-2">{st}</li>)}</ol>
        </>
      )}
      {recipe.tips && (
        <div className="mt-6 p-4 bg-orange-50 rounded-xl">
          <div className="font-heading font-bold text-orange-700 mb-1">Chef's tip</div>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{recipe.tips}</p>
        </div>
      )}
    </div>
  );
}
