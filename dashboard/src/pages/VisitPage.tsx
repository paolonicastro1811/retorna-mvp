import { useState, useRef, useCallback } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { recordVisit } from '../api/visits'
import { searchCustomers } from '../api/customers'
import { WhatsAppIcon } from '../components/icons'
import type { CustomerSearchResult, VisitResponse } from '../types'

const TIER_EMOJI: Record<string, string> = {
  novo: '👤',
  frequente: '⭐',
  prata: '🥈',
  ouro: '🥇',
}
const TIER_LABEL: Record<string, string> = {
  novo: 'Novo',
  frequente: 'Frequente',
  prata: 'Prata',
  ouro: 'Ouro',
}
const TIER_COLOR: Record<string, string> = {
  novo: 'bg-gray-100 text-gray-700',
  frequente: 'bg-yellow-100 text-yellow-800',
  prata: 'bg-gray-200 text-gray-800',
  ouro: 'bg-amber-100 text-amber-800',
}

export function VisitPage() {
  const restaurantId = useRestaurantId()
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<VisitResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search state
  const [results, setResults] = useState<CustomerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<CustomerSearchResult | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 3) { setResults([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchCustomers(restaurantId, q)
        setResults(data)
        setShowDropdown(data.length > 0)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }, [])

  const handlePhoneChange = (val: string) => {
    setPhone(val)
    setSelected(null)
    setResult(null)
    doSearch(val)
  }

  const selectCustomer = (c: CustomerSearchResult) => {
    setSelected(c)
    setPhone(c.phone)
    setShowDropdown(false)
    setResults([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return

    setSubmitting(true)
    setResult(null)
    setError(null)
    try {
      const res = await recordVisit(restaurantId, {
        phone: phone.trim(),
        customerName: selected?.name || undefined,
        amount: amount ? parseFloat(amount) : undefined,
      })
      setResult(res)
    } catch (e) {
      console.error(e)
      setError('Erro ao registrar visita. Tente novamente.')
    }
    finally { setSubmitting(false) }
  }

  const reset = () => {
    setPhone('')
    setAmount('')
    setResult(null)
    setError(null)
    setSelected(null)
    setResults([])
  }

  // If we have a result, show success screen
  if (result) {
    const lf = result.loyaltyFeedback
    return (
      <div className="max-w-sm">
        <h1 className="text-lg font-bold text-gray-900 mb-4">Registrar Visita</h1>

        {/* Success card */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center text-white text-sm">✓</div>
            <div>
              <p className="text-sm font-bold text-green-900">Visita registrada!</p>
              <p className="text-xs text-green-700">{result.customer.name || phone}</p>
            </div>
          </div>

          {lf && (
            <div className="space-y-2 mt-3 pt-3 border-t border-green-200">
              {/* Tier + visits */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-green-800">Nivel atual</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_COLOR[lf.tier] || TIER_COLOR.novo}`}>
                  {TIER_EMOJI[lf.tier] || ''} {TIER_LABEL[lf.tier] || lf.tier}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-green-800">Total de visitas</span>
                <span className="text-xs font-bold text-green-900">{lf.totalVisits}</span>
              </div>

              {/* Progress to next tier */}
              {lf.nextTier ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-green-700">
                      Faltam <strong>{lf.visitsToNextTier}</strong> para {TIER_EMOJI[lf.nextTier]} {TIER_LABEL[lf.nextTier] || lf.nextTier}
                    </span>
                  </div>
                  <div className="h-1.5 bg-green-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#25D366] rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((lf.totalVisits) / (lf.totalVisits + lf.visitsToNextTier)) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-green-700 font-semibold">🥇 Nivel maximo atingido!</p>
              )}

              {/* Streak */}
              {lf.streakTarget > 0 && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-green-800">Sequencia semanal</span>
                  <span className="text-xs font-bold text-green-900">
                    🔥 {lf.currentStreak}/{lf.streakTarget}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={reset}
          className="w-full bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] transition-colors"
        >
          Registrar outra visita
        </button>

        <AutomationCTA />
      </div>
    )
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-lg font-bold text-gray-900 mb-4">Registrar Visita</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Phone input with search */}
        <div className="relative">
          <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => handlePhoneChange(e.target.value)}
            placeholder="+5511999999999"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
          />
          {searching && (
            <div className="absolute right-3 top-7">
              <div className="w-3 h-3 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Search dropdown */}
          {showDropdown && results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCustomer(c)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
                >
                  <div>
                    <p className="text-xs font-medium text-gray-900">{c.name || 'Sem nome'}</p>
                    <p className="text-[10px] text-gray-500">{c.phone}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TIER_COLOR[c.tier] || TIER_COLOR.novo}`}>
                    {TIER_EMOJI[c.tier] || ''} {TIER_LABEL[c.tier] || c.tier}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected customer card */}
        {selected && (
          <div className="bg-[#1a1a2e] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-white">{selected.name || 'Sem nome'}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TIER_COLOR[selected.tier]}`}>
                {TIER_EMOJI[selected.tier]} {TIER_LABEL[selected.tier]}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-gray-400">Visitas</p>
                <p className="text-xs font-bold text-white">{selected.totalVisits}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Sequencia</p>
                <p className="text-xs font-bold text-white">🔥 {selected.currentStreak}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Ultima visita</p>
                <p className="text-xs font-bold text-white">
                  {selected.lastVisitAt
                    ? new Date(selected.lastVisitAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="85.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !phone.trim()}
          className="w-full bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Registrando...' : 'Registrar Visita'}
        </button>
      </form>

      <AutomationCTA />
    </div>
  )
}

function AutomationCTA() {
  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <div className="bg-[#1a1a2e] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <h3 className="text-xs font-bold text-white">Quer automatizar?</h3>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">
          Cada restaurante tem seu proprio sistema. Podemos configurar a integracao automatica com o seu POS, maquininha ou sistema de pedidos.
        </p>
        <a
          href="https://wa.me/5511999999999?text=Oi!%20Quero%20saber%20mais%20sobre%20a%20automacao%20de%20registro%20de%20visitas"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-[#1DA851] transition-colors"
        >
          <WhatsAppIcon size={12} />
          Falar com suporte
        </a>
      </div>
    </div>
  )
}
