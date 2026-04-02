import { useEffect, useState } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { api } from '../api/client'

interface AutomationSummary {
  templateKey: string
  status: string
  count: number
}

interface RecentLog {
  id: string
  templateKey: string
  status: string
  customerName: string
  customerPhone: string
  createdAt: string
}

interface TierDist {
  tier: string
  count: number
}

interface Last30 {
  templateKey: string
  count: number
}

interface AutomationStats {
  summary: AutomationSummary[]
  recent: RecentLog[]
  last30Days: Last30[]
  tierDistribution: TierDist[]
}

// Only the 6 templates that exist on Meta
const TEMPLATE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  post_visit_thanks: { label: 'Pos-visita + Consentimento', emoji: '📩', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  reward_earned: { label: 'Recompensa 10 visitas', emoji: '🎁', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  surprise_discount: { label: 'Desconto surpresa', emoji: '🎉', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  milestone_halfway: { label: 'Metade do caminho', emoji: '🔥', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  reactivation: { label: 'Reativacao', emoji: '💚', color: 'bg-green-50 text-green-700 border-green-200' },
  loyalty_vip: { label: 'Cliente VIP 20%', emoji: '🏆', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const TIER_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  novo: { label: 'Novo', emoji: '👤', color: 'bg-gray-100 text-gray-600' },
  frequente: { label: 'Frequente', emoji: '⭐', color: 'bg-yellow-100 text-yellow-700' },
  prata: { label: 'Prata', emoji: '🥈', color: 'bg-gray-200 text-gray-700' },
  ouro: { label: 'Ouro', emoji: '🥇', color: 'bg-yellow-200 text-yellow-800' },
}

export function AutomacoesPage() {
  const restaurantId = useRestaurantId()
  const [stats, setStats] = useState<AutomationStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<AutomationStats>(`/restaurants/${restaurantId}/automation-stats`)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-6 w-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
    </div>
  )

  if (!stats) return (
    <div className="text-center py-20 text-red-500 text-base">Erro ao carregar dados</div>
  )

  // Aggregate: total sent per template
  const sentByTemplate: Record<string, number> = {}
  const failedByTemplate: Record<string, number> = {}
  for (const s of stats.summary) {
    if (s.status === 'sent') sentByTemplate[s.templateKey] = (sentByTemplate[s.templateKey] ?? 0) + s.count
    if (s.status === 'failed') failedByTemplate[s.templateKey] = (failedByTemplate[s.templateKey] ?? 0) + s.count
  }

  const totalSent = Object.values(sentByTemplate).reduce((a, b) => a + b, 0)
  const totalFailed = Object.values(failedByTemplate).reduce((a, b) => a + b, 0)
  const totalCustomers = stats.tierDistribution.reduce((a, b) => a + b.count, 0)
  const last30Total = stats.last30Days.reduce((a, b) => a + b.count, 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Automacoes</h1>
        <p className="text-sm text-gray-400">Mensagens enviadas automaticamente pelo programa de fidelidade</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Mensagens enviadas', value: totalSent, color: 'text-[#25D366]' },
          { label: 'Ultimos 30 dias', value: last30Total, color: 'text-blue-600' },
          { label: 'Falhas', value: totalFailed, color: totalFailed > 0 ? 'text-red-500' : 'text-gray-400' },
          { label: 'Clientes no programa', value: totalCustomers, color: 'text-gray-900' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-sm text-gray-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tier Distribution */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <h2 className="text-base font-bold text-gray-800 mb-3">Distribuicao por nivel</h2>
        <div className="flex gap-2">
          {['novo', 'frequente', 'prata', 'ouro'].map(tier => {
            const cfg = TIER_CONFIG[tier]
            const count = stats.tierDistribution.find(t => t.tier === tier)?.count ?? 0
            const pct = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0
            return (
              <div key={tier} className={`flex-1 rounded-xl p-3 text-center border ${cfg.color}`}>
                <p className="text-2xl">{cfg.emoji}</p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm font-medium">{cfg.label}</p>
                <p className="text-sm opacity-60">{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Messages by type */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <h2 className="text-base font-bold text-gray-800 mb-3">Mensagens por tipo</h2>
        <div className="space-y-2">
          {Object.entries(TEMPLATE_LABELS).map(([key, cfg]) => {
            const sent = sentByTemplate[key] ?? 0
            const failed = failedByTemplate[key] ?? 0
            if (sent === 0 && failed === 0) return null
            const successRate = sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 0
            return (
              <div key={key} className={`flex items-center gap-3 rounded-xl border p-3 ${cfg.color}`}>
                <span className="text-2xl">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold">{cfg.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-white/50 rounded-full overflow-hidden">
                      <div className="h-full bg-current rounded-full opacity-40" style={{ width: `${successRate}%` }} />
                    </div>
                    <span className="text-sm font-medium">{successRate}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{sent}</p>
                  <p className="text-sm opacity-60">enviadas</p>
                </div>
              </div>
            )
          })}
          {totalSent === 0 && totalFailed === 0 && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-base text-gray-500">Nenhuma mensagem automatica enviada ainda</p>
              <p className="text-sm text-gray-400 mt-1">Registre visitas e as mensagens serao disparadas automaticamente</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {stats.recent.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-base font-bold text-gray-800 mb-3">Atividade recente</h2>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {stats.recent.map(log => {
              const cfg = TEMPLATE_LABELS[log.templateKey] ?? { label: log.templateKey, emoji: '📨', color: 'bg-gray-50 text-gray-600' }
              return (
                <div key={log.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-lg">{cfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{log.customerName}</p>
                    <p className="text-sm text-gray-400">{cfg.label}</p>
                  </div>
                  <span className={`text-sm px-1.5 py-0.5 rounded-full font-medium ${
                    log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {log.status === 'sent' ? 'Enviada' : 'Falhou'}
                  </span>
                  <span className="text-sm text-gray-400 w-20 text-right">
                    {new Date(log.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
