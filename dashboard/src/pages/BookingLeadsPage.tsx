import { useEffect, useState, useMemo, useCallback } from 'react'
import { RESTAURANT_ID } from '../config'
import { api } from '../api/client'

interface Table { id: string; tableNumber: number; seats: number; isActive: boolean }
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
  no_show:   { label: 'No-show',    bg: 'bg-red-50',    text: 'text-red-500',    dot: 'bg-red-300' },
}

const DAY_NAMES_PT = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado']
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

export function BookingLeadsPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [hours, setHours] = useState<Hour[]>([])
  const [loading, setLoading] = useState(true)

  // New reservation form
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formTime, setFormTime] = useState('')
  const [formParty, setFormParty] = useState(2)
  const [formTable, setFormTable] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit reservation
  const [editId, setEditId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Feedback
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Confirm delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const dateStr = toDateStr(selectedDate)
  const dayOfWeek = selectedDate.getDay()
  const todayHours = hours.find(h => h.dayOfWeek === dayOfWeek)
  const isClosed = todayHours?.isClosed ?? true
  const timeSlots = todayHours && !isClosed ? generateTimeSlots(todayHours.openTime, todayHours.closeTime) : []

  // Fix: use local-time-based string for memo dependency instead of UTC
  const weekDays = useMemo(() => getWeekDays(selectedDate), [dateStr])

  const fetchReservations = useCallback(async () => {
    try {
      const data = await api<Reservation[]>(`/restaurants/${RESTAURANT_ID}/reservations?date=${dateStr}`)
      setReservations(data)
    } catch { setReservations([]) }
  }, [dateStr])

  useEffect(() => {
    Promise.all([
      api<Table[]>(`/restaurants/${RESTAURANT_ID}/tables`),
      api<Hour[]>(`/restaurants/${RESTAURANT_ID}/hours`),
    ]).then(([t, h]) => {
      setTables(t)
      setHours(h)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) fetchReservations()
  }, [fetchReservations, loading])

  // Set default formTime to first slot when form opens or day changes
  useEffect(() => {
    if (showForm && timeSlots.length > 0 && !timeSlots.includes(formTime)) {
      setFormTime(timeSlots[0])
    }
  }, [showForm, timeSlots])

  // Auto-clear feedback
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null) }, 4000)
      return () => clearTimeout(t)
    }
  }, [error, success])

  const activeTables = tables.filter(t => t.isActive)

  const handleCreate = async () => {
    if (!formPhone.trim()) return setError('Telefone obrigatorio')
    if (!formTime || !timeSlots.includes(formTime)) return setError('Selecione um horario valido')
    if (isClosed) return setError('Restaurante fechado neste dia')
    const safeParty = Math.max(1, Math.min(20, formParty))
    setSaving(true)
    setError(null)
    try {
      await api(`/restaurants/${RESTAURANT_ID}/reservations`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: formName.trim() || null,
          phone: formPhone.trim(),
          date: dateStr,
          time: formTime,
          partySize: safeParty,
          tableId: formTable || null,
          notes: formNotes.trim() || null,
          source: 'manual',
        }),
      })
      setShowForm(false)
      setFormName(''); setFormPhone(''); setFormTime(''); setFormParty(2); setFormTable(''); setFormNotes('')
      setSuccess('Reserva criada!')
      await fetchReservations()
    } catch (e: any) {
      setError(e.message || 'Erro ao criar reserva')
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(true)
    setError(null)
    try {
      await api(`/restaurants/${RESTAURANT_ID}/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setEditId(null)
      setSuccess(`Status atualizado: ${STATUS_MAP[newStatus]?.label || newStatus}`)
      await fetchReservations()
    } catch (e: any) {
      setError(e.message || 'Erro ao atualizar status')
    } finally { setActionLoading(false) }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(true)
    setError(null)
    try {
      await api(`/restaurants/${RESTAURANT_ID}/reservations/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      setEditId(null)
      setSuccess('Reserva excluida')
      await fetchReservations()
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir reserva')
    } finally { setActionLoading(false) }
  }

  // Stats
  const totalRes = reservations.length
  const confirmed = reservations.filter(r => r.status === 'confirmed' || r.status === 'seated').length
  const pending = reservations.filter(r => r.status === 'pending').length
  const totalCovers = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'no_show').reduce((s, r) => s + r.partySize, 0)

  // Group by time slot
  const resByTime = new Map<string, Reservation[]>()
  for (const r of reservations) {
    const slot = r.time.slice(0, 5)
    if (!resByTime.has(slot)) resByTime.set(slot, [])
    resByTime.get(slot)!.push(r)
  }

  const isToday = toDateStr(new Date()) === dateStr

  if (loading) return <div className="text-center py-20 text-gray-400 text-xs">Carregando...</div>

  return (
    <div className="max-w-4xl">
      {/* Feedback toast */}
      {(error || success) && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl shadow-lg text-xs font-medium transition-all ${
          error ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {error || success}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-5 shadow-xl max-w-xs">
            <p className="text-xs font-semibold text-gray-900 mb-1">Excluir reserva?</p>
            <p className="text-[10px] text-gray-500 mb-4">Essa acao nao pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteConfirm)} disabled={actionLoading}
                className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-[10px] font-semibold hover:bg-red-600 disabled:opacity-50">
                {actionLoading ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Reservas</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {DAY_NAMES_PT[dayOfWeek]}, {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </p>
        </div>
        {!isClosed && hours.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-[#25D366] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#1DA851] transition-colors shadow-sm">
            <span className="text-sm">+</span> Nova reserva
          </button>
        )}
      </div>

      {/* Week strip */}
      <div className="flex gap-1 mb-5 bg-gray-50 rounded-xl p-1.5">
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d) }}
          aria-label="Semana anterior"
          className="px-2 py-1 text-gray-400 hover:text-gray-700 text-xs rounded-lg hover:bg-white transition-colors">
          &#8249;
        </button>
        {weekDays.map(d => {
          const ds = toDateStr(d)
          const isSelected = ds === dateStr
          const isT = toDateStr(new Date()) === ds
          const dayHours = hours.find(h => h.dayOfWeek === d.getDay())
          const closed = dayHours?.isClosed ?? true
          return (
            <button key={ds} onClick={() => setSelectedDate(new Date(d))}
              className={`flex-1 py-2 rounded-xl text-center transition-all ${
                isSelected
                  ? 'bg-[#25D366] text-white shadow-sm'
                  : closed
                    ? 'text-gray-300 cursor-default'
                    : 'hover:bg-white text-gray-600'
              }`}>
              <div className="text-[9px] font-medium uppercase">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][d.getDay()]}
              </div>
              <div className={`text-sm font-bold ${isT && !isSelected ? 'text-[#25D366]' : ''}`}>
                {d.getDate()}
              </div>
              {closed && !isSelected && <div className="text-[8px] text-gray-300">Fechado</div>}
            </button>
          )
        })}
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d) }}
          aria-label="Proxima semana"
          className="px-2 py-1 text-gray-400 hover:text-gray-700 text-xs rounded-lg hover:bg-white transition-colors">
          &#8250;
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: 'Total', value: totalRes, color: 'text-gray-900' },
          { label: 'Confirmadas', value: confirmed, color: 'text-emerald-600' },
          { label: 'Pendentes', value: pending, color: 'text-amber-600' },
          { label: 'Coperti', value: totalCovers, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
            <div className={`text-xl font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium uppercase mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* New reservation form */}
      {showForm && !isClosed && (
        <div className="mb-5 bg-white rounded-xl border border-[#25D366]/20 p-4 shadow-sm">
          <h3 className="text-xs font-bold text-gray-900 mb-3">
            Nova reserva para {String(selectedDate.getDate()).padStart(2, '0')}/{String(selectedDate.getMonth() + 1).padStart(2, '0')}
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Nome</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="Nome do cliente"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Telefone *</label>
              <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                placeholder="+5511999999999"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Horario *</label>
              <select value={formTime} onChange={e => setFormTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]">
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Pessoas</label>
              <input type="number" min={1} max={20} value={formParty}
                onChange={e => setFormParty(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Mesa</label>
              <select value={formTable} onChange={e => setFormTable(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]">
                <option value="">Automatica</option>
                {activeTables.filter(t => t.seats >= formParty).map(t => (
                  <option key={t.id} value={t.id}>Mesa {t.tableNumber} ({t.seats} lug.)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Notas</label>
              <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                placeholder="Aniversario, allergias..."
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#25D366]" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !formPhone.trim()}
              className="flex-1 bg-[#25D366] text-white py-2 rounded-lg text-xs font-semibold hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Criar reserva'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Closed day */}
      {isClosed && hours.length > 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-2">🔒</div>
          <p className="text-sm text-gray-400 font-medium">Restaurante fechado</p>
          <p className="text-[10px] text-gray-300 mt-1">{DAY_NAMES_PT[dayOfWeek]} nao tem horario de funcionamento configurado</p>
        </div>
      ) : hours.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-2">⚙️</div>
          <p className="text-sm text-gray-400 font-medium">Configure os horarios</p>
          <p className="text-[10px] text-gray-300 mt-1">Va em Configuracoes para definir horarios e mesas do restaurante</p>
        </div>
      ) : (
        /* Timeline */
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Timeline header */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase">
              Agenda do dia · {todayHours?.openTime} - {todayHours?.closeTime}
            </span>
            {isToday && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Hoje
              </span>
            )}
          </div>

          {/* Time slots */}
          <div className="divide-y divide-gray-50">
            {timeSlots.map(slot => {
              const slotRes = resByTime.get(slot) || []
              const isNow = isToday && (() => {
                const now = new Date()
                const [sh, sm] = slot.split(':').map(Number)
                const nowMin = now.getHours() * 60 + now.getMinutes()
                const slotMin = sh * 60 + sm
                return nowMin >= slotMin && nowMin < slotMin + 30
              })()

              return (
                <div key={slot} className={`flex ${isNow ? 'bg-emerald-50/40' : ''}`}>
                  {/* Time label */}
                  <div className={`w-16 shrink-0 py-2.5 px-3 text-right border-r border-gray-100 ${
                    isNow ? 'text-emerald-600 font-bold' : 'text-gray-400'
                  } text-[11px]`}>
                    {slot}
                    {isNow && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full ml-auto mt-0.5 animate-pulse" />}
                  </div>

                  {/* Reservations in this slot */}
                  <div className="flex-1 py-1.5 px-3 min-h-[36px]">
                    {slotRes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {slotRes.map(r => {
                          const st = STATUS_MAP[r.status] || STATUS_MAP.pending
                          const isEditing = editId === r.id
                          return (
                            <div key={r.id}
                              role="button"
                              tabIndex={0}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setEditId(isEditing ? null : r.id) } }}
                              className={`${st.bg} rounded-lg px-2.5 py-1.5 flex items-center gap-2 cursor-pointer transition-all hover:shadow-sm ${
                                isEditing ? 'ring-2 ring-[#25D366]/30' : ''
                              }`}
                              onClick={() => setEditId(isEditing ? null : r.id)}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[11px] font-semibold ${st.text}`}>
                                    {r.customerName || r.phone}
                                  </span>
                                  {r.customerName && (
                                    <span className="text-[9px] text-gray-400">{r.phone}</span>
                                  )}
                                  <span className="text-[9px] text-gray-400">
                                    {r.partySize}p
                                  </span>
                                  {r.table && (
                                    <span className="text-[9px] bg-white/60 text-gray-500 px-1 rounded">
                                      M{r.table.tableNumber}
                                    </span>
                                  )}
                                  {r.source === 'whatsapp_bot' && (
                                    <span className="text-[9px]" title="Via WhatsApp">💬</span>
                                  )}
                                </div>
                                {r.notes && (
                                  <p className="text-[9px] text-gray-400 truncate max-w-[200px]">{r.notes}</p>
                                )}
                              </div>

                              {/* Status actions on click */}
                              {isEditing && (
                                <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
                                  {r.status === 'pending' && (
                                    <button onClick={() => handleStatusChange(r.id, 'confirmed')} disabled={actionLoading}
                                      className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-medium hover:bg-emerald-600 disabled:opacity-50">
                                      Confirmar
                                    </button>
                                  )}
                                  {r.status === 'confirmed' && (
                                    <>
                                      <button onClick={() => handleStatusChange(r.id, 'seated')} disabled={actionLoading}
                                        className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-medium hover:bg-blue-600 disabled:opacity-50">
                                        Sentou
                                      </button>
                                      <button onClick={() => handleStatusChange(r.id, 'no_show')} disabled={actionLoading}
                                        className="text-[9px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded font-medium hover:bg-red-200 disabled:opacity-50">
                                        No-show
                                      </button>
                                    </>
                                  )}
                                  {r.status === 'seated' && (
                                    <button onClick={() => handleStatusChange(r.id, 'completed')} disabled={actionLoading}
                                      className="text-[9px] bg-gray-500 text-white px-1.5 py-0.5 rounded font-medium hover:bg-gray-600 disabled:opacity-50">
                                      Concluir
                                    </button>
                                  )}
                                  {(r.status === 'pending' || r.status === 'confirmed') && (
                                    <button onClick={() => handleStatusChange(r.id, 'cancelled')} disabled={actionLoading}
                                      className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium hover:bg-red-200 disabled:opacity-50">
                                      Cancelar
                                    </button>
                                  )}
                                  {r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'no_show' && (
                                    <button onClick={() => setDeleteConfirm(r.id)} disabled={actionLoading}
                                      aria-label="Excluir reserva"
                                      className="text-[9px] text-red-400 hover:text-red-600 px-1 disabled:opacity-50">
                                      ✕
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex items-center">
                        <span className="text-[9px] text-gray-200">—</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      {!isClosed && hours.length > 0 && (
        <div className="mt-3 flex items-center gap-3 justify-center flex-wrap">
          {Object.entries(STATUS_MAP).map(([key, s]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-[9px] text-gray-400">{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="text-[9px]">💬</span>
            <span className="text-[9px] text-gray-400">Via WhatsApp</span>
          </div>
        </div>
      )}
    </div>
  )
}
