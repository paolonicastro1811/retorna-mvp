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
  isCustom: boolean
  metaStatus: string
  metaRejectedReason?: string
  aiReviewNotes?: string
  hsmTemplateName?: string
  createdAt: string
}

interface AiReview {
  approved: boolean
  score: number
  issues: string[]
  suggestions: string[]
}

interface CampaignLimits {
  allowed: boolean
  reason?: string
  details?: {
    customCampaignsThisMonth?: number
    maxCustomCampaigns?: number
  }
}

const CUSTOM_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  ai_review: { label: 'Revisão AI', color: 'bg-blue-100 text-blue-700' },
  ai_rejected: { label: 'Rejeitado (AI)', color: 'bg-red-100 text-red-700' },
  submitted: { label: 'Em revisão Meta', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejeitado (Meta)', color: 'bg-red-100 text-red-700' },
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Template display order (chronological: first received → last) and short descriptions
const TEMPLATE_ORDER: Record<string, { order: number; desc: string; previewVisits: string }> = {
  'Pós-visita + Consentimento': { order: 1, desc: '24h após visita, pede opt-in', previewVisits: '1' },
  'Metade do caminho': { order: 2, desc: 'Ao completar 5 visitas', previewVisits: '5' },
  'Recompensa 10 visitas': { order: 3, desc: '10% desconto ao completar 10 visitas', previewVisits: '10' },
  'Desconto surpresa': { order: 4, desc: 'Desconto aleatório para fiéis', previewVisits: '8' },
  'Cliente VIP — 20% desconto': { order: 5, desc: 'A cada 20 visitas (20, 40, 60…): 20% desconto', previewVisits: '20' },
  'Reativação': { order: 6, desc: 'Com opt-in, sem visita há 30+ dias', previewVisits: '12' },
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

  // Custom templates
  const [customLimits, setCustomLimits] = useState<CampaignLimits | null>(null)
  const [customName, setCustomName] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [aiReview, setAiReview] = useState<AiReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [submittingMeta, setSubmittingMeta] = useState<string | null>(null)
  const [customError, setCustomError] = useState('')
  const [customSuccess, setCustomSuccess] = useState('')

  // Plan change
  const [changingPlan, setChangingPlan] = useState(false)

  useEffect(() => {
    Promise.all([
      api<Restaurant>(`/restaurants/${restaurantId}`),
      api<Hour[]>(`/restaurants/${restaurantId}/hours`),
      api<MessageTemplate[]>(`/restaurants/${restaurantId}/templates`),
      api<CampaignLimits>(`/restaurants/${restaurantId}/campaign-limits`).catch(() => null),
    ]).then(([r, h, tpls, lim]) => {
      setRestaurant(r)
      setName(r.name)
      setPhone(r.phone ?? '')
      setTimezone(r.timezone)
      setMealDuration(r.avgMealDurationMinutes ?? 90)
      setHours(h)
      setTemplates(tpls)
      if (lim) setCustomLimits(lim)
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

  // Custom template handlers
  const reloadTemplates = async () => {
    try {
      const tpls = await api<MessageTemplate[]>(`/restaurants/${restaurantId}/templates`)
      setTemplates(tpls)
    } catch { /* ignore */ }
  }

  const handleAiReview = async () => {
    if (!customBody.trim()) return
    setReviewing(true)
    setAiReview(null)
    setCustomError('')
    try {
      const review = await api<AiReview>(`/restaurants/${restaurantId}/templates/ai-review`, {
        method: 'POST',
        body: JSON.stringify({ body: customBody }),
      })
      setAiReview(review)
    } catch (err: any) {
      setCustomError(err.message)
    } finally {
      setReviewing(false)
    }
  }

  const handleCreateCustom = async () => {
    if (!customName.trim() || !customBody.trim()) return
    setSavingCustom(true)
    setCustomError('')
    setCustomSuccess('')
    try {
      await api(`/restaurants/${restaurantId}/templates/custom`, {
        method: 'POST',
        body: JSON.stringify({ name: customName, body: customBody }),
      })
      setCustomSuccess('Template criado! Agora envie para Meta para aprovação.')
      setCustomName('')
      setCustomBody('')
      setAiReview(null)
      reloadTemplates()
    } catch (err: any) {
      setCustomError(err.message || 'Erro ao criar template')
    } finally {
      setSavingCustom(false)
    }
  }

  const handleSubmitToMeta = async (templateId: string) => {
    setSubmittingMeta(templateId)
    setCustomError('')
    try {
      await api(`/restaurants/${restaurantId}/templates/${templateId}/submit-to-meta`, {
        method: 'POST',
      })
      setCustomSuccess('Template enviado para revisão da Meta!')
      reloadTemplates()
    } catch (err: any) {
      setCustomError(err.message)
    } finally {
      setSubmittingMeta(null)
    }
  }

  const handleDeleteCustom = async (templateId: string) => {
    if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return
    try {
      await api(`/restaurants/${restaurantId}/templates/${templateId}`, {
        method: 'DELETE',
      })
      reloadTemplates()
    } catch (err: any) {
      setCustomError(err.message)
    }
  }

  const systemTemplates = templates.filter(t => !t.isCustom)
  const customTemplates = templates.filter(t => t.isCustom)
  const customPreview = customBody.replace(/\{\{customer_name\}\}/g, 'Maria')

  const isPlanB = restaurant?.plan === 'automatic'
  const [activeTab, setActiveTab] = useState(1)

  const TABS = [
    { id: 1, label: 'Dados' },
    { id: 2, label: 'Mensagens' },
    { id: 3, label: 'Horários', planB: true },
    { id: 4, label: 'Mesas', planB: true },
    { id: 5, label: 'Plano' },
  ]

  if (loading) return <div className="text-center py-20 text-gray-400 text-base">Carregando...</div>
  if (!restaurant) return <div className="text-center py-20 text-red-500 text-base">Erro</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Configurações</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => {
          const disabled = tab.planB && !isPlanB
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#25D366] text-[#25D366]'
                  : disabled
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold mr-1.5 ${
                activeTab === tab.id ? 'bg-[#25D366] text-white' : disabled ? 'bg-gray-200 text-gray-400' : 'bg-gray-200 text-gray-600'
              }`}>{tab.id}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB 1: Dados do Restaurante ── */}
      {activeTab === 1 && (
      <section>
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
      )}

      {/* ── TAB 2: Mensagens Automáticas ── */}
      {activeTab === 2 && (
      <section>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-3">Ative ou desative as mensagens que o sistema envia automaticamente via WhatsApp.</p>
          <div className="space-y-2">
            {[...systemTemplates].sort((a, b) => (TEMPLATE_ORDER[a.name]?.order ?? 99) - (TEMPLATE_ORDER[b.name]?.order ?? 99)).map(tpl => {
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
                      .replace(/\{\{(?:visitas?|visit_count|2)\}\}/gi, meta?.previewVisits ?? '5')
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

          {/* ── Custom Templates ── */}
          <div className="mt-5 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-2">Templates Personalizados</h3>
            <p className="text-xs text-gray-400 mb-3">Crie mensagens personalizadas para campanhas. Cada template passa por revisão de AI e aprovação da Meta.</p>

            {/* Campaign limits */}
            {customLimits && (
              <div className={`rounded-lg p-2 text-xs mb-3 ${customLimits.allowed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {customLimits.allowed ? (
                  <p>Campanhas custom este mês: <strong>{customLimits.details?.customCampaignsThisMonth || 0}/{customLimits.details?.maxCustomCampaigns || 2}</strong></p>
                ) : (
                  <p>{customLimits.reason}</p>
                )}
              </div>
            )}

            {/* Error/Success */}
            {customError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs mb-3">
                {customError}
                <button onClick={() => setCustomError('')} className="float-right font-bold">x</button>
              </div>
            )}
            {customSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs mb-3">
                {customSuccess}
                <button onClick={() => setCustomSuccess('')} className="float-right font-bold">x</button>
              </div>
            )}

            {/* Create form */}
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Nome do template (ex: Promoção de verão)"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
              />
              <textarea
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                placeholder="Oi {{customer_name}}! Temos uma novidade especial para você..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{customBody.length}/1024 caracteres</span>
                <span className="text-gray-400">Use {'{{customer_name}}'} para personalizar</span>
              </div>

              {/* Preview */}
              {customBody && (
                <div className="bg-[#e5ddd5] rounded-lg p-2">
                  <p className="text-xs text-gray-500 mb-1">Anteprima WhatsApp:</p>
                  <div className="bg-white rounded-lg px-2 py-1.5 text-xs max-w-[85%] shadow-sm whitespace-pre-wrap">
                    {customPreview}
                  </div>
                </div>
              )}

              {/* AI Review result */}
              {aiReview && (
                <div className={`rounded-lg p-3 text-xs ${aiReview.approved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{aiReview.approved ? 'Aprovado pela AI' : 'Reprovado pela AI'}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${aiReview.score >= 70 ? 'bg-green-200 text-green-800' : aiReview.score >= 40 ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                      Score: {aiReview.score}/100
                    </span>
                  </div>
                  {aiReview.issues.length > 0 && (
                    <div className="mb-1">
                      <p className="font-semibold text-red-700 mb-0.5">Problemas:</p>
                      <ul className="list-disc list-inside text-red-600 space-y-0.5">
                        {aiReview.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}
                  {aiReview.suggestions.length > 0 && (
                    <div>
                      <p className="font-semibold text-blue-700 mb-0.5">Sugestões:</p>
                      <ul className="list-disc list-inside text-blue-600 space-y-0.5">
                        {aiReview.suggestions.map((sug, i) => <li key={i}>{sug}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleAiReview}
                  disabled={!customBody.trim() || reviewing}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reviewing ? 'Analisando...' : 'Revisar com AI'}
                </button>
                <button
                  onClick={handleCreateCustom}
                  disabled={!customName.trim() || !customBody.trim() || savingCustom || (aiReview !== null && !aiReview.approved)}
                  className="px-3 py-1.5 text-xs bg-[#25D366] text-white rounded-lg hover:bg-[#1DA851] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingCustom ? 'Salvando...' : 'Criar Template'}
                </button>
              </div>
            </div>

            {/* Existing custom templates */}
            {customTemplates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Seus templates ({customTemplates.length}/3)</p>
                {customTemplates.map(t => {
                  const statusBadge = CUSTOM_STATUS_BADGES[t.metaStatus] || CUSTOM_STATUS_BADGES.draft
                  return (
                    <div key={t.id} className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteCustom(t.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Excluir
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded p-2 text-xs text-gray-700 whitespace-pre-wrap">
                        {t.body}
                      </div>
                      {t.metaRejectedReason && (
                        <div className="bg-red-50 rounded p-2 text-xs text-red-700">
                          <strong>Motivo da rejeição:</strong> {t.metaRejectedReason}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {t.metaStatus === 'draft' && (
                          <button
                            onClick={() => handleSubmitToMeta(t.id)}
                            disabled={submittingMeta === t.id}
                            className="px-2 py-1 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                          >
                            {submittingMeta === t.id ? 'Enviando...' : 'Enviar para Meta'}
                          </button>
                        )}
                        {t.metaStatus === 'submitted' && (
                          <span className="text-xs text-yellow-600">Aguardando aprovação da Meta (até 24h)...</span>
                        )}
                        {t.metaStatus === 'approved' && (
                          <span className="text-xs text-green-600">Pronto para usar em campanhas!</span>
                        )}
                        {t.metaStatus === 'rejected' && (
                          <button
                            onClick={() => handleDeleteCustom(t.id)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Excluir e recriar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ── TAB 3: Horários (Plan B only) ── */}
      {activeTab === 3 && isPlanB && (
      <section>
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
              <span className="text-sm text-gray-600 whitespace-nowrap">Duração média da refeição:</span>
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
            {savedHours && <div className="mt-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-2 text-sm">Horários salvos!</div>}
          </div>
      </section>
      )}

      {/* ── TAB 4: Mesas e Layout (Plan B only) ── */}
      {activeTab === 4 && isPlanB && (
      <section>
          <TableMapEditor />
      </section>
      )}

      {/* ── TAB 5: Plano e Preços ── */}
      {activeTab === 5 && (
      <section>
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
      )}

      {/* Info */}
      <div className="border-t border-gray-200 pt-4 mt-6">
        <p className="text-sm text-gray-400">Restaurant ID: {restaurant.id}</p>
      </div>
    </div>
  )
}
