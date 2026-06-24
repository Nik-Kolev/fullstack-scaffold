import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import Layout from '@/components/layout/Layout'
import GuestRoute from '@/components/shared/GuestRoute'
import ProtectedRoute from '@/components/shared/ProtectedRoute'
import { AuthProvider } from '@/context/AuthContext'
import CookiePolicyPage from '@/pages/CookiePolicyPage'
import DashboardPage from '@/pages/DashboardPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import HomePage from '@/pages/HomePage'
import LivePage from '@/pages/LivePage'
import LoginPage from '@/pages/LoginPage'
import PrivacyPage from '@/pages/PrivacyPage'
import RegisterPage from '@/pages/RegisterPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import TermsPage from '@/pages/TermsPage'
import UploadPage from '@/pages/UploadPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiePolicyPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/live" element={<LivePage />} />
            </Route>
          </Route>

          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
