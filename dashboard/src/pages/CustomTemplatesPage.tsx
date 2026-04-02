import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useRestaurantId } from '../contexts/AuthContext'

interface Template {
  id: string
  name: string
  body: string
  isCustom: boolean
  isActive: boolean
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

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  ai_review: { label: 'Revisao AI', color: 'bg-blue-100 text-blue-700' },
  ai_rejected: { label: 'Rejeitado (AI)', color: 'bg-red-100 text-red-700' },
  submitted: { label: 'Em revisao Meta', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejeitado (Meta)', color: 'bg-red-100 text-red-700' },
}

export function CustomTemplatesPage() {
  const restaurantId = useRestaurantId()
  const [templates, setTemplates] = useState<Template[]>([])
  const [limits, setLimits] = useState<CampaignLimits | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [aiReview, setAiReview] = useState<AiReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!restaurantId) return
    loadData()
  }, [restaurantId])

  async function loadData() {
    setLoading(true)
    try {
      const [tpls, lim] = await Promise.all([
        api<Template[]>(`/restaurants/${restaurantId}/templates`),
        api<CampaignLimits>(`/restaurants/${restaurantId}/campaign-limits`),
      ])
      setTemplates(tpls.filter(t => t.isCustom))
      setLimits(lim)
    } catch {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function handleAiReview() {
    if (!body.trim()) return
    setReviewing(true)
    setAiReview(null)
    setError('')
    try {
      const review = await api<AiReview>(`/restaurants/${restaurantId}/templates/ai-review`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setAiReview(review)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setReviewing(false)
    }
  }

  async function handleCreate() {
    if (!name.trim() || !body.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api(`/restaurants/${restaurantId}/templates/custom`, {
        method: 'POST',
        body: JSON.stringify({ name, body }),
      })
      setSuccess('Template criado! Agora envie para Meta para aprovacao.')
      setName('')
      setBody('')
      setAiReview(null)
      loadData()
    } catch (err: any) {
      const data = err.message
      setError(data || 'Erro ao criar template')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitToMeta(templateId: string) {
    setSubmitting(templateId)
    setError('')
    try {
      await api(`/restaurants/${restaurantId}/templates/${templateId}/submit-to-meta`, {
        method: 'POST',
      })
      setSuccess('Template enviado para revisao da Meta!')
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(null)
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('Tem certeza? Esta acao nao pode ser desfeita.')) return
    try {
      await api(`/restaurants/${restaurantId}/templates/${templateId}`, {
        method: 'DELETE',
      })
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const preview = body.replace(/\{\{customer_name\}\}/g, 'Maria')

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Carregando...</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Templates Custom</h1>
      <p className="text-sm text-gray-500">
        Crie mensagens personalizadas para suas campanhas. Cada template passa por revisao de AI e aprovacao da Meta.
      </p>

      {/* Campaign limits info */}
      {limits && (
        <div className={`rounded-lg p-4 text-sm ${limits.allowed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {limits.allowed ? (
            <p>Campanhas custom este mes: <strong>{limits.details?.customCampaignsThisMonth || 0}/{limits.details?.maxCustomCampaigns || 2}</strong></p>
          ) : (
            <p>{limits.reason}</p>
          )}
        </div>
      )}

      {/* Error/Success messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">x</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
          <button onClick={() => setSuccess('')} className="float-right font-bold">x</button>
        </div>
      )}

      {/* Create new template */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Novo Template</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do template</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Promocao de verao"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mensagem <span className="text-gray-400">(use {'{{customer_name}}'} para personalizar)</span>
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Oi {{customer_name}}! Temos uma novidade especial para voce..."
            rows={5}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{body.length}/1024 caracteres</span>
            {body.length > 800 && <span className="text-yellow-600">Mensagem longa</span>}
          </div>
        </div>

        {/* Preview */}
        {body && (
          <div className="bg-[#e5ddd5] rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Anteprima WhatsApp:</p>
            <div className="bg-white rounded-lg px-3 py-2 text-sm max-w-xs shadow-sm whitespace-pre-wrap">
              {preview}
            </div>
          </div>
        )}

        {/* AI Review result */}
        {aiReview && (
          <div className={`rounded-lg p-4 text-sm ${aiReview.approved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">{aiReview.approved ? 'Aprovado pela AI' : 'Reprovado pela AI'}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${aiReview.score >= 70 ? 'bg-green-200 text-green-800' : aiReview.score >= 40 ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                Score: {aiReview.score}/100
              </span>
            </div>
            {aiReview.issues.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-red-700 mb-1">Problemas:</p>
                <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                  {aiReview.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
              </div>
            )}
            {aiReview.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-1">Sugestoes:</p>
                <ul className="list-disc list-inside text-xs text-blue-600 space-y-0.5">
                  {aiReview.suggestions.map((sug, i) => <li key={i}>{sug}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleAiReview}
            disabled={!body.trim() || reviewing}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewing ? 'Analisando...' : 'Revisar com AI'}
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !body.trim() || saving || (aiReview !== null && !aiReview.approved)}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Criar Template'}
          </button>
        </div>
      </div>

      {/* Existing custom templates */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Seus Templates ({templates.length}/3)</h2>

        {templates.length === 0 && (
          <p className="text-sm text-gray-500">Nenhum template custom criado ainda.</p>
        )}

        {templates.map(t => {
          const statusBadge = STATUS_BADGES[t.metaStatus] || STATUS_BADGES.draft
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">{t.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                    {statusBadge.label}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Excluir
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {t.body}
              </div>

              {t.metaRejectedReason && (
                <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700">
                  <strong>Motivo da rejeicao:</strong> {t.metaRejectedReason}
                </div>
              )}

              {/* Actions based on status */}
              <div className="flex gap-2">
                {t.metaStatus === 'draft' && (
                  <button
                    onClick={() => handleSubmitToMeta(t.id)}
                    disabled={submitting === t.id}
                    className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                  >
                    {submitting === t.id ? 'Enviando...' : 'Enviar para Meta'}
                  </button>
                )}
                {t.metaStatus === 'submitted' && (
                  <span className="text-xs text-yellow-600">Aguardando aprovacao da Meta (pode levar ate 24h)...</span>
                )}
                {t.metaStatus === 'approved' && (
                  <span className="text-xs text-green-600">Pronto para usar em campanhas!</span>
                )}
                {t.metaStatus === 'rejected' && (
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Excluir e recriar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
