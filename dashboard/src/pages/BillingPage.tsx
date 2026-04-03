import { useState, useEffect } from 'react'
import { api } from '../api/client'

interface BillingStatus {
  plan: string
  billingCycle: string
  subscriptionStatus: string
  trialEndsAt: string | null
  trialDaysRemaining: number
  isActive: boolean
  hasSubscription: boolean
}

const PRICES = {
  manual: { monthly: 197, annual: 158 },
  automatic: { monthly: 397, annual: 317 },
}

export function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<BillingStatus>('/billing/status')
      .then(setStatus)
      .catch(() => setError('Erro ao carregar dados de assinatura'))
      .finally(() => setLoading(false))
  }, [])

  const handleCheckout = async (cycle: 'monthly' | 'annual') => {
    setRedirecting(true)
    try {
      const { url } = await api<{ url: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ billingCycle: cycle }),
      })
      if (url && url.startsWith('https://')) {
        window.location.href = url
      } else {
        setError('Erro ao gerar link de pagamento')
        setRedirecting(false)
      }
    } catch {
      setError('Erro ao processar pagamento')
      setRedirecting(false)
    }
  }

  const handlePortal = async () => {
    try {
      const { url } = await api<{ url: string }>('/billing/portal', { method: 'POST' })
      window.location.href = url
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  const plan = (status?.plan || 'manual') as 'manual' | 'automatic'
  const planName = plan === 'automatic' ? 'Automático' : 'Manual'
  const price = PRICES[plan]

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          {status?.subscriptionStatus === 'trialing' && (status?.trialDaysRemaining ?? 0) > 0 ? (
            <>
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">
                {status.trialDaysRemaining} dias restantes no teste grátis
              </h1>
              <p className="text-base text-[#6b7280]">
                Assine agora para não perder acesso ao sistema.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">
                Seu período de teste expirou
              </h1>
              <p className="text-base text-[#6b7280]">
                Assine o Plano {planName} para continuar usando o Retorna.
              </p>
            </>
          )}
        </div>

        {status?.hasSubscription ? (
          <div className="text-center">
            <p className="text-sm text-[#6b7280] mb-4">
              Você já possui uma assinatura. Gerencie seu plano no portal Stripe.
            </p>
            <button
              onClick={handlePortal}
              className="w-full bg-[#1a1a2e] text-white py-3 rounded-lg font-bold text-base hover:bg-[#2d2d3a] transition-colors"
            >
              Gerenciar assinatura
            </button>
          </div>
        ) : (
          <>
            {/* Toggle */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>Mensal</span>
              <button
                onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
                className={`relative w-14 h-7 rounded-full transition-colors ${billing === 'annual' ? 'bg-[#25D366]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${billing === 'annual' ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm font-medium ${billing === 'annual' ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>Anual</span>
              {billing === 'annual' && (
                <span className="text-xs bg-[#25D366] text-white px-2 py-0.5 rounded-full font-bold">-20%</span>
              )}
            </div>

            {/* Price card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center mb-6">
              <p className="text-sm font-bold text-[#25D366] uppercase tracking-wider mb-2">Plano {planName}</p>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-4xl font-extrabold text-[#1a1a2e]">
                  R$ {price[billing]}
                </span>
                <span className="text-base text-gray-500">/mês</span>
              </div>
              {billing === 'annual' && (
                <p className="text-sm text-gray-400 mb-4">
                  R$ {price.annual * 12}/ano (economia de R$ {(price.monthly - price.annual) * 12})
                </p>
              )}

              <button
                onClick={() => handleCheckout(billing)}
                disabled={redirecting}
                className="w-full bg-[#25D366] text-white py-3 rounded-lg font-bold text-base hover:bg-[#1DA851] disabled:opacity-50 transition-colors"
              >
                {redirecting ? 'Redirecionando...' : `Assinar plano ${billing === 'annual' ? 'anual' : 'mensal'}`}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Pagamento seguro via Stripe. Cancele quando quiser.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
