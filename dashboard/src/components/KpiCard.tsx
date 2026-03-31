export function KpiCard({ title, value, accent }: {
  title: string
  value: string | number
  accent?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs text-gray-500 mb-0.5">{title}</p>
      <p className={`text-xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
