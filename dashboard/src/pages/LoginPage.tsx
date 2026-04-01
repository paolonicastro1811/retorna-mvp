import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSending(true)
    setError('')

    try {
      await api('/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('404') || message.includes('nao cadastrado')) {
        setError('Email nao encontrado. Verifique ou crie uma conta.')
      } else {
        setError('Erro ao enviar o link. Tente novamente.')
      }
    } finally {
      setSending(false)
    }
  }

  // Success state — email sent
  if (sent) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-[#1a1a2e] mb-2">Verifique seu email</h1>
          <p className="text-sm text-[#6b7280] mb-1">
            Enviamos um link de acesso para:
          </p>
          <p className="text-sm font-bold text-[#1a1a2e] mb-6">{email}</p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
            <p className="text-xs text-amber-700">
              <strong>Nao recebeu?</strong> Verifique a pasta de spam. O link expira em 15 minutos.
            </p>
          </div>

          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="text-sm text-[#25D366] font-semibold hover:underline"
          >
            Tentar com outro email
          </button>
        </div>
      </div>
    )
  }

  // Login form
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-xl font-extrabold text-[#1a1a2e] mb-1">Entrar no painel</h1>
          <p className="text-sm text-[#6b7280]">
            Informe seu email para receber um link de acesso seguro
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#2d2d3a] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoFocus
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!email.trim() || sending}
            className="w-full bg-[#25D366] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#1DA851] disabled:opacity-40 transition-colors"
          >
            {sending ? 'Enviando...' : 'Enviar link de acesso'}
          </button>
        </form>

        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            🔒 Sem senha — voce recebera um link unico e seguro no email. A sessao permanece ativa por <strong>30 dias</strong>.
          </p>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-[#6b7280]">
            Ainda nao tem conta?{' '}
            <button onClick={() => navigate('/comecar')} className="text-[#25D366] font-semibold hover:underline">
              Ative seu restaurante
            </button>
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="block mx-auto mt-4 text-[10px] text-[#6b7280] hover:text-[#2d2d3a]"
        >
          Voltar para o inicio
        </button>
      </div>
    </div>
  )
}
