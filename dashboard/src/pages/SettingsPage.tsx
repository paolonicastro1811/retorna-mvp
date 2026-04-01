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
  tierFrequenteMinVisits: number
  tierPrataMinVisits: number
  tierOuroMinVisits: number
  discountFrequente: number
  discountPrata: number
  discountOuro: number
  streakTargetVisits: number
  streakWindowDays: number
  reactivationAfterDays: number
  surpriseEveryMinVisits: number
  surpriseEveryMaxVisits: number
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
      'Programa de fidelidade com 4 niveis (Novo → Ouro)',
      'Mensagens automaticas: boas-vindas, pos-visita, reativacao',
      'Desconto progressivo por nivel de fidelidade',
      'Streak de visitas com recompensas',
      'Surpresas aleatorias para clientes fieis',
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

  // Loyalty config
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    tierFrequenteMinVisits: 3,
    tierPrataMinVisits: 10,
    tierOuroMinVisits: 25,
    discountFrequente: 5,
    discountPrata: 10,
    discountOuro: 15,
    streakTargetVisits: 3,
    streakWindowDays: 7,
    reactivationAfterDays: 30,
    surpriseEveryMinVisits: 3,
    surpriseEveryMaxVisits: 7,
  })
  const [savingLoyalty, setSavingLoyalty] = useState(false)
  const [savedLoyalty, setSavedLoyalty] = useState(false)

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
      setLoyaltyConfig({
        tierFrequenteMinVisits: r.tierFrequenteMinVisits ?? 3,
        tierPrataMinVisits: r.tierPrataMinVisits ?? 10,
        tierOuroMinVisits: r.tierOuroMinVisits ?? 25,
        discountFrequente: r.discountFrequente ?? 5,
        discountPrata: r.discountPrata ?? 10,
        discountOuro: r.discountOuro ?? 15,
        streakTargetVisits: r.streakTargetVisits ?? 3,
        streakWindowDays: r.streakWindowDays ?? 7,
        reactivationAfterDays: r.reactivationAfterDays ?? 30,
        surpriseEveryMinVisits: r.surpriseEveryMinVisits ?? 3,
        surpriseEveryMaxVisits: r.surpriseEveryMaxVisits ?? 7,
      })

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

  const handleSaveLoyalty = async () => {
    setSavingLoyalty(true)
    setSavedLoyalty(false)
    try {
      await api(`/restaurants/${restaurantId}`, {
        method: 'PUT',
        body: JSON.stringify(loyaltyConfig),
      })
      setSavedLoyalty(true)
    } catch (e) { console.error(e) }
    finally { setSavingLoyalty(false) }
  }

  const isPlanB = restaurant?.plan === 'automatic'

  if (loading) return <div className="text-center py-20 text-gray-400 text-xs">Carregando...</div>
  if (!restaurant) return <div className="text-center py-20 text-red-500 text-xs">Erro</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-bold text-gray-900 mb-6">Configuracoes</h1>

      {/* ── SECTION 1: Dados do Restaurante ── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">1</span>
          Dados do Restaurante
        </h2>
        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Nome do restaurante</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Telefone WhatsApp</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+5511999999999"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Fuso horario</label>
            <input type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent" />
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="w-full bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          {saved && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-2 text-[10px]">Salvo!</div>}
        </div>
      </section>

      {/* ── SECTION 2: Programa de Fidelidade ── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">2</span>
          Programa de Fidelidade
        </h2>

        {/* Tier visualization */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Niveis de fidelidade</p>
          <div className="flex items-end gap-1">
            {[
              { tier: 'Novo', emoji: '👤', visits: '0', discount: '0%', color: 'bg-gray-200', active: true },
              { tier: 'Frequente', emoji: '⭐', visits: String(loyaltyConfig.tierFrequenteMinVisits), discount: `${loyaltyConfig.discountFrequente}%`, color: 'bg-yellow-100', active: true },
              { tier: 'Prata', emoji: '🥈', visits: String(loyaltyConfig.tierPrataMinVisits), discount: `${loyaltyConfig.discountPrata}%`, color: 'bg-gray-300', active: true },
              { tier: 'Ouro', emoji: '🥇', visits: String(loyaltyConfig.tierOuroMinVisits), discount: `${loyaltyConfig.discountOuro}%`, color: 'bg-yellow-300', active: true },
            ].map((t, i) => (
              <div key={t.tier} className="flex-1 text-center">
                <div className={`${t.color} rounded-xl p-2 mx-0.5`} style={{ minHeight: `${40 + i * 20}px` }}>
                  <p className="text-lg">{t.emoji}</p>
                  <p className="text-[10px] font-bold text-gray-800">{t.tier}</p>
                  <p className="text-[9px] text-gray-600">{t.visits}+ visitas</p>
                  <p className="text-[9px] font-semibold text-[#25D366]">{t.discount} desc.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Config: tiers */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Configurar niveis</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Frequente ⭐', visitKey: 'tierFrequenteMinVisits' as const, discountKey: 'discountFrequente' as const },
              { label: 'Prata 🥈', visitKey: 'tierPrataMinVisits' as const, discountKey: 'discountPrata' as const },
              { label: 'Ouro 🥇', visitKey: 'tierOuroMinVisits' as const, discountKey: 'discountOuro' as const },
            ].map(t => (
              <div key={t.label} className="bg-white rounded-lg p-2.5 border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-700 mb-2">{t.label}</p>
                <label className="text-[9px] text-gray-500">Visitas minimas</label>
                <input type="number" min="1" value={loyaltyConfig[t.visitKey]}
                  onChange={e => setLoyaltyConfig({ ...loyaltyConfig, [t.visitKey]: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mb-1.5 focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                <label className="text-[9px] text-gray-500">Desconto (%)</label>
                <input type="number" min="0" max="50" value={loyaltyConfig[t.discountKey]}
                  onChange={e => setLoyaltyConfig({ ...loyaltyConfig, [t.discountKey]: Math.max(0, Math.min(50, parseInt(e.target.value) || 0)) })}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
              </div>
            ))}
          </div>

          {/* Extra config */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[9px] text-gray-500">Retorna apos (dias sem visita)</label>
              <input type="number" min="7" value={loyaltyConfig.reactivationAfterDays}
                onChange={e => setLoyaltyConfig({ ...loyaltyConfig, reactivationAfterDays: Math.max(7, parseInt(e.target.value) || 30) })}
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="text-[9px] text-gray-500">Streak: visitas em {loyaltyConfig.streakWindowDays} dias</label>
              <input type="number" min="2" value={loyaltyConfig.streakTargetVisits}
                onChange={e => setLoyaltyConfig({ ...loyaltyConfig, streakTargetVisits: Math.max(2, parseInt(e.target.value) || 3) })}
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
            </div>
          </div>

          <button onClick={handleSaveLoyalty} disabled={savingLoyalty}
            className="w-full mt-3 bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
            {savingLoyalty ? 'Salvando...' : 'Salvar configuracao'}
          </button>
          {savedLoyalty && <div className="mt-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-2 text-[10px]">Configuracao salva!</div>}
        </div>

      </section>

      {/* ── SECTION 3: Mensagens Automaticas ── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">3</span>
          Mensagens Automaticas
        </h2>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-[9px] text-gray-400 mb-3">Ative ou desative as mensagens que o sistema envia automaticamente via WhatsApp.</p>
          <div className="space-y-2">
            {templates.map(tpl => (
              <div key={tpl.id} className={`border rounded-xl p-3 transition-all ${tpl.isActive ? 'border-[#25D366] bg-white' : 'border-gray-200 bg-gray-100/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className={`text-xs font-semibold ${tpl.isActive ? 'text-gray-900' : 'text-gray-400'}`}>{tpl.name}</span>
                    <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {tpl.isActive ? 'Ativo' : 'Inativo'}
                    </span>
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
                  <div className="mt-2 bg-[#DCF8C6] rounded-lg rounded-tl-none p-2 text-[10px] text-gray-800 leading-relaxed whitespace-pre-wrap max-w-[85%]">
                    {tpl.body
                      .replace(/\{\{nome?\}\}/gi, 'Maria')
                      .replace(/\{\{visitas?\}\}/gi, '5')
                      .replace(/\{\{desconto\}\}/gi, '10')
                      .replace(/\{\{progresso_tier\}\}/gi, 'Faltam 5 visitas para Prata 🥈')
                      .replace(/\{\{tier_emoji\}\}/gi, '🥈')
                      .replace(/\{\{tier_nome\}\}/gi, 'Prata')
                      .replace(/\{\{beneficios\}\}/gi, '10% de desconto + prioridade nas reservas')
                      .replace(/\{\{streak\}\}/gi, '2')
                      .replace(/\{\{faltam\}\}/gi, '1')
                      .replace(/\{\{prazo\}\}/gi, 'domingo')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Hours (Plan B only) ── */}
      {isPlanB && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">4</span>
            Horarios
          </h2>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="space-y-1.5">
              {editHours.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-14">{DAY_NAMES[h.dayOfWeek]}</span>
                  <label className="flex items-center">
                    <input type="checkbox" checked={!h.closed}
                      onChange={e => setEditHours(editHours.map((hr, idx) => idx === i ? { ...hr, closed: !e.target.checked } : hr))}
                      className="w-3 h-3 accent-[#25D366]" />
                  </label>
                  {!h.closed ? (
                    <>
                      <input type="time" value={h.open}
                        onChange={e => setEditHours(editHours.map((hr, idx) => idx === i ? { ...hr, open: e.target.value } : hr))}
                        className="border border-gray-200 rounded px-1.5 py-1 text-[10px] bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                      <span className="text-[10px] text-gray-400">-</span>
                      <input type="time" value={h.close}
                        onChange={e => setEditHours(editHours.map((hr, idx) => idx === i ? { ...hr, close: e.target.value } : hr))}
                        className="border border-gray-200 rounded px-1.5 py-1 text-[10px] bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-400">Fechado</span>
                  )}
                </div>
              ))}
            </div>
            {/* Meal duration — auto-complete reservations */}
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-3">
              <span className="text-[10px] text-gray-600 whitespace-nowrap">Duracao media da refeicao:</span>
              <div className="flex items-center gap-1">
                <input type="number" min={30} max={240} step={15} value={mealDuration}
                  onChange={e => setMealDuration(Math.max(30, Math.min(240, parseInt(e.target.value) || 90)))}
                  className="w-16 border border-gray-200 rounded px-2 py-1 text-[10px] text-center bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
                <span className="text-[10px] text-gray-400">min</span>
              </div>
              <span className="text-[9px] text-gray-400">(Mesas ficam livres automaticamente apos esse tempo)</span>
            </div>

            <button onClick={handleSaveHours} disabled={savingHours}
              className="w-full mt-3 bg-[#25D366] text-white py-2 rounded-lg font-semibold text-xs hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
              {savingHours ? 'Salvando...' : 'Salvar horarios'}
            </button>
            {savedHours && <div className="mt-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-2 text-[10px]">Horarios salvos!</div>}
          </div>
        </section>
      )}

      {/* ── SECTION 5: Table Layout (Plan B only) ── */}
      {isPlanB && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">5</span>
            Mesas e Layout
          </h2>
          <TableMapEditor />
        </section>
      )}

      {/* ── SECTION 6: Plano e Precos ── */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white text-[10px] font-bold">6</span>
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
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full">
                    MAIS POPULAR
                  </span>
                )}
                {isCurrentPlan && (
                  <span className="absolute top-3 right-3 bg-[#25D366] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    ATUAL
                  </span>
                )}
                <h3 className="text-xs font-bold text-gray-900 mt-1">{plan.name}</h3>
                <div className="mt-2 mb-2">
                  <span className="text-2xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-[10px] text-gray-500">{plan.period}</span>
                </div>
                <p className="text-[10px] text-gray-500 mb-3">{plan.desc}</p>

                <ul className="space-y-1.5 mb-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-gray-700">
                      <span className="text-[#25D366] mt-0.5 shrink-0">&#10003;</span>
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded.map((f, i) => (
                    <li key={`no-${i}`} className="flex items-start gap-1.5 text-[10px] text-gray-400">
                      <span className="mt-0.5 shrink-0">&#10007;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className="text-center text-[10px] text-[#25D366] font-semibold py-1.5">
                    Plano ativo
                  </div>
                ) : (
                  <button
                    onClick={() => handleChangePlan(plan.key)}
                    disabled={changingPlan}
                    className={`w-full py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
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
        <p className="text-[10px] text-gray-400">Restaurant ID: {restaurant.id}</p>
      </div>
    </div>
  )
}
