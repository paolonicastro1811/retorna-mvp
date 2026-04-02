import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { WhatsAppIcon } from '../components/icons'

interface WhatsAppStatus {
  connected: boolean
  phoneNumber?: string
  connectedAt?: string
}

interface SignupData {
  waba_id?: string
  phone_number_id?: string
}

export default function WhatsAppConnectPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [fbReady, setFbReady] = useState(false)
  const signupDataRef = useRef<SignupData | null>(null)

  // Fetch WhatsApp connection status on mount
  useEffect(() => {
    api<WhatsAppStatus>('/whatsapp/status')
      .then(setStatus)
      .catch((err) => {
        console.error('Failed to fetch WhatsApp status:', err)
        setStatus({ connected: false })
      })
      .finally(() => setLoading(false))
  }, [])

  // Listen for Embedded Signup postMessage events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return
      }

      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          signupDataRef.current = data.data as SignupData
        }
      } catch {
        // Not a JSON message, ignore
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Load Facebook SDK dynamically
  useEffect(() => {
    window.fbAsyncInit = () => {
      setFbReady(true)
    }

    // SDK already loaded
    if (window.FB) {
      setFbReady(true)
      return
    }

    // Inject script if not already in the DOM
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script')
      script.id = 'facebook-jssdk'
      script.src = 'https://connect.facebook.net/en_US/sdk.js'
      script.async = true
      script.defer = true
      script.crossOrigin = 'anonymous'
      script.onerror = () => {
        setError('Não foi possível carregar o Facebook SDK. Desative o bloqueador de anúncios e recarregue a página.')
      }
      document.body.appendChild(script)
    }
  }, [])

  const handleConnect = () => {
    if (!fbReady || !window.FB) {
      setError('Facebook SDK não carregado. Desative o bloqueador de anúncios e recarregue a página.')
      return
    }

    // Always init right before login to guarantee correct state
    window.FB.init({
      appId: import.meta.env.VITE_FB_APP_ID || '',
      autoLogAppEvents: true,
      xfbml: true,
      version: 'v21.0',
    })

    setConnecting(true)
    setError('')
    signupDataRef.current = null

    window.FB.login(
      (response: FBLoginResponse) => {
        console.log('[WA Connect] FB.login response:', JSON.stringify(response))
        if (response.authResponse) {
          const accessToken = response.authResponse.accessToken
          const code = response.authResponse.code
          console.log('[WA Connect] Got auth response, accessToken=' + (accessToken ? 'yes' : 'no') + ' code=' + (code ? 'yes' : 'no'))

          // Small delay to allow the WA_EMBEDDED_SIGNUP message to arrive
          setTimeout(() => {
            const payload = {
              access_token: accessToken || '',
              code: code || '',
              waba_id: signupDataRef.current?.waba_id || '',
              phone_number_id: signupDataRef.current?.phone_number_id || '',
            }
            console.log('[WA Connect] Sending to backend:', JSON.stringify(payload))

            api<{
              phoneNumber: string
              connectedAt: string
            }>('/whatsapp/connect', {
              method: 'POST',
              body: JSON.stringify(payload),
            })
              .then((result) => {
                console.log('[WA Connect] Success:', JSON.stringify(result))
                setStatus({
                  connected: true,
                  phoneNumber: result.phoneNumber,
                  connectedAt: result.connectedAt,
                })
                window.dispatchEvent(new Event('whatsapp-status-changed'))
                // Redirect to dashboard after connection
                setTimeout(() => navigate('/painel'), 1500)
              })
              .catch((err) => {
                console.error('[WA Connect] Error:', err)
                setError(`Erro ao conectar: ${err instanceof Error ? err.message : 'Tente novamente.'}`)
              })
              .finally(() => setConnecting(false))
          }, 1000)
        } else {
          console.warn('[WA Connect] No authResponse — user cancelled or error')
          setError('Autorização cancelada pelo usuário.')
          setConnecting(false)
        }
      },
      {
        config_id: import.meta.env.VITE_FB_CONFIG_ID || '',
        response_type: 'token',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      },
    )
  }

  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) return

    try {
      await api('/whatsapp/disconnect', { method: 'POST' })
      setStatus({ connected: false })
      window.dispatchEvent(new Event('whatsapp-status-changed'))
    } catch {
      setError('Erro ao desconectar. Tente novamente.')
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR')
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-[#25D366] border-t-transparent rounded-full" />
      </div>
    )
  }

  // Connected state
  if (status?.connected) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          {/* Green checkmark circle */}
          <div className="mx-auto w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center mb-6">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#1a1a2e] mb-2">
            WhatsApp Conectado
          </h1>

          {status.phoneNumber && (
            <p className="text-lg text-gray-700 font-mono mb-1">
              {status.phoneNumber}
            </p>
          )}

          {status.connectedAt && (
            <p className="text-sm text-gray-500 mb-8">
              Conectado em {formatDate(status.connectedAt)}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-500 mb-4">{error}</p>
          )}

          <button
            onClick={handleDisconnect}
            className="px-6 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            Desconectar
          </button>
        </div>
      </div>
    )
  }

  // Not connected state
  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {/* WhatsApp icon large */}
        <div className="mx-auto w-20 h-20 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-6">
          <div className="scale-[2.5] text-[#25D366]">
            <WhatsAppIcon />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#1a1a2e] mb-2">
          Conecte seu WhatsApp
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Conecte sua conta WhatsApp Business para enviar campanhas de
          reativação automaticamente.
        </p>

        {/* Steps */}
        <div className="text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center text-sm font-bold">
              1
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800">
                Clique no botao abaixo
              </p>
              <p className="text-xs text-gray-500">
                Uma janela do Facebook ira abrir
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center text-sm font-bold">
              2
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800">
                Faca login no Facebook
              </p>
              <p className="text-xs text-gray-500">
                Use a conta que gerencia seu WhatsApp Business
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center text-sm font-bold">
              3
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800">
                Selecione seu numero WhatsApp Business
              </p>
              <p className="text-xs text-gray-500">
                Autorize o acesso para envio de mensagens
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        {/* CTA button */}
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#1DA851] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {connecting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              <span>Conectando...</span>
            </>
          ) : (
            <>
              <WhatsAppIcon />
              <span>Conectar WhatsApp Business</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
