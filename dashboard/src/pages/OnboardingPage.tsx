import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

interface TableRow { seats: number; qty: number }

const DEFAULT_HOURS = [
  { day: 'Domingo', dayOfWeek: 0, open: '11:30', close: '23:00', closed: false },
  { day: 'Segunda', dayOfWeek: 1, open: '11:30', close: '23:00', closed: true },
  { day: 'Terça', dayOfWeek: 2, open: '11:30', close: '23:00', closed: false },
  { day: 'Quarta', dayOfWeek: 3, open: '11:30', close: '23:00', closed: false },
  { day: 'Quinta', dayOfWeek: 4, open: '11:30', close: '23:00', closed: false },
  { day: 'Sexta', dayOfWeek: 5, open: '11:30', close: '23:00', closed: false },
  { day: 'Sábado', dayOfWeek: 6, open: '11:30', close: '23:00', closed: false },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<'manual' | 'automatic' | ''>('')
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
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
      setError('Erro ao ativar restaurante. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-3">Pronto!</h1>
          <p className="text-[#6b7280] text-base mb-8">
            Seu restaurante <strong>{name}</strong> foi cadastrado com o plano <strong>{plan === 'manual' ? 'Manual' : 'Automático'}</strong>.
          </p>
          <button
            onClick={() => navigate('/painel')}
            className="w-full bg-[#25D366] text-white py-3 rounded-lg font-bold text-base hover:bg-[#1DA851] transition-colors"
          >
            Entrar no painel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
      <div className={`w-full ${step === 2 ? 'max-w-4xl' : 'max-w-xl'} transition-all`}>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-[#1a1a2e]">Ative seu restaurante</h1>
          <p className="text-[#6b7280] text-sm mt-2">Leva menos de 1 minuto</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${step >= i + 1 ? 'bg-[#25D366]' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Passo 1 — Informacoes basicas */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#2d2d3a] mb-1.5">Nome do restaurante</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pizzaria Bella Napoli" autoFocus
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2d2d3a] mb-1.5">WhatsApp do restaurante</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+5511999999999"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2d2d3a] mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@seurestaurante.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <button onClick={() => setStep(2)} disabled={!name.trim() || !phone.trim() || !email.trim()}
              className="w-full bg-[#25D366] text-white py-3 rounded-lg font-semibold text-base hover:bg-[#1DA851] disabled:opacity-40 transition-colors mt-2">
              Próximo
            </button>
          </div>
        )}

        {/* Passo 2 — Escolha do plano */}
        {step === 2 && (
          <div className="space-y-6">
            <p className="text-lg font-bold text-[#2d2d3a] text-center">Escolha seu plano</p>

            {/* Toggle mensile/annuale */}
            <div className="flex items-center justify-center gap-3">
              <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>Mensal</span>
              <button
                onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
                className={`relative w-14 h-7 rounded-full transition-colors ${billing === 'annual' ? 'bg-[#25D366]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${billing === 'annual' ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm font-medium ${billing === 'annual' ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>Anual</span>
              {billing === 'annual' && (
                <span className="text-xs bg-[#25D366] text-white px-2 py-0.5 rounded-full font-bold">-20%</span>
              )}
            </div>

            {/* Cards affiancate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Plano Manual */}
              <button
                onClick={() => setPlan('manual')}
                className={`w-full text-left border rounded-2xl p-6 transition-all flex flex-col ${
                  plan === 'manual' ? 'border-[#25D366] bg-green-50 ring-2 ring-[#25D366]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-[#1a1a2e]">Plano Manual</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-semibold">Básico</span>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#1a1a2e]">
                      R$ {billing === 'monthly' ? '197' : '158'}
                    </span>
                    <span className="text-sm text-gray-500">/mês</span>
                  </div>
                  {billing === 'annual' && (
                    <p className="text-xs text-gray-400 mt-1">R$ 1.896/ano (equivale a 10 meses)</p>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
                  <p className="text-sm text-blue-700 font-semibold">30 dias grátis para testar</p>
                </div>

                <p className="text-sm font-semibold text-[#1a1a2e] mb-3">O que está incluso:</p>
                <ul className="space-y-2 flex-1">
                  {[
                    'Campanhas de reativação via WhatsApp',
                    'Registro manual de visitas e gastos',
                    'Painel com KPIs e ROI por campanha',
                    'Bot de atendimento inicial no WhatsApp',
                    'Transferência para responsável humano',
                    'Relatórios de clientes ativos, em risco e inativos',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-[#25D366] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </button>

              {/* Card Plano Automático */}
              <button
                onClick={() => setPlan('automatic')}
                className={`w-full text-left border rounded-2xl p-6 transition-all relative flex flex-col ${
                  plan === 'automatic' ? 'border-[#25D366] bg-green-50 ring-2 ring-[#25D366]' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#25D366] text-white text-xs font-bold px-4 py-1 rounded-full">Mais popular</span>
                </div>

                <div className="flex items-center justify-between mb-4 mt-1">
                  <span className="text-lg font-bold text-[#1a1a2e]">Plano Automático</span>
                  <span className="text-xs bg-[#25D366] text-white px-3 py-1 rounded-full font-semibold">Premium</span>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#1a1a2e]">
                      R$ {billing === 'monthly' ? '397' : '317'}
                    </span>
                    <span className="text-sm text-gray-500">/mês</span>
                  </div>
                  {billing === 'annual' && (
                    <p className="text-xs text-gray-400 mt-1">R$ 3.804/ano (equivale a 10 meses)</p>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
                  <p className="text-sm text-blue-700 font-semibold">15 dias grátis para testar</p>
                </div>

                <p className="text-sm font-semibold text-[#1a1a2e] mb-3">Tudo do Manual, mais:</p>
                <ul className="space-y-2 flex-1">
                  {[
                    'Gestão automática de reservas via WhatsApp',
                    'Calendário inteligente com controle de mesas',
                    'AI gerencia conversas completas sem intervenção',
                    'Confirmação e lembrete automático de reservas',
                    'Controle de capacidade em tempo real',
                    'Relatórios avançados de ocupação e demanda',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-[#25D366] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </button>
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-3 rounded-lg font-semibold text-sm hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={() => setStep(3)} disabled={!plan}
                className="flex-1 bg-[#25D366] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#1DA851] disabled:opacity-40 transition-colors">
                Próximo
              </button>
            </div>
          </div>
        )}

        {/* Passo 3 — Plano B: Mesas + Horarios / Plano A: Confirmacao */}
        {step === 3 && plan === 'automatic' && (
          <div className="space-y-5">
            {/* Tables */}
            <div>
              <label className="block text-sm font-bold text-[#2d2d3a] mb-3">Mesas do restaurante</label>
              <div className="space-y-3">
                {tableRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Assentos por mesa</label>
                      <input type="number" min="1" value={row.seats} onChange={e => updateTableRow(i, 'seats', parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Nº de mesas</label>
                      <input type="number" min="1" value={row.qty} onChange={e => updateTableRow(i, 'qty', parseInt(e.target.value) || 1)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </div>
                    {tableRows.length > 1 && (
                      <button onClick={() => removeTableRow(i)} className="mt-4 text-red-400 hover:text-red-600 text-sm">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addTableRow} className="mt-3 text-sm text-[#25D366] font-semibold hover:underline">
                + Adicionar tipo de mesa
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Total: {totalTables} mesas, {totalSeats} assentos
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-3 rounded-lg font-semibold text-sm hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={() => setStep(4)}
                className="flex-1 bg-[#25D366] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#1DA851] transition-colors">
                Próximo
              </button>
            </div>
          </div>
        )}

        {/* Passo 4 (Plano B) — Horarios */}
        {step === 4 && plan === 'automatic' && (
          <div className="space-y-4">
            <label className="block text-sm font-bold text-[#2d2d3a] mb-2">Horários de funcionamento</label>
            <div className="space-y-2.5">
              {hours.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20">{h.day}</span>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!h.closed} onChange={e => updateHour(i, 'closed', !e.target.checked)}
                      className="w-4 h-4 accent-[#25D366]" />
                  </label>
                  {!h.closed ? (
                    <>
                      <input type="time" value={h.open} onChange={e => updateHour(i, 'open', e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                      <span className="text-sm text-gray-400">-</span>
                      <input type="time" value={h.close} onChange={e => updateHour(i, 'close', e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Fechado</span>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-3">
              <button onClick={() => setStep(3)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-3 rounded-lg font-semibold text-sm hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-[#25D366] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
                {submitting ? 'Ativando...' : 'Ativar restaurante'}
              </button>
            </div>
          </div>
        )}

        {/* Passo 3 (Plano A) — Confirmacao */}
        {step === 3 && plan === 'manual' && (
          <div className="space-y-5">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h3 className="text-base font-bold text-[#1a1a2e] mb-3">O que vai acontecer:</h3>
              <ul className="text-sm text-[#6b7280] space-y-2">
                <li>1. Seu painel será ativado imediatamente</li>
                <li>2. Você conecta seu WhatsApp Business</li>
                <li>3. O bot acolhe os clientes e passa pro responsável</li>
                <li>4. Você registra visitas e gastos manualmente</li>
              </ul>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-[#2d2d3a] py-3 rounded-lg font-semibold text-sm hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-[#25D366] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
                {submitting ? 'Ativando...' : 'Ativar restaurante'}
              </button>
            </div>
          </div>
        )}

        <button onClick={() => navigate('/')}
          className="block mx-auto mt-6 text-sm text-[#6b7280] hover:text-[#2d2d3a]">
          Voltar para o início
        </button>
      </div>
    </div>
  )
}
