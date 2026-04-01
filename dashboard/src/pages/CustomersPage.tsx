import { useEffect, useState, useRef } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { getCustomers, updateCustomerStatus, updateLastVisitAmount } from '../api/customers'
import { StatusBadge } from '../components/StatusBadge'
import type { Customer } from '../types'

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function CustomersPage() {
  const restaurantId = useRestaurantId()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  // Warning dialog state
  const [confirmCustomer, setConfirmCustomer] = useState<Customer | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCustomers(restaurantId)
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleToggleStatus = (customer: Customer) => {
    if (customer.lifecycleStatus === 'inactive') {
      setConfirmCustomer(customer)
    } else {
      doToggle(customer, 'inactive')
    }
  }

  const doToggle = async (customer: Customer, newStatus: 'active' | 'inactive') => {
    setToggling(customer.id)
    setConfirmCustomer(null)
    try {
      const updated = await updateCustomerStatus(restaurantId, customer.id, newStatus)
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, lifecycleStatus: updated.lifecycleStatus } : c))
    } catch (e) {
      console.error(e)
    } finally {
      setToggling(null)
    }
  }

  // --- Inline edit for lastVisitAmount ---
  const startEdit = (c: Customer) => {
    setEditingId(c.id)
    setEditValue(c.lastVisitAmount != null ? String(c.lastVisitAmount) : '')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const saveEdit = async (customerId: string) => {
    if (editingId === null) return // guard against double-save (onBlur + onKeyDown)
    const amount = parseFloat(editValue.replace(',', '.'))
    if (isNaN(amount) || amount < 0) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      const updated = await updateLastVisitAmount(restaurantId, customerId, amount)
      setCustomers(prev => prev.map(c => c.id === customerId ? {
        ...c,
        lastVisitAmount: updated.lastVisitAmount,
        totalSpent: updated.totalSpent,
        avgTicket: updated.avgTicket,
      } : c))
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
      setEditingId(null)
      setEditValue('')
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, customerId: string) => {
    if (e.key === 'Enter') saveEdit(customerId)
    if (e.key === 'Escape') cancelEdit()
  }

  const filtered = customers
    .filter(c =>
      (c.name?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
      c.phone.includes(search)
    )
    .filter(c => filter === 'all' || c.lifecycleStatus === filter)

  if (loading) return <div className="text-center py-20 text-gray-400 text-xs">Carregando...</div>

  return (
    <div>
      <h1 className="text-lg font-bold text-gray-900 mb-4">Clientes</h1>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-xs">Nenhum cliente encontrado</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-left px-4 py-2">Telefone</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Visitas</th>
                <th className="text-right px-4 py-2">Gasto Ultima Visita</th>
                <th className="text-right px-4 py-2">Gasto Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{c.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleToggleStatus(c)}
                      disabled={toggling === c.id}
                      className="cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-40"
                      title={c.lifecycleStatus === 'active' ? 'Clique para desativar' : 'Clique para ativar'}
                    >
                      <StatusBadge status={c.lifecycleStatus} />
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">{c.totalVisits}</td>
                  <td className="px-4 py-2 text-right">
                    {editingId === c.id ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => handleEditKeyDown(e, c.id)}
                        onBlur={() => saveEdit(c.id)}
                        disabled={saving}
                        className="w-20 text-right border border-[#25D366] rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                        placeholder="0.00"
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(c)}
                        className="cursor-pointer hover:bg-green-50 hover:text-[#25D366] rounded px-1.5 py-0.5 transition-colors"
                        title="Clique para editar"
                      >
                        {c.lastVisitAmount != null ? formatBRL(c.lastVisitAmount) : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{formatBRL(c.totalSpent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3">{filtered.length} cliente(s)</p>

      {/* Warning dialog — activate without ads consent */}
      {confirmCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-gray-900">Atencao — Risco de privacidade</h3>
            </div>

            <p className="text-[11px] text-gray-600 mb-1">
              <strong>{confirmCustomer.name ?? confirmCustomer.phone}</strong> nao deu consentimento para receber campanhas de marketing (ads).
            </p>
            <p className="text-[11px] text-gray-600 mb-4">
              Ativar este cliente sem consentimento pode violar a <strong>LGPD</strong> e prejudicar a reputacao do seu numero no <strong>WhatsApp Business</strong> (risco de bloqueio).
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCustomer(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => doToggle(confirmCustomer, 'active')}
                className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-yellow-600"
              >
                Ativar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
