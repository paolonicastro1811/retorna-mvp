import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { TrialBanner } from './TrialBanner'
import { api } from '../api/client'

interface BillingStatus {
  subscriptionStatus: string
  trialDaysRemaining: number
  isActive: boolean
}

export function Layout() {
  const navigate = useNavigate()
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api<BillingStatus>('/billing/status')
      .then(setBilling)
      .catch(() => {})
  }, [])

  const showBanner = billing && !dismissed && (
    (billing.subscriptionStatus === 'trialing' && billing.trialDaysRemaining <= 7) ||
    billing.subscriptionStatus === 'expired' ||
    billing.subscriptionStatus === 'past_due'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="md:ml-52 ml-0 pt-14 md:pt-0 p-8">
        {showBanner && billing && (
          <TrialBanner
            status={billing.subscriptionStatus}
            daysRemaining={billing.trialDaysRemaining}
            onAction={() => navigate('/assinatura')}
            onDismiss={billing.subscriptionStatus !== 'expired' ? () => setDismissed(true) : undefined}
          />
        )}
        <Outlet />
      </main>
    </div>
  )
}
