import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'

export function VerifyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setErrorMsg('Link inválido — token ausente.')
      return
    }

    const verify = async () => {
      try {
        const res = await api<{
          token: string
          user: {
            id: string
            email: string
            name: string | null
            restaurantId: string
            restaurantName: string
          }
        }>(`/auth/verify?token=${token}`)

        login(res.token, res.user)
        setStatus('success')

        // Redirect to dashboard after brief success flash
        setTimeout(() => navigate('/painel', { replace: true }), 1200)
      } catch (err: unknown) {
        setStatus('error')
        const message = err instanceof Error ? err.message : ''
        if (message.includes('expirado')) {
          setErrorMsg('Link expirado. Solicite um novo link de acesso.')
        } else if (message.includes('utilizado')) {
          setErrorMsg('Este link ja foi utilizado. Solicite um novo.')
        } else {
          setErrorMsg('Link inválido ou expirado.')
        }
      }
    }

    verify()
  }, [searchParams, login, navigate])

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">

        {/* Verifying */}
        {status === 'verifying' && (
          <>
            <div className="w-12 h-12 border-3 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-5" />
            <h1 className="text-lg font-extrabold text-[#1a1a2e] mb-2">Verificando acesso...</h1>
            <p className="text-sm text-[#6b7280]">Aguarde um momento</p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-lg font-extrabold text-[#1a1a2e] mb-2">Acesso verificado!</h1>
            <p className="text-sm text-[#6b7280]">Entrando no painel...</p>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-extrabold text-[#1a1a2e] mb-2">Acesso negado</h1>
            <p className="text-sm text-[#6b7280] mb-6">{errorMsg}</p>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-[#25D366] text-white py-2.5 rounded-lg font-bold text-sm hover:bg-[#1DA851] transition-colors"
            >
              Solicitar novo link
            </button>
          </>
        )}
      </div>
    </div>
  )
}
