import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { MemberLayout } from './components/MemberLayout';
import { Footer } from './components/Footer';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { HomePage } from './pages/HomePage';
import { BrowseMatchesPage } from './pages/BrowseMatchesPage';
import { ProfileDetailPage } from './pages/ProfileDetailPage';
import { InterestsPage } from './pages/InterestsPage';
import { MessagesPage } from './pages/MessagesPage';
import { ShadiPlannerPage } from './pages/ShadiPlannerPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminPage } from './pages/AdminPage';
import { AccountSecurityPage } from './pages/AccountSecurityPage';
import { DownloadAppPage } from './pages/DownloadAppPage';
import { RequireAuth } from './components/RequireAuth';

const SiteFooter: React.FC = () => useLocation().pathname.startsWith('/admin') ? null : <Footer />;

const RouteScroll: React.FC = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = hash ? document.getElementById(hash.slice(1)) : null;
      if (target) target.scrollIntoView({ block: 'start' });
      else window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <RouteScroll />
        <div className="site-shell min-h-screen flex flex-col">
          <a href="#main-content" className="skip-link">Skip to content</a>
          <Navbar />
          <MemberLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/matches" element={<RequireAuth><BrowseMatchesPage /></RequireAuth>} />
              <Route path="/profile/:id" element={<RequireAuth><ProfileDetailPage /></RequireAuth>} />
              <Route path="/interests" element={<RequireAuth><InterestsPage /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><MessagesPage /></RequireAuth>} />
              <Route path="/shadi-planner" element={<ShadiPlannerPage />} />
              <Route path="/my-profile" element={<MyProfilePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/admin/*" element={<AdminPage />} />
              <Route path="/account-settings" element={<RequireAuth><AccountSecurityPage /></RequireAuth>} />
              <Route path="/download" element={<DownloadAppPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MemberLayout>
          <SiteFooter />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;

