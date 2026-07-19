import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Layout from '@/components/layout/Layout'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import GuestRoute from '@/components/shared/GuestRoute'
import { AuthProvider } from '@/context/AuthContext'
import CookiePolicyPage from '@/pages/CookiePolicyPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import GoogleCallbackPage from '@/pages/auth/GoogleCallbackPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/auth/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import PrivacyPage from '@/pages/PrivacyPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import TermsPage from '@/pages/TermsPage'

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        {/* Rendered before the routed tree so its mount effect commits first — a page
            that calls toast() in its own first effect (e.g. GoogleCallbackPage on a
            cold load) would otherwise race Toaster's own mount and lose the toast. */}
        <Toaster />
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/cookies" element={<CookiePolicyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<GoogleCallbackPage />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
