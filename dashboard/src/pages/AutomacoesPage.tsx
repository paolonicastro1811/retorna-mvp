import { useEffect, useState } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { api } from '../api/client'

interface TemplateBreakdown {
  templateKey: string
  sent: number
  returned: number
  returnRate: number
  revenue: number
  roiPerMessage: number
}

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

interface TierDist {
  tier: string
  count: number
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
  templateBreakdown: TemplateBreakdown[]
  recentReturns: RecentReturn[]
  tierDistribution: TierDist[]
}

const TEMPLATE_LABELS: Record<string, { label: string; emoji: string }> = {
  post_visit_consent: { label: 'Pós-visita', emoji: '📩' },
  post_visit_thanks: { label: 'Pós-visita', emoji: '📩' },
  reward_earned: { label: 'Recompensa 10 visitas', emoji: '🎁' },
  surprise_discount: { label: 'Desconto surpresa', emoji: '🎉' },
  milestone_halfway: { label: 'Metade do caminho', emoji: '🔥' },
  reactivation: { label: 'Reativação', emoji: '💚' },
  loyalty_vip: { label: 'Cliente VIP', emoji: '🏆' },
}

const TIER_CONFIG: Record<string, { label: string; emoji: string; bg: string }> = {
  novo: { label: 'Novo', emoji: '👤', bg: 'bg-gray-100' },
  frequente: { label: 'Frequente', emoji: '⭐', bg: 'bg-yellow-50' },
  prata: { label: 'Prata', emoji: '🥈', bg: 'bg-gray-50' },
  ouro: { label: 'Ouro', emoji: '🥇', bg: 'bg-yellow-50' },
}

function fmtCurrency(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function tplLabel(key: string) {
  return TEMPLATE_LABELS[key] ?? { label: key, emoji: '📨' }
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

  if (!data) return (
    <div className="text-center py-20 text-red-500">Erro ao carregar dados</div>
  )

  const { kpis, templateBreakdown, recentReturns, tierDistribution } = data
  const totalCustomers = tierDistribution.reduce((a, b) => a + b.count, 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
        <p className="text-sm text-gray-400">Performance do programa de fidelidade — ultimos 90 dias</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-400 mb-1">Receita atribuída</p>
          <p className="text-2xl font-extrabold text-[#25D366]">{fmtCurrency(kpis.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Clientes que voltaram após mensagem</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-400 mb-1">ROI por mensagem</p>
          <p className="text-2xl font-extrabold text-gray-900">{fmtCurrency(kpis.roiPerMessage)}</p>
          <p className="text-xs text-gray-400 mt-1">{kpis.totalSent} mensagens enviadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-400 mb-1">Taxa de retorno</p>
          <p className="text-2xl font-extrabold text-gray-900">{kpis.returnRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{kpis.totalReturned} de {kpis.totalSent} voltaram</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm text-gray-400 mb-1">Mensagens</p>
          <p className="text-2xl font-extrabold text-gray-900">{kpis.totalSent}</p>
          {kpis.failedCount > 0 && (
            <p className="text-xs text-red-400 mt-1">{kpis.failedCount} falha(s)</p>
          )}
          {kpis.failedCount === 0 && (
            <p className="text-xs text-gray-400 mt-1">Nenhuma falha</p>
          )}
        </div>
      </div>

      {/* ── Performance por tipo de mensagem ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <h2 className="text-base font-bold text-gray-800 mb-3">Performance por tipo de mensagem</h2>
        {templateBreakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium text-center">Enviadas</th>
                  <th className="pb-2 font-medium text-center">Voltaram</th>
                  <th className="pb-2 font-medium text-center">Taxa</th>
                  <th className="pb-2 font-medium text-right">Receita</th>
                  <th className="pb-2 font-medium text-right">ROI/msg</th>
                </tr>
              </thead>
              <tbody>
                {templateBreakdown.map(t => {
                  const cfg = tplLabel(t.templateKey)
                  return (
                    <tr key={t.templateKey} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5">
                        <span className="mr-1.5">{cfg.emoji}</span>
                        <span className="font-medium text-gray-800">{cfg.label}</span>
                      </td>
                      <td className="py-2.5 text-center text-gray-600">{t.sent}</td>
                      <td className="py-2.5 text-center text-gray-600">{t.returned}</td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          t.returnRate >= 50 ? 'bg-green-100 text-green-700'
                            : t.returnRate >= 25 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>{t.returnRate}%</span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{fmtCurrency(t.revenue)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmtCurrency(t.roiPerMessage)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-base text-gray-500">Nenhuma mensagem enviada ainda</p>
            <p className="text-sm text-gray-400 mt-1">Registre visitas e as mensagens serao disparadas automaticamente</p>
          </div>
        )}
      </div>

      {/* ── Últimos retornos atribuídos ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <h2 className="text-base font-bold text-gray-800 mb-3">Retornos atribuídos</h2>
        <p className="text-xs text-gray-400 mb-3">Clientes que voltaram dentro de 7 dias após receber uma mensagem</p>
        {recentReturns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">Mensagem</th>
                  <th className="pb-2 font-medium text-center">Voltou após</th>
                  <th className="pb-2 font-medium text-center">Mesa</th>
                  <th className="pb-2 font-medium text-right">Gasto</th>
                </tr>
              </thead>
              <tbody>
                {recentReturns.map((r, i) => {
                  const cfg = tplLabel(r.templateKey)
                  return (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5">
                        <p className="font-medium text-gray-800">{r.customerName}</p>
                        <p className="text-xs text-gray-400">{r.customerPhone}</p>
                      </td>
                      <td className="py-2.5">
                        <span className="mr-1">{cfg.emoji}</span>
                        <span className="text-gray-700">{cfg.label}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                          {r.daysToReturn === 1 ? '1 dia' : `${r.daysToReturn} dias`}
                        </span>
                      </td>
                      <td className="py-2.5 text-center text-gray-600">
                        {r.tableNumber ? `Mesa ${r.tableNumber}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-[#25D366]">
                        {r.revenue > 0 ? fmtCurrency(r.revenue) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">Nenhum retorno atribuído ainda</p>
          </div>
        )}
      </div>

      {/* ── Distribuição por nível ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-base font-bold text-gray-800 mb-3">Distribuição por nível</h2>
        <div className="flex gap-2">
          {['novo', 'frequente', 'prata', 'ouro'].map(tier => {
            const cfg = TIER_CONFIG[tier]
            const count = tierDistribution.find(t => t.tier === tier)?.count ?? 0
            const pct = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0
            return (
              <div key={tier} className={`flex-1 rounded-xl p-3 text-center ${cfg.bg}`}>
                <p className="text-xl">{cfg.emoji}</p>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-sm font-medium text-gray-700">{cfg.label}</p>
                <p className="text-xs text-gray-400">{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
