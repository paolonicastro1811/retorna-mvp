import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LandingPage } from './pages/LandingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { CustomersPage } from './pages/CustomersPage'
import { VisitPage } from './pages/VisitPage'
import { BookingLeadsPage } from './pages/BookingLeadsPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/comecar" element={<OnboardingPage />} />

        {/* Dashboard */}
        <Route path="/painel" element={<Layout />}>
          <Route index element={<CustomersPage />} />
          <Route path="visita" element={<VisitPage />} />
          <Route path="campanhas" element={<CampaignsPage />} />
          <Route path="leads" element={<BookingLeadsPage />} />
          <Route path="impostacoes" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
