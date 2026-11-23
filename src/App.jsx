import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

/* ── Public layout components ── */
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/layout/CartDrawer';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import SiteContentGate from '@/components/layout/SiteContentGate';
import NotificationsProvider from '@/components/notifications/NotificationsProvider';

/* ── Public pages ── */
import Home from '@/pages/Home';
import Products from '@/pages/Products';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Wishlist from '@/pages/Wishlist';
import Checkout from '@/pages/Checkout';
import Login from '@/pages/Login';
import OtpPage from '@/pages/OtpPage';
import ResetPassword from '@/pages/ResetPassword';
import Profile from '@/pages/Profile';
import About from '@/pages/About';
import Blog from '@/pages/Blog';
import Contact from '@/pages/Contact';
import Feedback from '@/pages/Feedback';
import History from '@/pages/History';
import Help from '@/pages/Help';
import TrackOrder from '@/pages/TrackOrder';
import Unsubscribe from '@/pages/Unsubscribe';
// Regions (India map + state stories) is split out so the map data isn't in the main bundle
const Regions = lazy(() => import('@/pages/Regions'));
const regionsFallback = <div className="min-h-[70vh] bg-brand-cream" aria-busy="true" />;
import {
  ShippingPolicy, ReturnPolicy, PrivacyPolicy, QualityPolicy, TermsConditions,
} from '@/pages/PolicyPages';

/* ── Admin ── */
import AdminLogin         from '@/admin/pages/AdminLogin';
import AdminLayout        from '@/admin/components/AdminLayout';
import AdminDashboard     from '@/admin/pages/AdminDashboard';
import AdminProducts      from '@/admin/pages/AdminProducts';
import AdminCategories    from '@/admin/pages/AdminCategories';
import AdminOrders        from '@/admin/pages/AdminOrders';
import AdminCustomers     from '@/admin/pages/AdminCustomers';
import AdminBlog          from '@/admin/pages/AdminBlog';
import AdminRecipes       from '@/admin/pages/AdminRecipes';
import AdminAnalytics     from '@/admin/pages/AdminAnalytics';
import AdminSettings      from '@/admin/pages/AdminSettings';
import AdminInventory     from '@/admin/pages/AdminInventory';
import AdminPacking       from '@/admin/pages/AdminPacking';
import AdminProduction    from '@/admin/pages/AdminProduction';
import AdminPurchase      from '@/admin/pages/AdminPurchase';
import AdminBarcode       from '@/admin/pages/AdminBarcode';
import AdminBilling       from '@/admin/pages/AdminBilling';
import AdminGST           from '@/admin/pages/AdminGST';
// AdminCRM replaced by AdminCustomers (proper redesign)
import AdminExpense       from '@/admin/pages/AdminExpense';
import AdminCompany       from '@/admin/pages/AdminCompany';
import AdminStaff         from '@/admin/pages/AdminStaff';
import AdminAttendance    from '@/admin/pages/AdminAttendance';
import AdminLeave         from '@/admin/pages/AdminLeave';
import AdminPayroll       from '@/admin/pages/AdminPayroll';
import AdminReports       from '@/admin/pages/AdminReports';
import AdminAccessControl from '@/admin/pages/AdminAccessControl';
import AdminSalesOrders  from '@/admin/pages/AdminSalesOrders';
import AdminCRM          from '@/admin/pages/AdminCRM';
import AdminReturns       from '@/admin/pages/AdminReturns';
import AdminPayments      from '@/admin/pages/AdminPayments';
import AdminWebsiteUsers  from '@/admin/pages/AdminWebsiteUsers';
import AdminReviews       from '@/admin/pages/AdminReviews';
import AdminWebsiteContent from '@/admin/pages/AdminWebsiteContent';
import AdminRegions       from '@/admin/pages/AdminRegions';
import AdminShipping      from '@/admin/pages/AdminShipping';
import AdminFeedback      from '@/admin/pages/AdminFeedback';
import AdminMessages      from '@/admin/pages/AdminMessages';
import AdminCampaigns     from '@/admin/pages/AdminCampaigns';
import AdminBroadcasts    from '@/admin/pages/AdminBroadcasts';

