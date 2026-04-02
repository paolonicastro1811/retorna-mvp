interface TrialBannerProps {
  status: string
  daysRemaining: number
  onAction: () => void
  onDismiss?: () => void
}

export function TrialBanner({ status, daysRemaining, onAction, onDismiss }: TrialBannerProps) {
  const isExpired = status === 'expired'
  const isPastDue = status === 'past_due'

  return (
    <div className={`mb-6 rounded-xl p-4 flex items-center justify-between ${
      isExpired
        ? 'bg-red-50 border border-red-200'
        : isPastDue
          ? 'bg-orange-50 border border-orange-200'
          : 'bg-amber-50 border border-amber-200'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">
          {isExpired ? '🚫' : isPastDue ? '⚠️' : '⏳'}
        </span>
        <div>
          <p className={`text-sm font-semibold ${
            isExpired ? 'text-red-800' : isPastDue ? 'text-orange-800' : 'text-amber-800'
          }`}>
            {isExpired
              ? 'Seu período de teste expirou'
              : isPastDue
                ? 'Pagamento pendente — atualize seus dados'
                : daysRemaining <= 1
                  ? 'Último dia do teste gratuito!'
                  : `${daysRemaining} dias restantes no teste gratuito`
            }
          </p>
          <p className={`text-xs ${
            isExpired ? 'text-red-600' : isPastDue ? 'text-orange-600' : 'text-amber-600'
          }`}>
            {isExpired
              ? 'Assine para continuar usando o Retorna.'
              : isPastDue
                ? 'Atualize o pagamento para manter o acesso.'
                : 'Assine agora para não perder acesso.'
            }
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAction}
          className={`px-4 py-1.5 text-sm font-semibold rounded-lg text-white transition-colors ${
            isExpired
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-[#25D366] hover:bg-[#1DA851]'
          }`}
        >
          {isExpired || isPastDue ? 'Assinar agora' : 'Ver planos'}
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
            aria-label="Fechar"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
