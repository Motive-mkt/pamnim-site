/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OwnerDashboard from './pages/dashboards/OwnerDashboard';
import PortfolioPage from './pages/Portfolio';
import ContactPage from './pages/Contact';
import ServicesPage from './pages/Services';
import { useAuth } from './hooks/useAuth';
import PortfolioAssistant from './components/PortfolioAssistant';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const adminEmails = ['jessescaledyou@gmail.com', 'your-admin-email@example.com'];
  const isAdminEmail = user.email && adminEmails.includes(user.email.toLowerCase().trim());

  if (adminOnly && profile?.role !== 'owner' && !isAdminEmail) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const isAdminOrDashboard = location.pathname.startsWith('/admin') || 
                             location.pathname.startsWith('/dashboard') || 
                             location.pathname === '/login' || 
                             location.pathname === '/signup';

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Login isSignUpDefault={true} />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute adminOnly={true}>
              <OwnerDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
      {!isAdminOrDashboard && <PortfolioAssistant />}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
