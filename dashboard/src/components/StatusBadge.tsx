const LIFECYCLE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Ativo', cls: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inativo', cls: 'bg-red-100 text-red-800' },
}

export function StatusBadge({ status }: { status: string }) {
  const entry = LIFECYCLE[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${entry.cls}`}>
      {entry.label}
    </span>
  )
}
