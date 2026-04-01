import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LandingPage } from './pages/LandingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { LoginPage } from './pages/LoginPage'
import { VerifyPage } from './pages/VerifyPage'
import { CustomersPage } from './pages/CustomersPage'
import { VisitPage } from './pages/VisitPage'
import { BookingLeadsPage } from './pages/BookingLeadsPage'
import { AutomacoesPage } from './pages/AutomacoesPage'
import { SettingsPage } from './pages/SettingsPage'
import { SalaAoVivoPage } from './pages/SalaAoVivoPage'
import WhatsAppConnectPage from './pages/WhatsAppConnectPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/comecar" element={<OnboardingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/verificar" element={<VerifyPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/termos" element={<TermsPage />} />

          {/* Protected Dashboard */}
          <Route path="/painel" element={
            <ProtectedRoute><Layout /></ProtectedRoute>
          }>
            <Route index element={<CustomersPage />} />
            <Route path="visita" element={<VisitPage />} />
            <Route path="campanhas" element={<AutomacoesPage />} />
            <Route path="leads" element={<BookingLeadsPage />} />
            <Route path="sala-ao-vivo" element={<SalaAoVivoPage />} />
            <Route path="whatsapp" element={<WhatsAppConnectPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
