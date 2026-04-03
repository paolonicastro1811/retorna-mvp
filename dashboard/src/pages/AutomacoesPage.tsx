import { useEffect, useState, useRef, useCallback } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { api } from '../api/client'
import { getCustomers, updateLastVisitAmount, updateCustomerStatus } from '../api/customers'
import { recordVisit } from '../api/visits'
import { WhatsAppIcon } from '../components/icons'
import type { Customer } from '../types'

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

function getClockInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
}

export function AutomacoesPage() {
  const restaurantId = useRestaurantId()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(90)
  const [search, setSearch] = useState('')
  const [restaurantTz, setRestaurantTz] = useState('America/Sao_Paulo')
  const [clock, setClock] = useState('')

  // Inline visit registration
  const [visitingId, setVisitingId] = useState<string | null>(null)
  const [visitAmount, setVisitAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Inline amount edit
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null)
  const [editAmountValue, setEditAmountValue] = useState('')
  const [savingAmount, setSavingAmount] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Track recently updated rows for flash animation
  const [flashId, setFlashId] = useState<string | null>(null)

  // Status toggle confirmation
  const [statusConfirmId, setStatusConfirmId] = useState<string | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)

  // Live clock in restaurant timezone
  const updateClock = useCallback(() => setClock(getClockInTz(restaurantTz)), [restaurantTz])
  useEffect(() => {
    updateClock()
    const iv = setInterval(updateClock, 30000)
    return () => clearInterval(iv)
  }, [updateClock])

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    Promise.all([
      getCustomers(restaurantId).catch(() => [] as Customer[]),
      api<{ timezone: string }>(`/restaurants/${restaurantId}`).catch(() => null),
    ]).then(([custs, rest]) => {
      setCustomers(custs)
      if (rest?.timezone) setRestaurantTz(rest.timezone)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [restaurantId, days])

  useEffect(() => {
    if (editingAmountId && amountInputRef.current) amountInputRef.current.focus()
  }, [editingAmountId])

  const handleRecordVisit = async (customer: Customer) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const result = await recordVisit(restaurantId, {
        phone: customer.phone,
        customerName: customer.name || undefined,
        amount: visitAmount ? parseFloat(visitAmount) : undefined,
      })
      const updatedCustomer = result.customer
      setCustomers(prev => prev.map(c =>
        c.id === customer.id
          ? { ...c, totalVisits: updatedCustomer.totalVisits, totalSpent: updatedCustomer.totalSpent, lastVisitAt: updatedCustomer.lastVisitAt, lastVisitAmount: updatedCustomer.lastVisitAmount, lifecycleStatus: updatedCustomer.lifecycleStatus }
          : c
      ))
      setVisitingId(null)
      setVisitAmount('')
      setFlashId(customer.id)
      setTimeout(() => setFlashId(null), 1500)
    } catch {
      alert('Erro ao registrar visita')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveAmount = async (customer: Customer) => {
    if (savingAmount || !editAmountValue) return
    setSavingAmount(true)
    try {
      const updated = await updateLastVisitAmount(restaurantId, customer.id, parseFloat(editAmountValue))
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, lastVisitAmount: updated.lastVisitAmount, totalSpent: updated.totalSpent } : c))
      setEditingAmountId(null)
      setEditAmountValue('')
      setFlashId(customer.id)
      setTimeout(() => setFlashId(null), 1500)
    } catch {
      alert('Erro ao salvar valor')
    } finally {
      setSavingAmount(false)
    }
  }

  const handleToggleStatus = async (customer: Customer) => {
    setTogglingStatus(true)
    const newStatus = customer.lifecycleStatus === 'active' ? 'inactive' : 'active'
    try {
      const updated = await updateCustomerStatus(restaurantId, customer.id, newStatus)
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, lifecycleStatus: updated.lifecycleStatus } : c))
      setStatusConfirmId(null)
      setFlashId(customer.id)
      setTimeout(() => setFlashId(null), 1500)
    } catch {
      alert('Erro ao alterar status')
    } finally {
      setTogglingStatus(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin h-6 w-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
    </div>
  )

  // KPIs computed from real customer data
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0)
  const totalVisits = customers.reduce((s, c) => s + c.totalVisits, 0)
  const avgTicket = totalVisits > 0 ? Math.round(totalRevenue / totalVisits) : 0
  const activeCount = customers.filter(c => c.lifecycleStatus === 'active').length

  const filtered = customers.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.name?.toLowerCase().includes(q)) || c.phone.includes(q)
  })

  const confirmCustomer = customers.find(c => c.id === statusConfirmId)

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel</h1>
          {clock && <p className="text-xs text-gray-400 capitalize">{clock}</p>}
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

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-[#1a1a2e] rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-[#25D366]">{fmtCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-400">Receita total</p>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-white">{customers.length}</p>
          <p className="text-xs text-gray-400">Clientes</p>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-white">{activeCount}</p>
          <p className="text-xs text-gray-400">Ativos</p>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-white">{fmtCurrency(avgTicket)}</p>
          <p className="text-xs text-gray-400">Ticket médio</p>
        </div>
      </div>

      {/* ── Customers Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">Clientes</h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[#25D366]"
          />
        </div>

        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100 text-xs uppercase tracking-wider">
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Telefone</th>
                  <th className="px-4 py-2 font-medium text-center">Visitas</th>
                  <th className="px-4 py-2 font-medium text-center">Última visita</th>
                  <th className="px-4 py-2 font-medium text-right">Gasto últ. visita</th>
                  <th className="px-4 py-2 font-medium text-right">Gasto total</th>
                  <th className="px-4 py-2 font-medium text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={`border-b border-gray-50 last:border-0 transition-colors duration-700 ${
                    flashId === c.id ? 'bg-green-100' : 'hover:bg-gray-50/50'
                  }`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{c.name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setStatusConfirmId(c.id)}
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 ${
                          c.lifecycleStatus === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                        title="Clique para alterar status"
                      >
                        {c.lifecycleStatus === 'active' ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{c.phone}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-gray-800">{c.totalVisits}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{fmtDate(c.lastVisitAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {editingAmountId === c.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-xs text-gray-400">R$</span>
                          <input
                            ref={amountInputRef}
                            type="number"
                            step="0.01"
                            min="0"
                            value={editAmountValue}
                            onChange={e => setEditAmountValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveAmount(c)
                              if (e.key === 'Escape') { setEditingAmountId(null); setEditAmountValue('') }
                            }}
                            className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                          />
                          <button onClick={() => handleSaveAmount(c)} disabled={savingAmount}
                            className="text-[#25D366] font-bold text-xs hover:text-[#1DA851]">
                            {savingAmount ? '...' : '✓'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingAmountId(c.id); setEditAmountValue(c.lastVisitAmount ? String(c.lastVisitAmount) : '') }}
                          className="text-gray-600 hover:text-[#25D366] transition-colors cursor-pointer"
                          title="Clique para editar">
                          {c.lastVisitAmount != null && c.lastVisitAmount > 0
                            ? fmtCurrency(c.lastVisitAmount)
                            : <span className="text-gray-300">+ valor</span>}
                        </button>
                      )}
                    </td>
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
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRecordVisit(c)
                              if (e.key === 'Escape') { setVisitingId(null); setVisitAmount('') }
                            }}
                            className="w-16 border border-gray-200 rounded px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                          />
                          <button onClick={() => handleRecordVisit(c)} disabled={submitting}
                            className="bg-[#25D366] text-white px-2 py-0.5 rounded text-xs font-semibold hover:bg-[#1DA851] disabled:opacity-50">
                            {submitting ? '...' : 'OK'}
                          </button>
                          <button onClick={() => { setVisitingId(null); setVisitAmount('') }}
                            className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setVisitingId(c.id)}
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

      {/* ── CTA: Quer automatizar? ── */}
      <div className="bg-[#1a1a2e] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <h3 className="text-base font-bold text-white">Quer automatizar?</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          Cada restaurante tem seu próprio sistema. Podemos configurar a integração automática com o seu POS, maquininha ou sistema de pedidos.
        </p>
        <a
          href="https://wa.me/5511999999999?text=Oi!%20Quero%20saber%20mais%20sobre%20a%20automação%20de%20registro%20de%20visitas"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#1DA851] transition-colors"
        >
          <WhatsAppIcon size={12} />
          Falar com suporte
        </a>
      </div>

      {/* ── Status Change Confirm Dialog ── */}
      {statusConfirmId && confirmCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setStatusConfirmId(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Alterar status</h3>
            {confirmCustomer.lifecycleStatus === 'active' ? (
              <>
                <p className="text-sm text-gray-600 mb-1">
                  Marcar <strong>{confirmCustomer.name || confirmCustomer.phone}</strong> como <span className="text-red-600 font-semibold">Inativo</span>?
                </p>
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-4">
                  ⚠ Clientes inativos podem receber mensagens de reativação automática se o plano automático estiver ativo.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                Marcar <strong>{confirmCustomer.name || confirmCustomer.phone}</strong> como <span className="text-green-600 font-semibold">Ativo</span>?
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusConfirmId(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleToggleStatus(confirmCustomer)}
                disabled={togglingStatus}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${
                  confirmCustomer.lifecycleStatus === 'active'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-[#25D366] hover:bg-[#1DA851]'
                }`}
              >
                {togglingStatus ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
