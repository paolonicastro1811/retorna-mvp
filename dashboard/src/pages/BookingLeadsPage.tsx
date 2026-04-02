import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRestaurantId } from '../contexts/AuthContext'
import { api } from '../api/client'

interface Table { id: string; tableNumber: number; seats: number; isActive: boolean; posX: number | null; posY: number | null; width: number | null; height: number | null; label: string | null }
interface Hour { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }
interface Reservation {
  id: string
  customerName: string | null
  phone: string
  tableId: string | null
  date: string
  time: string
  endTime: string | null
  partySize: number
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  source: string
  table: Table | null
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: 'Pendente',   bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  confirmed: { label: 'Confirmada', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  seated:    { label: 'Sentado',    bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  completed: { label: 'Concluida',  bg: 'bg-gray-50',   text: 'text-gray-500',   dot: 'bg-gray-400' },
  cancelled: { label: 'Cancelada',  bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400' },
  no_show:   { label: 'Nao compareceu', bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-300' },
}

const DAY_NAMES_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = []
  const [oh, om] = openTime.split(':').map(Number)
  const [ch, cm] = closeTime.split(':').map(Number)
  let h = oh, m = om
  while (h < ch || (h === ch && m < cm)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    m += 30
    if (m >= 60) { h++; m -= 60 }
  }
  return slots
}

function getWeekDays(center: Date): Date[] {
  const start = new Date(center)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// Get current time in restaurant timezone (fetched from API, fallback to Sao Paulo)
let RESTAURANT_TZ = 'America/Sao_Paulo'
function getNowInRestaurantTz(): { hours: number; minutes: number; dateStr: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TZ,
    hour: 'numeric', minute: 'numeric', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
  return {
    hours: get('hour'),
    minutes: get('minute'),
    dateStr: `${get('year')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}`,
  }
}

export function BookingLeadsPage() {
  const restaurantId = useRestaurantId()
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [hours, setHours] = useState<Hour[]>([])
  const [loading, setLoading] = useState(true)

  // Edit reservation
  const [editId, setEditId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Inline slot editor (in map panel)
  const [slotEditing, setSlotEditing] = useState<string | null>(null) // slot time like "20:00"
  const [slotName, setSlotName] = useState('')
  const [slotPhone, setSlotPhone] = useState('')
  const [slotParty, setSlotParty] = useState(2)
  const [slotSaving, setSlotSaving] = useState(false)

  // Feedback
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Live clock — uses restaurant timezone (Brazil), updates every 30s
  const [nowMinutes, setNowMinutes] = useState(() => {
    const tz = getNowInRestaurantTz(); return tz.hours * 60 + tz.minutes
  })
  const [todayInTz, setTodayInTz] = useState(() => getNowInRestaurantTz().dateStr)
  useEffect(() => {
    const iv = setInterval(() => {
      const tz = getNowInRestaurantTz()
      setNowMinutes(tz.hours * 60 + tz.minutes)
      setTodayInTz(tz.dateStr)
    }, 30_000)
    return () => clearInterval(iv)
  }, [])

  const dateStr = toDateStr(selectedDate)
  // Use restaurant timezone for day-of-week
  const dayOfWeek = (() => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: RESTAURANT_TZ }).formatToParts(selectedDate)
      const day = parts.find(p => p.type === 'weekday')?.value ?? ''
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      return map[day] ?? selectedDate.getDay()
    } catch { return selectedDate.getDay() }
  })()
  const todayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
  const isClosed = todayHours?.isClosed ?? true
  const timeSlots = todayHours && !isClosed ? generateTimeSlots(todayHours.openTime, todayHours.closeTime) : []
  const weekDays = useMemo(() => getWeekDays(selectedDate), [dateStr])

  const fetchReservations = useCallback(async () => {
    try {
      const data = await api<Reservation[]>(`/restaurants/${restaurantId}/reservations?date=${dateStr}`)
      setReservations(data)
    } catch { setReservations([]) }
  }, [dateStr])

  useEffect(() => {
    Promise.all([
      api<Table[]>(`/restaurants/${restaurantId}/tables`),
      api<Hour[]>(`/restaurants/${restaurantId}/hours`),
      api<{ timezone: string }>(`/restaurants/${restaurantId}`),
    ]).then(([t, h, r]) => {
      setTables(t)
      setHours(h)
      if (r.timezone) RESTAURANT_TZ = r.timezone
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) fetchReservations()
  }, [fetchReservations, loading])

  // Auto-refresh every 15s — picks up AI bot reservations + triggers auto-complete
  useEffect(() => {
    if (loading) return
    const iv = setInterval(() => { fetchReservations() }, 15_000)
    return () => clearInterval(iv)
  }, [loading, fetchReservations])

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null) }, 4000)
      return () => clearTimeout(t)
    }
  }, [error, success])

  // Map: which table has what reservation
  const tableReservations = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    for (const r of reservations) {
      if (r.tableId && (r.status === 'confirmed' || r.status === 'seated')) {
        if (!map.has(r.tableId)) map.set(r.tableId, [])
        map.get(r.tableId)!.push(r)
      }
    }
    return map
  }, [reservations])

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(true); setError(null)
    try {
      await api(`/restaurants/${restaurantId}/reservations/${id}`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus }),
      })
      setEditId(null)
      setSuccess(`Status: ${STATUS_MAP[newStatus]?.label || newStatus}`)
      await fetchReservations()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(true); setError(null)
    try {
      await api(`/restaurants/${restaurantId}/reservations/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null); setEditId(null)
      setSuccess('Reserva excluida')
      await fetchReservations()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  // Stats
  const confirmed = reservations.filter(r => r.status === 'confirmed' || r.status === 'seated').length
  const totalCovers = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'no_show').reduce((s, r) => s + r.partySize, 0)

  const isToday = todayInTz === dateStr

  if (loading) return <div className="text-center py-20 text-gray-400 text-base">Carregando...</div>

  return (
    <div className="max-w-5xl">
      {/* Feedback toast */}
      {(error || success) && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl shadow-lg text-base font-medium ${
          error ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>{error || success}</div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-5 shadow-xl max-w-xs">
            <p className="text-base font-semibold text-gray-900 mb-1">Excluir reserva?</p>
            <p className="text-base text-gray-500 mb-4">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteConfirm)} disabled={actionLoading}
                className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-base font-semibold hover:bg-red-600 disabled:opacity-50">
                {actionLoading ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-base font-semibold hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-base text-gray-400 mt-0.5">
            {DAY_NAMES_PT[dayOfWeek]}, {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </p>
        </div>
      </div>

      {/* Week strip */}
      <div className="flex gap-1 mb-4 bg-gray-50 rounded-xl p-1.5">
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d) }}
          className="px-2 py-1 text-gray-400 hover:text-gray-700 text-base rounded-lg hover:bg-white transition-colors">&#8249;</button>
        {weekDays.map(d => {
          const ds = toDateStr(d)
          const isSelected = ds === dateStr
          const isT = todayInTz === ds
          const dayH = hours.find(h => h.dayOfWeek === d.getDay())
          const closed = dayH?.isClosed ?? true
          return (
            <button key={ds} onClick={() => setSelectedDate(new Date(d))}
              className={`flex-1 py-2 rounded-xl text-center transition-all ${
                isSelected ? 'bg-[#25D366] text-white shadow-sm'
                  : closed ? 'text-gray-300 cursor-default' : 'hover:bg-white text-gray-600'
              }`}>
              <div className="text-sm font-medium uppercase">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][d.getDay()]}
              </div>
              <div className={`text-lg font-bold ${isT && !isSelected ? 'text-[#25D366]' : ''}`}>{d.getDate()}</div>
              {closed && !isSelected && <div className="text-xs text-gray-300">Fechado</div>}
            </button>
          )
        })}
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d) }}
          className="px-2 py-1 text-gray-400 hover:text-gray-700 text-base rounded-lg hover:bg-white transition-colors">&#8250;</button>
      </div>

      {/* Reservas do dia — compact info */}
      {confirmed > 0 && (
        <div className="mb-4 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl px-4 py-2 flex items-center gap-4">
          <span className="text-base font-semibold text-[#1DA851]">{confirmed} reserva{confirmed > 1 ? 's' : ''} confirmada{confirmed > 1 ? 's' : ''}</span>
          <span className="text-base text-gray-400">·</span>
          <span className="text-base text-gray-500">{totalCovers} pessoas</span>
        </div>
      )}

      {/* ═══ Mapa das Mesas ═══ */}
      {isClosed && hours.length > 0 ? (
          <div className="text-center py-16">
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-lg text-gray-400 font-medium">Restaurante fechado</p>
            <p className="text-base text-gray-300 mt-1">{DAY_NAMES_PT[dayOfWeek]}</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-3xl mb-2">🪑</div>
            <p className="text-lg text-gray-400 font-medium">Nenhuma mesa configurada</p>
            <p className="text-base text-gray-300 mt-1">Vá em Configurações para criar as mesas do restaurante</p>
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Map */}
            <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="relative bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden select-none" style={{ height: 420 }}>
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
                  <defs>
                    <pattern id="grid-res" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="10" cy="10" r="0.8" fill="#9CA3AF" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid-res)" />
                </svg>

                {tables.map(table => {
                  const x = table.posX ?? 50
                  const y = table.posY ?? 50
                  const w = table.width ?? 10
                  const h = table.height ?? 10
                  const isSelected = editId === table.id
                  const tRes = tableReservations.get(table.id) || []

                  // Dynamic color based on current time
                  const isSeated = tRes.some(r => r.status === 'seated')
                  const hasReservationNow = isToday && tRes.some(r => {
                    const [rh, rm] = r.time.slice(0, 5).split(':').map(Number)
                    const resMin = rh * 60 + rm
                    // Reservation covers ~90min window
                    return nowMinutes >= resMin && nowMinutes < resMin + 90
                  })
                  // Upcoming reservation within next 30 min
                  const hasUpcomingSoon = isToday && tRes.some(r => {
                    const [rh, rm] = r.time.slice(0, 5).split(':').map(Number)
                    const resMin = rh * 60 + rm
                    return nowMinutes >= resMin - 30 && nowMinutes < resMin
                  })

                  const isOccupied = isSeated || hasReservationNow
                  const isSoon = !isOccupied && hasUpcomingSoon

                  // Colors: red=occupied, amber=arriving soon, green=free
                  const bg = isOccupied ? '#FEE2E2' : isSoon ? '#FEF3C7' : '#D1FAE5'
                  const border = isOccupied ? '#EF4444' : isSoon ? '#F59E0B' : '#25D366'
                  const statusLabel = isOccupied ? 'Ocupada' : isSoon ? 'Em breve' : null

                  return (
                    <div
                      key={table.id}
                      className={`absolute flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-[#25D366] ring-offset-2 shadow-lg z-20' : 'hover:shadow-md z-10'
                      }`}
                      style={{
                        left: `${x}%`, top: `${y}%`,
                        width: `${w}%`, height: `${h}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: bg,
                        border: `2px solid ${border}`,
                      }}
                      onClick={() => { setEditId(isSelected ? null : table.id); setSlotEditing(null) }}
                    >
                      <span className="text-[12px] font-bold text-gray-700 leading-none">{table.tableNumber}</span>
                      <span className="text-xs text-gray-500 leading-none">{table.seats}p</span>
                      {table.label && <span className="text-[7px] text-gray-400 leading-none mt-0.5">{table.label}</span>}
                      {statusLabel && (
                        <span className={`text-[7px] font-semibold leading-none mt-0.5 ${
                          isOccupied ? 'text-red-600' : 'text-amber-600'
                        }`}>{statusLabel}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#D1FAE5] border border-[#25D366]" /><span className="text-sm text-gray-400">Livre</span></div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#FEF3C7] border border-[#F59E0B]" /><span className="text-sm text-gray-400">Em breve</span></div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#FEE2E2] border border-[#EF4444]" /><span className="text-sm text-gray-400">Ocupada</span></div>
                <span className="text-xs text-gray-300 ml-2">Clique para detalhes</span>
              </div>
            </div>

            {/* Right panel — table time slots */}
            {editId && (() => {
              const selectedT = tables.find(t => t.id === editId)
              if (!selectedT) return null
              const tRes = reservations.filter(r => r.tableId === editId && (r.status === 'confirmed' || r.status === 'seated'))
              const bookedSlots = new Set(tRes.map(r => r.time.slice(0, 5)))

              return (
                <div className="w-56 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-4 self-start max-h-[480px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#D1FAE5] border-2 border-[#25D366] flex items-center justify-center text-base font-bold text-gray-700">
                        {selectedT.tableNumber}
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-800">Mesa {selectedT.tableNumber}</p>
                        <p className="text-sm text-gray-400">{selectedT.seats} lugares {selectedT.label ? `· ${selectedT.label}` : ''}</p>
                      </div>
                    </div>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                  </div>

                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Horarios do dia</p>

                  <div className="space-y-1">
                    {timeSlots.map(slot => {
                      const isBooked = bookedSlots.has(slot)
                      const res = tRes.find(r => r.time.slice(0, 5) === slot)
                      const isEditingSlot = slotEditing === slot
                      // Highlight current time slot
                      const [sh, sm] = slot.split(':').map(Number)
                      const slotMin = sh * 60 + sm
                      const isCurrentSlot = isToday && nowMinutes >= slotMin && nowMinutes < slotMin + 30

                      return (
                        <div key={slot}>
                          <div
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-base cursor-pointer transition-all ${
                              isBooked
                                ? `bg-red-50 border ${isCurrentSlot ? 'border-red-300 shadow-sm' : 'border-red-100'} hover:bg-red-100`
                                : `bg-green-50 border ${isCurrentSlot ? 'border-green-300 shadow-sm' : 'border-green-100'} hover:bg-green-100`
                            }`}
                            onClick={() => {
                              if (isEditingSlot) {
                                setSlotEditing(null)
                              } else {
                                setSlotEditing(slot)
                                setSlotName(''); setSlotPhone(''); setSlotParty(2)
                              }
                            }}
                          >
                            <span className={`font-semibold w-10 ${isBooked ? 'text-red-600' : 'text-green-700'}`}>
                              {isCurrentSlot && <span className="inline-block w-1 h-1 bg-emerald-400 rounded-full mr-0.5 animate-pulse" />}
                              {slot}
                            </span>
                            {isBooked ? (
                              <div className="flex-1 min-w-0 flex items-center gap-1">
                                <span className="text-red-600 font-medium truncate">{res?.customerName || res?.phone || 'Reservado'}</span>
                                <span className="text-red-400">{res?.partySize}p</span>
                              </div>
                            ) : (
                              <span className="text-green-600 font-medium flex-1">Livre</span>
                            )}
                            <span className="text-xs text-gray-300">{isEditingSlot ? '▲' : '▼'}</span>
                          </div>

                          {/* Inline editor — FREE slot: add reservation */}
                          {isEditingSlot && !isBooked && (
                            <div className="mt-1 p-2 bg-green-50/50 border border-green-200 rounded-lg space-y-1.5">
                              <p className="text-sm font-semibold text-green-700">Nova reserva — {slot}</p>
                              <input
                                type="text" placeholder="Nome" value={slotName}
                                onChange={e => setSlotName(e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                                onClick={e => e.stopPropagation()}
                              />
                              <input
                                type="tel" placeholder="Telefone *" value={slotPhone}
                                onChange={e => setSlotPhone(e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                                onClick={e => e.stopPropagation()}
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-gray-500">Pessoas:</span>
                                <button onClick={e => { e.stopPropagation(); setSlotParty(p => Math.max(1, p - 1)) }}
                                  className="w-5 h-5 rounded bg-gray-100 text-gray-600 text-base font-bold hover:bg-gray-200">−</button>
                                <span className="text-base font-bold text-gray-700 w-4 text-center">{slotParty}</span>
                                <button onClick={e => { e.stopPropagation(); setSlotParty(p => Math.min(20, p + 1)) }}
                                  className="w-5 h-5 rounded bg-gray-100 text-gray-600 text-base font-bold hover:bg-gray-200">+</button>
                              </div>
                              <button
                                disabled={slotSaving || !slotPhone.trim()}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setSlotSaving(true); setError(null)
                                  try {
                                    await api(`/restaurants/${restaurantId}/reservations`, {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        customerName: slotName.trim() || null,
                                        phone: slotPhone.trim(),
                                        date: dateStr,
                                        time: slot,
                                        partySize: slotParty,
                                        tableId: selectedT.id,
                                        status: 'confirmed',
                                        source: 'manual',
                                      }),
                                    })
                                    setSlotEditing(null)
                                    setSuccess('Reserva criada!')
                                    await fetchReservations()
                                  } catch (err: unknown) {
                                    setError(err instanceof Error ? err.message : 'Erro ao criar reserva')
                                  } finally { setSlotSaving(false) }
                                }}
                                className="w-full bg-[#25D366] text-white py-1 rounded text-base font-semibold hover:bg-[#1DA851] disabled:opacity-50 transition-colors"
                              >
                                {slotSaving ? 'Salvando...' : 'Reservar'}
                              </button>
                            </div>
                          )}

                          {/* Inline editor — BOOKED slot: details + cancel only */}
                          {isEditingSlot && isBooked && res && (
                            <div className="mt-1 p-2 bg-red-50/50 border border-red-200 rounded-lg space-y-1.5">
                              <div className="space-y-0.5">
                                <p className="text-base font-semibold text-gray-800">{res.customerName || 'Sem nome'}</p>
                                <p className="text-sm text-gray-500">{res.phone}</p>
                                <p className="text-sm text-gray-500">{res.partySize} pessoa{res.partySize > 1 ? 's' : ''} · {STATUS_MAP[res.status]?.label}</p>
                                {res.notes && <p className="text-sm text-gray-400 italic">{res.notes}</p>}
                              </div>
                              <button
                                disabled={actionLoading}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await handleStatusChange(res.id, 'cancelled')
                                  setSlotEditing(null)
                                }}
                                className="w-full bg-red-500 text-white py-1 rounded text-sm font-semibold disabled:opacity-50 hover:bg-red-600"
                              >{actionLoading ? 'Cancelando...' : 'Cancelar reserva'}</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {timeSlots.length === 0 && (
                    <p className="text-base text-gray-400 text-center py-4">Nenhum horario configurado para este dia</p>
                  )}
                </div>
              )
            })()}
          </div>
        )}
    </div>
  )
}
