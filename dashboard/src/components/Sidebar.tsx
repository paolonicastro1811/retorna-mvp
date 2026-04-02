import { NavLink, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth, useRestaurantId } from '../contexts/AuthContext'
import { WhatsAppIcon } from './icons'

interface WhatsAppStatus {
  connected: boolean
  phoneNumber?: string
  connectedAt?: string
}

/*
 * COLOR SCHEME (for future refactoring to Tailwind theme tokens):
 *   Sidebar background: #1a1a2e (dark navy)
 *   Primary accent / CTA: #25D366 (WhatsApp green)
 *   Primary accent hover: #1DA851
 *   Active link bg: #25D366
 *   Disabled text: gray-600
 *   Muted text: gray-400 / gray-500
 *   Borders: white/10, white/5
 */

const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
)

const HamburgerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const links = [
  { to: '/painel', label: 'Clientes', planB: false },
  { to: '/painel/visita', label: 'Registrar Visita', planB: false },
  { to: '/painel/campanhas', label: 'Automacoes', planB: false },
  { to: '/painel/leads', label: 'Reservas', planB: true },
  { to: '/painel/sala-ao-vivo', label: 'Sala ao Vivo', planB: true },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const restaurantId = useRestaurantId()
  const [plan, setPlan] = useState<string>('manual')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null)

  useEffect(() => {
    // Check localStorage first for instant render
    const cached = localStorage.getItem('restaurantPlan')
    if (cached) setPlan(cached)

    // Then fetch from API
    if (!restaurantId) return
    api<{ plan: string }>(`/restaurants/${restaurantId}`)
      .then(r => {
        setPlan(r.plan)
        localStorage.setItem('restaurantPlan', r.plan)
      })
      .catch((err) => { console.error('Failed to fetch restaurant plan:', err) })
  }, [restaurantId])

  useEffect(() => {
    const fetchWaStatus = () => {
      api<WhatsAppStatus>('/whatsapp/status')
        .then(setWaStatus)
        .catch(() => { /* WhatsApp status not available yet */ })
    }
    fetchWaStatus()
    // Re-fetch when WhatsApp connection changes
    window.addEventListener('whatsapp-status-changed', fetchWaStatus)
    return () => window.removeEventListener('whatsapp-status-changed', fetchWaStatus)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-[#1a1a2e] flex items-center px-4 z-40 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1"
          aria-label="Abrir menu"
        >
          <HamburgerIcon />
        </button>
        <span className="ml-3 text-white text-sm font-semibold">Retorna</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-52 bg-[#1a1a2e] text-white flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-end px-3 py-2 md:hidden">
          <button
            onClick={closeMobile}
            className="text-white p-1"
            aria-label="Fechar menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* WhatsApp Business connection */}
        <div className="px-4 py-4 border-b border-white/10">
          <Link
            to="/painel/whatsapp"
            onClick={closeMobile}
            className={`w-full flex items-center gap-2 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
              waStatus?.connected
                ? 'bg-[#25D366]/20 border border-[#25D366]/40 hover:bg-[#25D366]/30'
                : 'bg-[#25D366] hover:bg-[#1DA851]'
            }`}
            aria-label={waStatus?.connected ? 'WhatsApp conectado' : 'Conectar WhatsApp Business'}
          >
            <WhatsAppIcon />
            {waStatus?.connected ? (
              <span className="truncate">WhatsApp &#10003;</span>
            ) : (
              <span>Conectar WhatsApp</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3">
          {links.map(l => {
            const disabled = l.planB && plan !== 'automatic'

            if (disabled) {
              return (
                <div
                  key={l.to}
                  className="flex items-center justify-between px-4 py-2 text-xs text-gray-600 cursor-not-allowed"
                  title="Disponivel no Plano Automatico"
                >
                  <span>{l.label}</span>
                  <span aria-label="Recurso bloqueado"><LockIcon /></span>
                </div>
              )
            }

            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/painel'}
                onClick={closeMobile}
                className={({ isActive }) =>
                  `block px-4 py-2 text-xs transition-colors ${
                    isActive
                      ? 'bg-[#25D366] text-white font-semibold'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {l.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Settings + Logout */}
        <div className="border-t border-white/10 p-3 space-y-1">
          <NavLink
            to="/painel/configuracoes"
            onClick={closeMobile}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
                isActive
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
            aria-label="Configuracoes"
          >
            <GearIcon />
            <span>Configuracoes</span>
          </NavLink>

          {/* User info + logout */}
          <div className="pt-2 border-t border-white/5">
            {user && (
              <p className="px-3 text-[10px] text-gray-500 truncate mb-1.5" title={user.email}>
                {user.email}
              </p>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:bg-white/5 hover:text-white rounded-lg transition-colors"
              aria-label="Sair da conta"
            >
              <LogoutIcon />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
