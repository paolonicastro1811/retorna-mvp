const LIFECYCLE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inativo', cls: 'bg-red-100 text-red-800' },
}

const CAMPAIGN: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-700' },
  building: { label: 'Construindo', cls: 'bg-blue-100 text-blue-700' },
  ready: { label: 'Pronta', cls: 'bg-indigo-100 text-indigo-700' },
  sending: { label: 'Enviando', cls: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Concluida', cls: 'bg-green-100 text-green-800' },
}

const MESSAGE: Record<string, { label: string; cls: string }> = {
  queued: { label: 'Na Fila', cls: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Enviada', cls: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Entregue', cls: 'bg-indigo-100 text-indigo-700' },
  read: { label: 'Lida', cls: 'bg-green-100 text-green-800' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-800' },
}

const MAPS = { lifecycle: LIFECYCLE, campaign: CAMPAIGN, message: MESSAGE }

export function StatusBadge({ status, type = 'lifecycle' }: {
  status: string
  type?: 'lifecycle' | 'campaign' | 'message'
}) {
  const map = MAPS[type]
  const entry = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${entry.cls}`}>
      {entry.label}
    </span>
  )
}
