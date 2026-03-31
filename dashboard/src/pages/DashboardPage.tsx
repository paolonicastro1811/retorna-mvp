import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RESTAURANT_ID } from '../config'
import { getReport } from '../api/report'
import { refreshLifecycle } from '../api/jobs'
import { KpiCard } from '../components/KpiCard'
import type { DemoReport } from '../types'

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR')

export function DashboardPage() {
  const navigate = useNavigate()
  const [report, setReport] = useState<DemoReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = () => {
    setLoading(true)
    getReport(RESTAURANT_ID)
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshLifecycle(RESTAURANT_ID)
      load()
    } catch (e) {
      console.error(e)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400 text-xs">Carregando...</div>
  if (!report) return <div className="text-center py-20 text-red-500 text-xs">Erro ao carregar dados</div>

  const { customers, reactivation } = report

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-gray-900">Painel</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {refreshing ? 'Atualizando...' : 'Atualizar ciclo de vida'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard title="Total de Clientes" value={customers.total} />
        <KpiCard title="Ativos" value={customers.lifecycle.active} accent="text-green-600" />
        <KpiCard title="Em Risco" value={customers.lifecycle.at_risk} accent="text-yellow-600" />
        <KpiCard title="Inativos" value={customers.lifecycle.inactive} accent="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <KpiCard title="Receita de Reativacao" value={formatBRL(reactivation.total_revenue)} accent="text-[#0f9d58]" />
        <KpiCard title="Clientes Reativados" value={reactivation.reactivated_customers} accent="text-[#0f9d58]" />
        <KpiCard title="ROI por Mensagem" value={reactivation.roi_estimate || 'N/A'} accent="text-[#0f9d58]" />
      </div>

      {/* CTA */}
      <div className="bg-[#25D366] rounded-xl p-5 text-white flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-bold">Recupere seus clientes inativos</h2>
          <p className="text-white/70 text-xs mt-0.5">Lance uma campanha de reativacao em menos de 2 minutos</p>
        </div>
        <button
          onClick={() => navigate('/painel/campanhas')}
          className="bg-white text-[#1a1a2e] font-bold text-xs px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
        >
          Enviar campanha agora
        </button>
      </div>

      {/* Attribution table */}
      {reactivation.details.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Ultimas visitas atribuidas</h2>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase">
              <tr>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-right px-4 py-2">Valor</th>
                <th className="text-right px-4 py-2">Data da Visita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reactivation.details.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{d.customer}</td>
                  <td className="px-4 py-2 text-right text-[#25D366] font-semibold">{formatBRL(d.revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatDate(d.visit_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
