import { useEffect, useState } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { api } from '../api/client'

interface RecentReturn {
  customerName: string
  customerPhone: string
  templateKey: string
  messageSentAt: string
  visitAt: string
  daysToReturn: number
  revenue: number
  tableNumber: number | null
  tableLabel: string | null
}

interface AutomationKpis {
  kpis: {
    totalSent: number
    totalReturned: number
    returnRate: number
    totalRevenue: number
    roiPerMessage: number
    failedCount: number
  }
  templateBreakdown: any[]
  recentReturns: RecentReturn[]
  tierDistribution: any[]
}

const TEMPLATE_LABELS: Record<string, string> = {
  post_visit_consent: 'Pos-visita',
  post_visit_thanks: 'Pos-visita',
  reward_earned: 'Recompensa',
  surprise_discount: 'Desconto surpresa',
  milestone_halfway: 'Metade do caminho',
  reactivation: 'Reativacao',
  loyalty_vip: 'Cliente VIP',
}

function fmtCurrency(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function AutomacoesPage() {
  const restaurantId = useRestaurantId()
  const [data, setData] = useState<AutomationKpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    api<AutomationKpis>(`/restaurants/${restaurantId}/automation-stats`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [restaurantId])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-6 w-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
    </div>
  )

  // ── DEMO DATA (remove after review) ──
  const DEMO = true
  const demoData: AutomationKpis = {
    kpis: {
      totalSent: 47,
      totalReturned: 14,
      returnRate: 30,
      totalRevenue: 2840,
      roiPerMessage: 60,
      failedCount: 1,
    },
    templateBreakdown: [],
    recentReturns: [
      { customerName: 'João Silva', customerPhone: '+5511999001122', templateKey: 'reactivation', messageSentAt: '2026-03-28T10:00:00Z', visitAt: '2026-03-30T19:30:00Z', daysToReturn: 2, revenue: 185, tableNumber: 4, tableLabel: null },
      { customerName: 'Maria Oliveira', customerPhone: '+5511988776655', templateKey: 'post_visit_thanks', messageSentAt: '2026-03-29T13:00:00Z', visitAt: '2026-04-01T20:00:00Z', daysToReturn: 3, revenue: 220, tableNumber: 7, tableLabel: null },
      { customerName: 'Carlos Santos', customerPhone: '+5511977665544', templateKey: 'surprise_discount', messageSentAt: '2026-03-25T17:00:00Z', visitAt: '2026-03-27T12:30:00Z', daysToReturn: 2, revenue: 310, tableNumber: 2, tableLabel: null },
      { customerName: 'Ana Costa', customerPhone: '+5511966554433', templateKey: 'milestone_halfway', messageSentAt: '2026-03-20T13:00:00Z', visitAt: '2026-03-24T19:00:00Z', daysToReturn: 4, revenue: 150, tableNumber: null, tableLabel: null },
      { customerName: 'Pedro Almeida', customerPhone: '+5511955443322', templateKey: 'reward_earned', messageSentAt: '2026-03-22T13:00:00Z', visitAt: '2026-03-23T20:30:00Z', daysToReturn: 1, revenue: 420, tableNumber: 12, tableLabel: null },
      { customerName: 'Fernanda Lima', customerPhone: '+5511944332211', templateKey: 'reactivation', messageSentAt: '2026-03-18T10:00:00Z', visitAt: '2026-03-22T13:00:00Z', daysToReturn: 4, revenue: 275, tableNumber: 5, tableLabel: null },
      { customerName: 'Lucas Rocha', customerPhone: '+5511933221100', templateKey: 'post_visit_thanks', messageSentAt: '2026-03-30T13:00:00Z', visitAt: '2026-04-02T19:45:00Z', daysToReturn: 3, revenue: 190, tableNumber: 9, tableLabel: null },
      { customerName: 'Juliana Pereira', customerPhone: '+5511922110099', templateKey: 'surprise_discount', messageSentAt: '2026-03-15T17:00:00Z', visitAt: '2026-03-17T21:00:00Z', daysToReturn: 2, revenue: 340, tableNumber: 1, tableLabel: null },
      { customerName: 'Roberto Mendes', customerPhone: '+5511911009988', templateKey: 'reactivation', messageSentAt: '2026-03-10T10:00:00Z', visitAt: '2026-03-15T20:00:00Z', daysToReturn: 5, revenue: 160, tableNumber: 8, tableLabel: null },
      { customerName: 'Camila Souza', customerPhone: '+5511900998877', templateKey: 'loyalty_vip', messageSentAt: '2026-03-27T13:00:00Z', visitAt: '2026-03-28T19:30:00Z', daysToReturn: 1, revenue: 590, tableNumber: 3, tableLabel: null },
    ],
    tierDistribution: [],
  }
  const effective = DEMO ? demoData : data

  if (!effective) return (
    <div className="text-center py-20 text-red-500">Erro ao carregar dados</div>
  )
  // ── END DEMO DATA ──

  const { kpis, recentReturns } = effective
  const hasActivity = kpis.totalSent > 0

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Resultados</h1>
        <p className="text-sm text-gray-400">Quanto o Retorna esta gerando para voce — ultimos 90 dias</p>
      </div>

      {hasActivity ? (
        <>
          {/* ── Hero: Revenue ── */}
          <div className="bg-[#1a1a2e] rounded-2xl p-6 mb-4 text-center">
            <p className="text-sm text-gray-400 mb-1">Receita gerada pelo Retorna</p>
            <p className="text-4xl font-extrabold text-[#25D366]">{fmtCurrency(kpis.totalRevenue)}</p>
            <p className="text-sm text-gray-400 mt-2">
              {kpis.totalReturned} cliente{kpis.totalReturned !== 1 ? 's' : ''} voltou apos receber mensagem
            </p>
          </div>

          {/* ── 3 mini stats ── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <p className="text-2xl font-extrabold text-gray-900">{kpis.totalSent}</p>
              <p className="text-xs text-gray-400">Mensagens enviadas</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <p className="text-2xl font-extrabold text-gray-900">{kpis.returnRate}%</p>
              <p className="text-xs text-gray-400">Taxa de retorno</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <p className="text-2xl font-extrabold text-gray-900">{fmtCurrency(kpis.roiPerMessage)}</p>
              <p className="text-xs text-gray-400">Receita por mensagem</p>
            </div>
          </div>

          {/* ── Recent returns (proof it works) ── */}
          {recentReturns.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-base font-bold text-gray-800 mb-3">Clientes que voltaram</h2>
              <div className="space-y-3">
                {recentReturns.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{r.customerName || r.customerPhone}</p>
                      <p className="text-xs text-gray-400">
                        {TEMPLATE_LABELS[r.templateKey] || 'Mensagem'} — voltou em {r.daysToReturn === 1 ? '1 dia' : `${r.daysToReturn} dias`}
                      </p>
                    </div>
                    {r.revenue > 0 && (
                      <span className="text-sm font-bold text-[#25D366] ml-3 whitespace-nowrap">
                        +{fmtCurrency(r.revenue)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Empty state ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-4xl mb-3">📩</p>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Nenhuma mensagem enviada ainda</h2>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">
            Registre visitas dos seus clientes e o Retorna vai enviar mensagens automaticamente para traze-los de volta. Aqui voce vera os resultados.
          </p>
        </div>
      )}
    </div>
  )
}