/* ── Page loader on every route change ── */
function PageLoader() {
  const { pathname, state } = useLocation();
  const [visible, setVisible] = useState(false);
  const inPage = !!state?.keepScroll;   // in-page switch (e.g. clicking a state on the regions map)

  useEffect(() => {
    if (inPage) return undefined;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#fff9f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '4px solid #f5e8d0',
          borderTopColor: '#1a5c2e',
          borderRadius: '50%',
          animation: 'loaderSpin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes loaderSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Scroll-to-top on route change ── */
function ScrollToTop() {
  const { pathname, state } = useLocation();
  useEffect(() => {
    if (state?.keepScroll) return;   // the page handles its own scrolling (regions map)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

/* ── Public layout wrapper (header + footer) ── */
function PublicLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageLoader />
      <ScrollToTop />
      <Header />
      <CartDrawer />
      <ScrollToTopButton />
      <NotificationsProvider />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login />} />
          <Route path="/otp" element={<OtpPage />} />
          <Route path="/forgot-password" element={<ResetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/orders" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<Blog />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/history" element={<History />} />
          <Route path="/help" element={<Help />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/regions" element={<Suspense fallback={regionsFallback}><Regions /></Suspense>} />
          <Route path="/regions/:slug" element={<Suspense fallback={regionsFallback}><Regions /></Suspense>} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/return-policy" element={<ReturnPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/quality-policy" element={<QualityPolicy />} />
          <Route path="/terms-conditions" element={<TermsConditions />} />
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-brand-cream">
                <div className="text-center">
                  <div className="text-8xl mb-4">🌶️</div>
                  <h1 className="text-6xl font-body font-black text-brand-green mb-3">404</h1>
                  <p className="text-gray-500 font-body mb-6">
                    Oops! This page got lost in the spice cabinet.
                  </p>
                  <a href="/" className="btn-primary">Go Home</a>
                </div>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Admin routes (own layout, no public header/footer) ── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index            element={<AdminDashboard />} />
          {/* Sales & Billing */}
          <Route path="orders"         element={<AdminOrders />} />
          <Route path="billing"        element={<AdminBilling />} />
          <Route path="gst"            element={<AdminGST />} />
          <Route path="crm"            element={<AdminCRM />} />
          <Route path="returns"        element={<AdminReturns />} />
          <Route path="payments"       element={<AdminPayments />} />
          <Route path="website-users"  element={<AdminWebsiteUsers />} />
          <Route path="sales-orders"   element={<AdminSalesOrders />} />
          {/* Inventory & Production */}
          <Route path="inventory"      element={<AdminInventory />} />
          <Route path="shipping"       element={<AdminShipping />} />
          <Route path="packing"        element={<AdminPacking />} />
          <Route path="production"     element={<AdminProduction />} />
          <Route path="purchase"       element={<AdminPurchase />} />
          <Route path="barcode"        element={<AdminBarcode />} />
          {/* HR */}
          <Route path="staff"          element={<AdminStaff />} />
          <Route path="attendance"     element={<AdminAttendance />} />
          <Route path="leave"          element={<AdminLeave />} />
          <Route path="payroll"        element={<AdminPayroll />} />
          <Route path="expense"        element={<AdminExpense />} />
          {/* Company finance & compliance */}
          <Route path="company"          element={<AdminCompany />} />
          <Route path="company/:section" element={<AdminCompany />} />
          {/* Products & Content */}
          <Route path="products"       element={<AdminProducts />} />
          <Route path="categories"     element={<AdminCategories />} />
          <Route path="blog"           element={<AdminBlog />} />
          <Route path="recipes"        element={<AdminRecipes />} />
          <Route path="customers"      element={<AdminCustomers />} />
          <Route path="reviews"        element={<AdminReviews />} />
          {/* Website */}
          <Route path="content"        element={<AdminWebsiteContent />} />
          <Route path="regions"        element={<AdminRegions />} />
          <Route path="feedback"       element={<AdminFeedback />} />
          <Route path="messages"       element={<AdminMessages />} />
          {/* Marketing */}
          <Route path="marketing/campaigns"  element={<AdminCampaigns />} />
          <Route path="marketing/broadcasts" element={<AdminBroadcasts />} />
          {/* Reports & System */}
          <Route path="analytics"      element={<AdminAnalytics />} />
          <Route path="reports"        element={<AdminReports />} />
          <Route path="access-control" element={<AdminAccessControl />} />
          <Route path="settings"       element={<AdminSettings />} />
        </Route>

        {/* ── Public routes (header + footer) ── */}
        <Route path="/*" element={<SiteContentGate><PublicLayout /></SiteContentGate>} />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontFamily: 'Poppins, sans-serif', fontSize: '13px', borderRadius: '12px' },
        }}
      />
    </BrowserRouter>
  );
}
