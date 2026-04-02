import { useState, useEffect } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { getLiveStats } from '../api/liveStats'
import type { LiveStats } from '../types'

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800',
  seated: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
}
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmada',
  seated: 'Sentado',
  completed: 'Concluida',
  pending: 'Pendente',
}

export function SalaAoVivoPage() {
  const restaurantId = useRestaurantId()
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchStats = async () => {
    try {
      const data = await getLiveStats(restaurantId)
      setStats(data)
      setLastUpdate(new Date())
    } catch (e) {
      console.error('Failed to fetch live stats:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15_000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) return <p className="text-lg text-gray-500">Erro ao carregar dados</p>

  const occupancyPct = stats.tablesTotal > 0
    ? Math.round((stats.tablesOccupied / stats.tablesTotal) * 100)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Sala ao Vivo</h1>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#25D366]" />
          </span>
        </div>
        <span className="text-base text-gray-400">
          Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Tables */}
        <StatCard
          label="Mesas Ocupadas"
          value={`${stats.tablesOccupied} / ${stats.tablesTotal}`}
          sub={`${occupancyPct}% ocupacao`}
          color={occupancyPct > 80 ? 'red' : occupancyPct > 50 ? 'amber' : 'green'}
        >
          <OccupancyRing pct={occupancyPct} />
        </StatCard>

        {/* Revenue */}
        <StatCard
          label="Faturamento Hoje"
          value={`R$ ${stats.revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sub="receita do dia"
          color="green"
        />

        {/* Customers served */}
        <StatCard
          label="Clientes Atendidos"
          value={String(stats.customersServedToday)}
          sub="hoje"
          color="blue"
        />

        {/* Avg ticket */}
        <StatCard
          label="Ticket Medio"
          value={`R$ ${stats.avgTicketToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          sub="por cliente"
          color="purple"
        />
      </div>

      {/* Reservations timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Reservas de Hoje
          <span className="ml-2 text-base font-normal text-gray-500">
            {stats.reservations.length} reserva(s)
          </span>
        </h2>

        {stats.reservations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-base text-gray-400">Nenhuma reserva para hoje</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.reservations.map(r => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {/* Time */}
                <div className="w-12 text-center">
                  <span className="text-lg font-bold text-gray-900">{r.time}</span>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-gray-300" />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-gray-900 truncate">
                    {r.customerName || 'Cliente'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base text-gray-500">
                      {r.guests}p
                    </span>
                    {r.table && (
                      <span className="text-base text-gray-500">
                        Mesa {r.table.tableNumber}{r.table.label ? ` (${r.table.label})` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-base font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[r.status] || r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────

function StatCard({ label, value, sub, color, children }: {
  label: string
  value: string
  sub: string
  color: 'green' | 'red' | 'amber' | 'blue' | 'purple'
  children?: React.ReactNode
}) {
  const borderColor = {
    green: 'border-l-[#25D366]',
    red: 'border-l-red-500',
    amber: 'border-l-amber-500',
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
  }[color]

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${borderColor} rounded-lg p-3`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-base text-gray-400 mt-0.5">{sub}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function OccupancyRing({ pct }: { pct: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const stroke = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#25D366'

  return (
    <svg width="40" height="40" className="flex-shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke={stroke} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        className="transition-all duration-700"
      />
      <text x="20" y="20" textAnchor="middle" dy="0.35em" className="text-sm font-bold fill-gray-700">
        {pct}%
      </text>
    </svg>
  )
}
