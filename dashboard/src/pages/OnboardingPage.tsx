import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

interface TableRow { seats: number; qty: number }

const DEFAULT_HOURS = [
  { day: 'Domingo', dayOfWeek: 0, open: '11:30', close: '23:00', closed: false },
  { day: 'Segunda', dayOfWeek: 1, open: '11:30', close: '23:00', closed: true },
  { day: 'Terca', dayOfWeek: 2, open: '11:30', close: '23:00', closed: false },
  { day: 'Quarta', dayOfWeek: 3, open: '11:30', close: '23:00', closed: false },
  { day: 'Quinta', dayOfWeek: 4, open: '11:30', close: '23:00', closed: false },
  { day: 'Sexta', dayOfWeek: 5, open: '11:30', close: '23:00', closed: false },
  { day: 'Sabado', dayOfWeek: 6, open: '11:30', close: '23:00', closed: false },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<'manual' | 'automatic' | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Plan B fields
  const [tableRows, setTableRows] = useState<TableRow[]>([{ seats: 2, qty: 2 }, { seats: 4, qty: 2 }])
  const [hours, setHours] = useState(DEFAULT_HOURS)

  const totalSteps = plan === 'automatic' ? 4 : 3

  const totalSeats = tableRows.reduce((sum, r) => sum + r.seats * r.qty, 0)
  const totalTables = tableRows.reduce((sum, r) => sum + r.qty, 0)

  const addTableRow = () => setTableRows([...tableRows, { seats: 2, qty: 1 }])
  const removeTableRow = (i: number) => setTableRows(tableRows.filter((_, idx) => idx !== i))
  const updateTableRow = (i: number, field: 'seats' | 'qty', val: number) => {
    setTableRows(tableRows.map((r, idx) => idx === i ? { ...r, [field]: Math.max(1, val) } : r))
  }

  const updateHour = (i: number, field: string, val: string | boolean) => {
    setHours(hours.map((h, idx) => idx === i ? { ...h, [field]: val } : h))
  }

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !plan || !email.trim()) return
    setSubmitting(true)
    try {
      const res = await api<{
        id: string
        token?: string
        user?: { id: string; email: string; name: string | null }
      }>('/restaurants', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          plan,
          email: email.trim(),
          ownerName: name.trim(),
        }),
      })

      const rid = res.id

      // Auto-login with JWT returned from onboarding
      if (res.token && res.user) {
        login(res.token, {
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          restaurantId: rid,
          restaurantName: name.trim(),
        })
      }

      localStorage.setItem('restaurantId', rid)
      localStorage.setItem('restaurantName', name.trim())
      localStorage.setItem('restaurantPlan', plan)

      // Save tables + hours for Plan B
      if (plan === 'automatic') {
        const tables: { tableNumber: number; seats: number }[] = []
        let num = 1
        for (const row of tableRows) {
          for (let i = 0; i < row.qty; i++) {
            tables.push({ tableNumber: num++, seats: row.seats })
          }
        }
        await api(`/restaurants/${rid}/tables`, {
          method: 'POST',
          body: JSON.stringify({ tables }),
        })

        await api(`/restaurants/${rid}/hours`, {
          method: 'POST',
          body: JSON.stringify({
            hours: hours.map(h => ({
              dayOfWeek: h.dayOfWeek,
              openTime: h.open,
              closeTime: h.close,
              isClosed: h.closed,
            })),
          }),
        })
      }

      setDone(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-lg font-extrabold text-[#1a1a2e] mb-2">Pronto!</h1>
          <p className="text-[#6b7280] text-xs mb-6">
            Seu restaurante <strong>{name}</strong> foi cadastrado com o plano <strong>{plan === 'manual' ? 'Manual' : 'Automatico'}</strong>.
          </p>
          <button
            onClick={() => navigate('/painel')}
            className="w-full bg-[#25D366] text-white py-2.5 rounded-lg font-bold text-xs hover:bg-[#1DA851] transition-colors"
          >
            Entrar no painel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-lg font-extrabold text-[#1a1a2e]">Ative seu restaurante</h1>
          <p className="text-[#6b7280] text-[10px] mt-1">Leva menos de 1 minuto</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${step >= i + 1 ? 'bg-[#25D366]' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Passo 1 — Informacoes basicas */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#2d2d3a] mb-1">Nome do restaurante</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pizzaria Bella Napoli" autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2d2d3a] mb-1">WhatsApp do restaurante</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+5511999999999"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2d2d3a] mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@seurestaurante.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <button onClick={() => setStep(2)} disabled={!name.trim() || !phone.trim() || !email.trim()}
              className="w-full bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-40 transition-colors mt-1">
              Proximo
            </button>
          </div>
        )}

        {/* Passo 2 — Escolha do plano */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#2d2d3a] mb-2">Escolha seu plano:</p>

            <button
              onClick={() => setPlan('manual')}
              className={`w-full text-left border rounded-xl p-3 transition-all ${
                plan === 'manual' ? 'border-[#25D366] bg-green-50 ring-2 ring-[#25D366]' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#1a1a2e]">Plano Manual</span>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Basico</span>
              </div>
              <p className="text-[10px] text-gray-500">
                Voce registra visitas e gastos manualmente. O bot responde aos clientes e um responsavel assume a conversa.
              </p>
            </button>

            <button
              onClick={() => setPlan('automatic')}
              className={`w-full text-left border rounded-xl p-3 transition-all ${
                plan === 'automatic' ? 'border-[#25D366] bg-green-50 ring-2 ring-[#25D366]' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#1a1a2e]">Plano Automatico</span>
                <span className="text-[10px] bg-[#25D366] text-white px-2 py-0.5 rounded-full">Premium</span>
              </div>
              <p className="text-[10px] text-gray-500">
                A AI gerencia reservas, calendario e mesas automaticamente. Inclui tudo do Plano Manual + gestao completa.
              </p>
            </button>

            <div className="flex gap-3 mt-1">
              <button onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-2 rounded-lg font-semibold text-xs hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={() => setStep(3)} disabled={!plan}
                className="flex-1 bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-40 transition-colors">
                Proximo
              </button>
            </div>
          </div>
        )}

        {/* Passo 3 — Plano B: Mesas + Horarios / Plano A: Confirmacao */}
        {step === 3 && plan === 'automatic' && (
          <div className="space-y-4">
            {/* Tables */}
            <div>
              <label className="block text-xs font-bold text-[#2d2d3a] mb-2">Mesas do restaurante</label>
              <div className="space-y-2">
                {tableRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500">Lugares</label>
                      <input type="number" min="1" value={row.seats} onChange={e => updateTableRow(i, 'seats', parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500">Quantidade</label>
                      <input type="number" min="1" value={row.qty} onChange={e => updateTableRow(i, 'qty', parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </div>
                    {tableRows.length > 1 && (
                      <button onClick={() => removeTableRow(i)} className="mt-3 text-red-400 hover:text-red-600 text-xs">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addTableRow} className="mt-2 text-[10px] text-[#25D366] font-semibold hover:underline">
                + Adicionar tipo de mesa
              </button>
              <p className="text-[10px] text-gray-400 mt-1">
                Total: {totalTables} mesas, {totalSeats} lugares
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-2 rounded-lg font-semibold text-xs hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={() => setStep(4)}
                className="flex-1 bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] transition-colors">
                Proximo
              </button>
            </div>
          </div>
        )}

        {/* Passo 4 (Plano B) — Horarios */}
        {step === 4 && plan === 'automatic' && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[#2d2d3a] mb-1">Horarios de funcionamento</label>
            <div className="space-y-1.5">
              {hours.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-14">{h.day}</span>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!h.closed} onChange={e => updateHour(i, 'closed', !e.target.checked)}
                      className="w-3 h-3 accent-[#25D366]" />
                  </label>
                  {!h.closed ? (
                    <>
                      <input type="time" value={h.open} onChange={e => updateHour(i, 'open', e.target.value)}
                        className="border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                      <span className="text-[10px] text-gray-400">-</span>
                      <input type="time" value={h.close} onChange={e => updateHour(i, 'close', e.target.value)}
                        className="border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-400">Fechado</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(3)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-2 rounded-lg font-semibold text-xs hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
                {submitting ? 'Ativando...' : 'Ativar restaurante'}
              </button>
            </div>
          </div>
        )}

        {/* Passo 3 (Plano A) — Confirmacao */}
        {step === 3 && plan === 'manual' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-[#1a1a2e] mb-1">O que vai acontecer:</h3>
              <ul className="text-[10px] text-[#6b7280] space-y-1">
                <li>1. Seu painel sera ativado imediatamente</li>
                <li>2. Voce conecta seu WhatsApp Business</li>
                <li>3. O bot acolhe os clientes e passa pro responsavel</li>
                <li>4. Voce registra visitas e gastos manualmente</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-2 rounded-lg font-semibold text-xs hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
                {submitting ? 'Ativando...' : 'Ativar restaurante'}
              </button>
            </div>
          </div>
        )}

        <button onClick={() => navigate('/')}
          className="block mx-auto mt-4 text-[10px] text-[#6b7280] hover:text-[#2d2d3a]">
          Voltar para o inicio
        </button>
      </div>
    </div>
  )
}
