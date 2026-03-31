import { useState } from 'react'
import { RESTAURANT_ID } from '../config'
import { recordVisit } from '../api/visits'

export function VisitPage() {
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) return

    setSubmitting(true)
    setSuccess(false)
    try {
      await recordVisit(RESTAURANT_ID, {
        phone: phone.trim(),
        amount: amount ? parseFloat(amount) : undefined,
      })
      setSuccess(true)
      setPhone('')
      setAmount('')
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-lg font-bold text-gray-900 mb-4">Registrar Visita</h1>

      {/* Manual registration form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+5511999999999"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]"
          />
        </div>

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

        <button
          type="submit"
          disabled={submitting || !phone.trim()}
          className="w-full bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Registrando...' : 'Registrar Visita'}
        </button>
      </form>

      {success && (
        <div className="mt-3 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-xs">
          Visita registrada com sucesso!
        </div>
      )}

      {/* Automation CTA */}
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar com suporte
          </a>
        </div>
      </div>
    </div>
  )
}
