import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError('')

    try {
      const data = await api<{
        token: string
        user: { id: string; email: string; name: string | null; restaurantId: string; restaurantName: string }
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })

      login(data.token, {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        restaurantId: data.user.restaurantId,
        restaurantName: data.user.restaurantName,
      })

      navigate('/painel')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('401')) {
        setError('Email ou senha incorretos.')
      } else {
        setError('Erro ao fazer login. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setResetSent(true)
    } catch {
      setError('Erro ao enviar email. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (resetSent) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-3">Verifique seu email</h1>
          <p className="text-base text-[#6b7280] mb-1">
            Se o email estiver cadastrado, enviamos um link para redefinir sua senha:
          </p>
          <p className="text-base font-bold text-[#1a1a2e] mb-6">{email}</p>

          <button
            onClick={() => { setForgotMode(false); setResetSent(false); setPassword('') }}
            className="w-full bg-[#25D366] text-white py-3 rounded-lg font-bold text-base hover:bg-[#1DA851] transition-colors"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">
            {forgotMode ? 'Redefinir senha' : 'Entrar no painel'}
          </h1>
          <p className="text-base text-[#6b7280]">
            {forgotMode
              ? 'Informe seu email para receber um link de redefinição'
              : 'Entre com seu email e senha'}
          </p>
        </div>

        <form onSubmit={forgotMode ? handleForgotPassword : handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#2d2d3a] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoFocus
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
            />
          </div>

          {!forgotMode && (
            <div>
              <label className="block text-sm font-medium text-[#2d2d3a] mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!email.trim() || (!forgotMode && !password.trim()) || loading}
            className="w-full bg-[#25D366] text-white py-3 rounded-lg font-bold text-base hover:bg-[#1DA851] disabled:opacity-40 transition-colors"
          >
            {loading
              ? (forgotMode ? 'Enviando...' : 'Entrando...')
              : (forgotMode ? 'Enviar link de redefinição' : 'Entrar')}
          </button>
        </form>

        <div className="text-center mt-4">
          {forgotMode ? (
            <button onClick={() => { setForgotMode(false); setError('') }}
              className="text-sm text-[#25D366] font-semibold hover:underline">
              Voltar ao login
            </button>
          ) : (
            <button onClick={() => { setForgotMode(true); setError('') }}
              className="text-sm text-[#6b7280] hover:text-[#2d2d3a] hover:underline">
              Esqueci minha senha
            </button>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-[#6b7280]">
            Ainda não tem conta?{' '}
            <button onClick={() => navigate('/comecar')} className="text-[#25D366] font-semibold hover:underline">
              Ative seu restaurante
            </button>
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="block mx-auto mt-4 text-sm text-[#6b7280] hover:text-[#2d2d3a]"
        >
          Voltar para o início
        </button>
      </div>
    </div>
  )
}
