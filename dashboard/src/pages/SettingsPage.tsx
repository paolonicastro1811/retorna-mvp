import { useEffect, useState } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { api } from '../api/client'
import { TableMapEditor } from '../components/TableMapEditor'

interface Restaurant {
  id: string
  name: string
  phone: string | null
  plan: string
  timezone: string
  attributionWindowDays: number
  avgMealDurationMinutes: number
}

interface Hour { id: string; dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }
interface MessageTemplate {
  id: string
  name: string
  body: string
  channel: string
  isActive: boolean
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']

// Template display order (chronological: first received → last) and short descriptions
const TEMPLATE_ORDER: Record<string, { order: number; desc: string }> = {
  'Pos-visita + Consentimento': { order: 1, desc: '24h apos visita, pede opt-in' },
  'Metade do caminho': { order: 2, desc: 'Ao completar 5 visitas' },
  'Recompensa 10 visitas': { order: 3, desc: '10% desconto ao completar 10 visitas' },
  'Desconto surpresa': { order: 4, desc: 'Desconto aleatorio para fieis' },
  'Cliente VIP — 20% desconto': { order: 5, desc: 'A cada 20 visitas: 20% desconto' },
  'Reativacao': { order: 6, desc: 'Clientes inativos ha 30+ dias' },
}

const PLANS = [
  {
    key: 'manual',
    name: 'Plano A — Manual',
    price: 'R$ 197',
    period: '/mes',
    desc: 'Gestao completa dos clientes com controle humano das conversas',
    features: [
      'Painel de clientes com lifecycle (ativo/em risco/inativo)',
      'Registro manual de visitas com valor gasto',
      'Mensagens automaticas: boas-vindas, pos-visita, reativacao',
      'Programa de fidelidade automatico por visitas',
      'Conformidade LGPD (exclusao de dados, opt-in)',
      'Templates de mensagens WhatsApp personalizaveis',
    ],
    notIncluded: [
      'AI conversacional 24/7 via WhatsApp',
      'Reservas automaticas por AI',
      'Mapa de mesas interativo com disponibilidade',
      'Horarios de funcionamento configuraveis',
    ],
  },
  {
    key: 'automatic',
    name: 'Plano B — Automatico',
    price: 'R$ 397',
    period: '/mes',
    popular: true,
    desc: 'Tudo automatizado: AI responde, reserva mesas e reativa clientes',
    features: [
      'Tudo do Plano Manual incluso',
      'AI conversacional 24/7 (classifica intencoes automaticamente)',
      'Reservas via WhatsApp com confirmacao automatica',
      'Mapa de mesas interativo (cores em tempo real)',
      'Editor de layout com AI (descreva seu restaurante)',
      'Horarios de funcionamento configuraveis por dia',
      'Duracao da refeicao configuravel (auto-liberacao de mesas)',
      'Disponibilidade em tempo real por mesa e horario',
      'Prenotacao inline: clique no tavolo → escolha horario',
      'Sincronizacao automatica AI bot ↔ mapa (15s)',
    ],
    notIncluded: [],
  },
]

export function SettingsPage() {
  const restaurantId = useRestaurantId()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('')

  // Hours (Plan B)
  const [_hours, setHours] = useState<Hour[]>([])
  const [editHours, setEditHours] = useState<{ dayOfWeek: number; open: string; close: string; closed: boolean }[]>([])
  const [savingHours, setSavingHours] = useState(false)
  const [savedHours, setSavedHours] = useState(false)
  const [mealDuration, setMealDuration] = useState(90)

  // Templates / Automations
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [togglingTpl, setTogglingTpl] = useState<string | null>(null)


  // Plan change
  const [changingPlan, setChangingPlan] = useState(false)

  useEffect(() => {
    Promise.all([
      api<Restaurant>(`/restaurants/${restaurantId}`),
      api<Hour[]>(`/restaurants/${restaurantId}/hours`),
      api<MessageTemplate[]>(`/restaurants/${restaurantId}/templates`),
    ]).then(([r, h, tpls]) => {
      setRestaurant(r)
      setName(r.name)
      setPhone(r.phone ?? '')
      setTimezone(r.timezone)
      setMealDuration(r.avgMealDurationMinutes ?? 90)
      setHours(h)
      setTemplates(tpls)
      const hourMap = new Map(h.map(hr => [hr.dayOfWeek, hr]))
      setEditHours(Array.from({ length: 7 }, (_, i) => {
        const hr = hourMap.get(i)
        return {
          dayOfWeek: i,
          open: hr?.openTime ?? '11:30',
          close: hr?.closeTime ?? '23:00',
          closed: hr?.isClosed ?? (i === 1),
        }
      }))
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await api(`/restaurants/${restaurantId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, timezone: timezone.trim() }),
      })
      setSaved(true)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleSaveHours = async () => {
    setSavingHours(true)
    setSavedHours(false)
    try {
      // Save hours + meal duration in parallel
      const [result] = await Promise.all([
        api<Hour[]>(`/restaurants/${restaurantId}/hours`, {
          method: 'POST',
          body: JSON.stringify({
            hours: editHours.map(h => ({
              dayOfWeek: h.dayOfWeek,
              openTime: h.open,
              closeTime: h.close,
              isClosed: h.closed,
            })),
          }),
        }),
        api(`/restaurants/${restaurantId}`, {
          method: 'PUT',
          body: JSON.stringify({ avgMealDurationMinutes: mealDuration }),
        }),
      ])
      setHours(result)
      setSavedHours(true)
    } catch (e) { console.error(e) }
    finally { setSavingHours(false) }
  }

  const handleChangePlan = async (newPlan: string) => {
    if (restaurant?.plan === newPlan) return
    setChangingPlan(true)
    try {
      const updated = await api<Restaurant>(`/restaurants/${restaurantId}`, {
        method: 'PUT',
        body: JSON.stringify({ plan: newPlan }),
      })
      setRestaurant(updated)
      localStorage.setItem('restaurantPlan', newPlan)
      window.location.reload()
    } catch (e) { console.error(e) }
    finally { setChangingPlan(false) }
  }

  const handleToggleTemplate = async (tplId: string, currentActive: boolean) => {
    setTogglingTpl(tplId)
    try {
      await api(`/restaurants/${restaurantId}/templates/${tplId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentActive }),
      })
      setTemplates(templates.map(t => t.id === tplId ? { ...t, isActive: !currentActive } : t))
    } catch (e) { console.error(e) }
    finally { setTogglingTpl(null) }
  }

  const isPlanB = restaurant?.plan === 'automatic'

  if (loading) return <div className="text-center py-20 text-gray-400 text-base">Carregando...</div>
  if (!restaurant) return <div className="text-center py-20 text-red-500 text-base">Erro</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Configuracoes</h1>

      {/* ── SECTION 1: Dados do Restaurante ── */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-sm font-bold">1</span>
          Dados do Restaurante
        </h2>
        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nome do restaurante</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Telefone WhatsApp</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+5511999999999"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Fuso horario</label>
            <input type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent" />
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="w-full bg-[#25D366] text-white py-1.5 rounded-lg font-semibold text-sm hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          {saved && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-2 text-sm">Salvo!</div>}
        </div>
      </section>

      {/* ── SECTION 2: Mensagens Automaticas ── */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-sm font-bold">2</span>
          Mensagens Automaticas
        </h2>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-3">Ative ou desative as mensagens que o sistema envia automaticamente via WhatsApp.</p>
          <div className="space-y-2">
            {[...templates].sort((a, b) => (TEMPLATE_ORDER[a.name]?.order ?? 99) - (TEMPLATE_ORDER[b.name]?.order ?? 99)).map(tpl => {
              const meta = TEMPLATE_ORDER[tpl.name]
              return (
              <div key={tpl.id} className={`border rounded-lg p-2 transition-all ${tpl.isActive ? 'border-[#25D366] bg-white' : 'border-gray-200 bg-gray-100/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold ${tpl.isActive ? 'text-gray-900' : 'text-gray-400'}`}>{tpl.name}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium ${tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {tpl.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    {meta && <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>}
                  </div>
                  <button
                    onClick={() => handleToggleTemplate(tpl.id, tpl.isActive)}
                    disabled={togglingTpl === tpl.id}
                    className={`relative w-10 h-5 rounded-full transition-colors ${tpl.isActive ? 'bg-[#25D366]' : 'bg-gray-300'} ${togglingTpl === tpl.id ? 'opacity-50' : ''}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tpl.isActive ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                {tpl.isActive && (
                  <div className="mt-1.5 bg-[#DCF8C6] rounded-lg rounded-tl-none p-2 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap max-w-[85%]">
                    {tpl.body
                      .replace(/\{\{(?:nome?|customer_name|1)\}\}/gi, 'Maria')
                      .replace(/\{\{(?:visitas?|visit_count|2)\}\}/gi, '5')
                      .replace(/\{\{(?:desconto|discount|3)\}\}/gi, '10')
                      .replace(/\{\{progresso_tier\}\}/gi, 'Faltam 5 visitas para Prata 🥈')
                      .replace(/\{\{tier_emoji\}\}/gi, '🥈')
                      .replace(/\{\{tier_nome\}\}/gi, 'Prata')
                      .replace(/\{\{beneficios\}\}/gi, '10% de desconto + prioridade nas reservas')
                      .replace(/\{\{streak\}\}/gi, '2')
                      .replace(/\{\{faltam\}\}/gi, '1')
                      .replace(/\{\{prazo\}\}/gi, 'domingo')
                      .replace(/\{\{restaurant_name\}\}/gi, 'Pizzaria Bella Napoli')}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: Hours (Plan B only) ── */}
      {isPlanB && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-sm font-bold">3</span>
            Horarios
          </h2>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="space-y-1.5">
              {editHours.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 w-14">{DAY_NAMES[h.dayOfWeek]}</span>
                  <label className="flex items-center">
                    <input type="checkbox" checked={!h.closed}
                      onChange={e => setEditHours(editHours.map((hr, idx) => idx === i ? { ...hr, closed: !e.target.checked } : hr))}
                      className="w-3 h-3 accent-[#25D366]" />
                  </label>
                  {!h.closed ? (
                    <>
                      <input type="time" value={h.open}
                        onChange={e => setEditHours(editHours.map((hr, idx) => idx === i ? { ...hr, open: e.target.value } : hr))}
                        className="border border-gray-200 rounded px-1.5 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                      <span className="text-sm text-gray-400">-</span>
                      <input type="time" value={h.close}
                        onChange={e => setEditHours(editHours.map((hr, idx) => idx === i ? { ...hr, close: e.target.value } : hr))}
                        className="border border-gray-200 rounded px-1.5 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Fechado</span>
                  )}
                </div>
              ))}
            </div>
            {/* Meal duration — auto-complete reservations */}
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-3">
              <span className="text-sm text-gray-600 whitespace-nowrap">Duracao media da refeicao:</span>
              <div className="flex items-center gap-1">
                <input type="number" min={30} max={240} step={15} value={mealDuration}
                  onChange={e => setMealDuration(Math.max(30, Math.min(240, parseInt(e.target.value) || 90)))}
                  className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                <span className="text-sm text-gray-400">min</span>
              </div>
              <span className="text-sm text-gray-400">(Mesas ficam livres automaticamente apos esse tempo)</span>
            </div>

            <button onClick={handleSaveHours} disabled={savingHours}
              className="w-full mt-3 bg-[#25D366] text-white py-2 rounded-lg font-semibold text-base hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
              {savingHours ? 'Salvando...' : 'Salvar horarios'}
            </button>
            {savedHours && <div className="mt-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-2 text-sm">Horarios salvos!</div>}
          </div>
        </section>
      )}

      {/* ── SECTION 4: Table Layout (Plan B only) ── */}
      {isPlanB && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-sm font-bold">4</span>
            Mesas e Layout
          </h2>
          <TableMapEditor />
        </section>
      )}

      {/* ── SECTION 5: Plano e Precos ── */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-sm font-bold">5</span>
          Seu Plano
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map(plan => {
            const isCurrentPlan = restaurant.plan === plan.key
            return (
              <div key={plan.key} className={`relative border rounded-xl p-4 transition-all ${
                isCurrentPlan
                  ? 'border-[#25D366] bg-green-50/50 ring-2 ring-[#25D366]/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                    MAIS POPULAR
                  </span>
                )}
                {isCurrentPlan && (
                  <span className="absolute top-3 right-3 bg-[#25D366] text-white text-sm font-bold px-2 py-0.5 rounded-full">
                    ATUAL
                  </span>
                )}
                <h3 className="text-base font-bold text-gray-900 mt-1">{plan.name}</h3>
                <div className="mt-2 mb-2">
                  <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-500 mb-3">{plan.desc}</p>

                <ul className="space-y-1.5 mb-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                      <span className="text-[#25D366] mt-0.5 shrink-0">&#10003;</span>
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded.map((f, i) => (
                    <li key={`no-${i}`} className="flex items-start gap-1.5 text-sm text-gray-400">
                      <span className="mt-0.5 shrink-0">&#10007;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className="text-center text-sm text-[#25D366] font-semibold py-1.5">
                    Plano ativo
                  </div>
                ) : (
                  <button
                    onClick={() => handleChangePlan(plan.key)}
                    disabled={changingPlan}
                    className={`w-full py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      plan.key === 'automatic'
                        ? 'bg-[#25D366] text-white hover:bg-[#1DA851] disabled:opacity-50'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                    }`}>
                    {changingPlan ? 'Alterando...' : plan.key === 'automatic' ? 'Fazer upgrade' : 'Mudar para Manual'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Info */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-400">Restaurant ID: {restaurant.id}</p>
      </div>
    </div>
  )
}
