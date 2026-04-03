import { useEffect, useState } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { api } from '../api/client'
import { getCustomers } from '../api/customers'
import { recordVisit } from '../api/visits'
import type { Customer } from '../types'

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

const PERIOD_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
]

function fmtCurrency(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function AutomacoesPage() {
  const restaurantId = useRestaurantId()
  const [kpiData, setKpiData] = useState<AutomationKpis | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(90)

  // Inline visit registration
  const [visitingId, setVisitingId] = useState<string | null>(null)
  const [visitAmount, setVisitAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Search
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    Promise.all([
      api<AutomationKpis>(`/restaurants/${restaurantId}/automation-stats?days=${days}`).catch(() => null),
      getCustomers(restaurantId),
    ]).then(([kpi, custs]) => {
      setKpiData(kpi)
      setCustomers(custs)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [restaurantId, days])

  const handleRecordVisit = async (customer: Customer) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await recordVisit(restaurantId, {
        phone: customer.phone,
        customerName: customer.name || undefined,
        amount: visitAmount ? parseFloat(visitAmount) : undefined,
      })
      // Refresh customers
      const updated = await getCustomers(restaurantId)
      setCustomers(updated)
      setVisitingId(null)
      setVisitAmount('')
      // Refresh KPIs
      api<AutomationKpis>(`/restaurants/${restaurantId}/automation-stats?days=${days}`)
        .then(setKpiData).catch(() => {})
    } catch (e) {
      console.error(e)
      alert('Erro ao registrar visita')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-6 w-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
    </div>
  )

  // Demo fallback when no real data
  const kpis = kpiData?.kpis?.totalSent
    ? kpiData.kpis
    : { totalSent: 0, totalReturned: 0, returnRate: 0, totalRevenue: 0, roiPerMessage: 0, failedCount: 0 }
  const recentReturns = kpiData?.recentReturns ?? []
  const hasKpis = kpis.totalSent > 0
  const periodLabel = PERIOD_OPTIONS.find(p => p.days === days)?.label ?? `${days} dias`

  // Filter customers
  const filtered = customers.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.name?.toLowerCase().includes(q)) || c.phone.includes(q)
  })

  return (
    <div>
      {/* ── KPI Section ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel</h1>
          <p className="text-sm text-gray-400">Clientes, visitas e resultados em um so lugar</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                days === p.days
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {hasKpis && (
        <>
          <div className="bg-[#1a1a2e] rounded-2xl p-5 mb-3 text-center">
            <p className="text-sm text-gray-400 mb-1">Receita gerada pelo Retorna — {periodLabel}</p>
            <p className="text-3xl font-extrabold text-[#25D366]">{fmtCurrency(kpis.totalRevenue)}</p>
            <p className="text-sm text-gray-400 mt-1">
              {kpis.totalReturned} cliente{kpis.totalReturned !== 1 ? 's' : ''} voltou apos receber mensagem
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 text-center">
              <p className="text-xl font-extrabold text-gray-900">{kpis.totalSent}</p>
              <p className="text-xs text-gray-400">Mensagens</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 text-center">
              <p className="text-xl font-extrabold text-gray-900">{kpis.returnRate}%</p>
              <p className="text-xs text-gray-400">Retorno</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-2.5 text-center">
              <p className="text-xl font-extrabold text-gray-900">{fmtCurrency(kpis.roiPerMessage)}</p>
              <p className="text-xs text-gray-400">Por msg</p>
            </div>
          </div>
        </>
      )}

      {/* ── Customers + Inline Visit Registration ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">Clientes</h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome ou telefone..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[#25D366]"
          />
        </div>

        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100 text-xs">
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Telefone</th>
                  <th className="px-4 py-2 font-medium text-center">Ultima visita</th>
                  <th className="px-4 py-2 font-medium text-center">Visitas</th>
                  <th className="px-4 py-2 font-medium text-right">Gasto total</th>
                  <th className="px-4 py-2 font-medium text-center">Acao</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{c.name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.lifecycleStatus === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {c.lifecycleStatus === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{c.phone}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-gray-600">{fmtDate(c.lastVisitAt)}</span>
                      {c.lastVisitAmount != null && c.lastVisitAmount > 0 && (
                        <span className="text-xs text-gray-400 ml-1">({fmtCurrency(c.lastVisitAmount)})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-gray-800">{c.totalVisits}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmtCurrency(c.totalSpent)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {visitingId === c.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <span className="text-xs text-gray-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={visitAmount}
                            onChange={e => setVisitAmount(e.target.value)}
                            placeholder="0"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRecordVisit(c)
                              if (e.key === 'Escape') { setVisitingId(null); setVisitAmount('') }
                            }}
                            className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                          />
                          <button
                            onClick={() => handleRecordVisit(c)}
                            disabled={submitting}
                            className="bg-[#25D366] text-white px-2 py-0.5 rounded text-xs font-semibold hover:bg-[#1DA851] disabled:opacity-50">
                            {submitting ? '...' : 'OK'}
                          </button>
                          <button
                            onClick={() => { setVisitingId(null); setVisitAmount('') }}
                            className="text-gray-400 hover:text-gray-600 text-xs px-1">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setVisitingId(c.id)}
                          className="bg-[#25D366] text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-[#1DA851] transition-colors">
                          + Visita
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400">
            {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </div>
        )}
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          {filtered.length} cliente(s)
        </div>
      </div>

      {/* ── Attributed Returns ── */}
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
    </div>
  )
}
