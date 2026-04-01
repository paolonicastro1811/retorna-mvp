import { useCallback, useEffect, useRef, useState } from 'react'
import { RESTAURANT_ID } from '../config'
import { api } from '../api/client'

interface TableData {
  id: string
  tableNumber: number
  seats: number
  label: string | null
  posX: number | null
  posY: number | null
  width: number | null
  height: number | null
}

interface RoomLayout {
  roomShape: string
  roomDescription: string
}

interface GenerateResponse {
  layout: RoomLayout
  tables: TableData[]
}

const SEAT_COLORS: Record<number, string> = {
  1: '#E8F5E9', 2: '#C8E6C9', 3: '#A5D6A7', 4: '#81C784',
  5: '#66BB6A', 6: '#4CAF50', 7: '#43A047', 8: '#388E3C',
}

function getTableColor(seats: number): string {
  if (seats <= 0) return '#E8F5E9'
  if (seats >= 8) return '#388E3C'
  return SEAT_COLORS[seats] ?? '#81C784'
}

export function TableMapEditor() {
  const [tables, setTables] = useState<TableData[]>([])
  const [roomLayout, setRoomLayout] = useState<RoomLayout | null>(null)
  const [loading, setLoading] = useState(true)

  // AI Chat
  const [chatInput, setChatInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [showChat, setShowChat] = useState(false)

  // Drag
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const mapRef = useRef<HTMLDivElement>(null)

  // Edit panel
  const [editingTable, setEditingTable] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Adding
  const [adding, setAdding] = useState(false)

  // AI usage limit
  const [aiUsage, setAiUsage] = useState({ used: 0, limit: 5, remaining: 5 })

  useEffect(() => {
    Promise.all([
      api<TableData[]>(`/restaurants/${RESTAURANT_ID}/tables`),
      api<{ used: number; limit: number; remaining: number }>(`/restaurants/${RESTAURANT_ID}/tables/generate-usage`),
    ])
      .then(([t, usage]) => {
        setTables(t)
        if (t.length === 0) setShowChat(true)
        setAiUsage(usage)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── AI Generate ──
  const handleGenerate = async () => {
    if (!chatInput.trim() || generating) return
    const desc = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: desc }])
    setGenerating(true)
    try {
      const result = await api<GenerateResponse>(
        `/restaurants/${RESTAURANT_ID}/tables/generate`,
        { method: 'POST', body: JSON.stringify({ description: desc }) }
      )
      setTables(result.tables)
      setRoomLayout(result.layout)
      setAiUsage(prev => ({ ...prev, used: prev.used + 1, remaining: prev.remaining - 1 }))
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: `Pronto! Layout ${result.layout.roomShape} com ${result.tables.length} mesas. ${result.layout.roomDescription}`,
      }])
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'ai', text: `Erro: ${(err as Error).message}` }])
    } finally { setGenerating(false) }
  }

  // ── Drag & Drop ──
  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const table = tables.find(t => t.id === tableId)
    if (!table) return
    setDragOffset({
      x: e.clientX - rect.left - ((table.posX ?? 50) / 100) * rect.width,
      y: e.clientY - rect.top - ((table.posY ?? 50) / 100) * rect.height,
    })
    setDragging(tableId)
  }, [tables])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !mapRef.current) return
    const rect = mapRef.current.getBoundingClientRect()
    const newX = Math.max(2, Math.min(98, ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100))
    const newY = Math.max(2, Math.min(98, ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100))
    setTables(prev => prev.map(t =>
      t.id === dragging ? { ...t, posX: Math.round(newX * 10) / 10, posY: Math.round(newY * 10) / 10 } : t
    ))
  }, [dragging, dragOffset])

  const handleMouseUp = useCallback(async () => {
    if (!dragging) return
    const table = tables.find(t => t.id === dragging)
    setDragging(null)
    if (!table) return
    try {
      await api(`/restaurants/${RESTAURANT_ID}/tables/${table.id}`, {
        method: 'PATCH', body: JSON.stringify({ posX: table.posX, posY: table.posY }),
      })
    } catch (err) { console.error('Failed to save position:', err) }
  }, [dragging, tables])

  // ── Add table ──
  const handleAddTable = async (posX: number, posY: number) => {
    try {
      const newTable = await api<TableData>(`/restaurants/${RESTAURANT_ID}/tables/single`, {
        method: 'POST',
        body: JSON.stringify({ seats: 4, posX, posY, width: 10, height: 10 }),
      })
      setTables(prev => [...prev, newTable])
      setAdding(false)
      openEditPanel(newTable)
    } catch (err) { console.error(err) }
  }

  const handleMapClick = (e: React.MouseEvent) => {
    if (adding && mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect()
      const posX = Math.round(((e.clientX - rect.left) / rect.width) * 100)
      const posY = Math.round(((e.clientY - rect.top) / rect.height) * 100)
      handleAddTable(posX, posY)
      return
    }
    setEditingTable(null)
  }

  // ── Edit panel — live updates on tables state ──
  const openEditPanel = (table: TableData) => {
    setEditingTable(table.id)
  }

  // Update a field on the editing table instantly (live preview)
  const updateEditField = (field: Partial<TableData>) => {
    if (!editingTable) return
    setTables(prev => prev.map(t => t.id === editingTable ? { ...t, ...field } : t))
  }

  const handleSaveEdit = async () => {
    if (!editingTable) return
    const table = tables.find(t => t.id === editingTable)
    if (!table) return
    setSaving(true)
    try {
      await api<TableData>(`/restaurants/${RESTAURANT_ID}/tables/${editingTable}`, {
        method: 'PATCH',
        body: JSON.stringify({
          seats: table.seats,
          label: table.label || null,
          width: table.width,
          height: table.height,
        }),
      })
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleDeleteTable = async (tableId: string) => {
    try {
      await api(`/restaurants/${RESTAURANT_ID}/tables/${tableId}`, { method: 'DELETE' })
      setTables(prev => prev.filter(t => t.id !== tableId))
      setEditingTable(null)
    } catch (err) { console.error(err) }
  }

  const handleDuplicateTable = async (table: TableData) => {
    try {
      const newTable = await api<TableData>(`/restaurants/${RESTAURANT_ID}/tables/single`, {
        method: 'POST',
        body: JSON.stringify({
          seats: table.seats,
          label: table.label,
          posX: Math.min(95, (table.posX ?? 50) + 5),
          posY: Math.min(95, (table.posY ?? 50) + 5),
          width: table.width ?? 10,
          height: table.height ?? 10,
        }),
      })
      setTables(prev => [...prev, newTable])
      openEditPanel(newTable)
    } catch (err) { console.error(err) }
  }

  if (loading) return <div className="text-center py-10 text-gray-400 text-xs">Carregando mapa...</div>

  const editTarget = tables.find(t => t.id === editingTable)

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowChat(!showChat)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
            showChat ? 'bg-[#25D366] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#25D366]'
          }`}
        >
          <span>&#9733;</span> Gerador AI
        </button>
        <button
          onClick={() => { setAdding(!adding); setEditingTable(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
            adding ? 'bg-[#25D366] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#25D366]'
          }`}
        >
          <span>+</span> Adicionar Mesa
        </button>
        {tables.length > 0 && (
          <button
            onClick={async () => {
              if (!confirm('Tem certeza que deseja remover todas as mesas?')) return
              try {
                await api(`/restaurants/${RESTAURANT_ID}/tables`, { method: 'DELETE' })
                setTables([])
                setRoomLayout(null)
                setEditingTable(null)
              } catch (err) { console.error(err) }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white border border-red-200 text-red-400 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            Limpar tudo
          </button>
        )}

        <div className="flex-1" />

        <span className="text-[10px] text-gray-400">
          {tables.length} mesas · {tables.reduce((s, t) => s + t.seats, 0)} lugares
        </span>
      </div>

      {/* ── Add mode hint ── */}
      {adding && (
        <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-lg px-3 py-2 text-[10px] text-[#1DA851] font-medium flex items-center gap-2">
          <span className="text-sm">&#x1F4CD;</span>
          Clique no mapa para posicionar a nova mesa
          <button onClick={() => setAdding(false)} className="ml-auto text-gray-400 hover:text-gray-600">Cancelar</button>
        </div>
      )}

      {/* ── AI Chat (collapsible) ── */}
      {showChat && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Gerador de Layout com AI
            <span className={`ml-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
              aiUsage.remaining > 2 ? 'bg-green-100 text-green-700' :
              aiUsage.remaining > 0 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-600'
            }`}>
              {aiUsage.used}/{aiUsage.limit} usadas este mes
            </span>
          </p>
          <p className="text-[10px] text-gray-400 mb-3">
            Descreva seu restaurante e a AI cria o layout automaticamente. Ex: "Restaurante retangular, 6 mesas para 2 perto das janelas, 4 para 4 no centro, 2 grandes no fundo"
          </p>

          {chatMessages.length > 0 && (
            <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[10px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#DCF8C6] text-gray-800 rounded-tr-none'
                      : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none'
                  }`}>{msg.text}</div>
                </div>
              ))}
              {generating && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none px-3 py-2 text-[10px] text-gray-400 animate-pulse">
                    Gerando layout...
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input type="text" value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              placeholder="Descreva seu restaurante..."
              disabled={generating}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent disabled:opacity-50"
            />
            <button onClick={handleGenerate} disabled={generating || !chatInput.trim() || aiUsage.remaining <= 0}
              className="bg-[#25D366] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#1DA851] disabled:opacity-50 transition-colors shrink-0">
              {aiUsage.remaining <= 0 ? 'Limite atingido' : generating ? 'Gerando...' : 'Gerar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Map + Edit Panel ── */}
      <div className="flex gap-4">
        {/* Map canvas */}
        <div className="flex-1">
          <div
            ref={mapRef}
            className={`relative bg-white border-2 rounded-xl overflow-hidden select-none transition-colors ${
              adding ? 'border-[#25D366] cursor-crosshair' : 'border-dashed border-gray-200'
            }`}
            style={{ height: 420, cursor: adding ? 'crosshair' : (dragging ? 'grabbing' : 'default') }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleMapClick}
          >
            {/* Grid dots */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-15">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="0.8" fill="#9CA3AF" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Room label */}
            {roomLayout && (
              <div className="absolute top-2 left-3 text-[9px] text-gray-300 font-medium pointer-events-none">
                {roomLayout.roomShape}
              </div>
            )}

            {/* Tables */}
            {tables.map(table => {
              const x = table.posX ?? 50
              const y = table.posY ?? 50
              const w = table.width ?? 10
              const h = table.height ?? 10
              const isEditing = editingTable === table.id
              const isDragging = dragging === table.id
              const color = getTableColor(table.seats)

              return (
                <div
                  key={table.id}
                  onMouseDown={e => { if (!adding) handleMouseDown(e, table.id) }}
                  onClick={e => {
                    if (adding) return
                    e.stopPropagation()
                    openEditPanel(table)
                  }}
                  className={`absolute flex flex-col items-center justify-center rounded-lg transition-all ${
                    isDragging ? 'z-50 shadow-xl scale-105' : 'z-10 shadow-sm hover:shadow-md hover:scale-[1.02]'
                  } ${isEditing ? 'ring-2 ring-[#25D366] ring-offset-2' : ''}`}
                  style={{
                    left: `${x}%`, top: `${y}%`,
                    width: `${w}%`, height: `${h}%`,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: color,
                    cursor: adding ? 'crosshair' : (isDragging ? 'grabbing' : 'grab'),
                    border: `2px solid ${isEditing ? '#25D366' : 'rgba(0,0,0,0.12)'}`,
                  }}
                >
                  <span className="text-[11px] font-bold text-gray-800 leading-none">
                    {table.tableNumber}
                  </span>
                  <span className="text-[8px] text-gray-600 leading-none mt-0.5">
                    {table.seats}p
                  </span>
                  {table.label && (
                    <span className="text-[7px] text-gray-500 leading-none mt-0.5 truncate max-w-full px-1">
                      {table.label}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Empty */}
            {tables.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-2">
                <span className="text-3xl">&#x1FA91;</span>
                <span className="text-xs">Usa AI Generator ou clique + Adicionar Mesa</span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="text-[9px] text-gray-400">Lugares:</span>
            {[2, 4, 6, 8].map(s => (
              <div key={s} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: getTableColor(s) }} />
                <span className="text-[9px] text-gray-500">{s}p</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Edit Panel (right side) ── */}
        {editTarget && (
          <div className="w-52 shrink-0 bg-white border border-gray-200 rounded-xl p-4 space-y-3 self-start">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-gray-800"
                  style={{ backgroundColor: getTableColor(editTarget.seats) }}>
                  {editTarget.tableNumber}
                </div>
                <span className="text-xs font-bold text-gray-800">Mesa {editTarget.tableNumber}</span>
              </div>
              <button onClick={() => setEditingTable(null)} className="text-gray-400 hover:text-gray-600 text-sm">&#10005;</button>
            </div>

            {/* Seats */}
            <div>
              <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Lugares</label>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => updateEditField({ seats: Math.max(1, editTarget.seats - 1) })}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold transition-colors">-</button>
                <span className="text-lg font-bold text-gray-800 w-8 text-center">{editTarget.seats}</span>
                <button onClick={() => updateEditField({ seats: Math.min(20, editTarget.seats + 1) })}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold transition-colors">+</button>
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Rotulo</label>
              <input type="text" value={editTarget.label ?? ''}
                onChange={e => updateEditField({ label: e.target.value || null })}
                placeholder="Ex: Janela, Terraco, VIP..."
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] mt-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#25D366]"
              />
            </div>

            {/* Size */}
            <div>
              <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Tamanho</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {[
                  { label: 'P', w: 7, h: 7 },
                  { label: 'M', w: 10, h: 10 },
                  { label: 'G', w: 14, h: 12 },
                ].map(size => (
                  <button key={size.label}
                    onClick={() => updateEditField({ width: size.w, height: size.h })}
                    className={`py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                      (editTarget.width ?? 10) === size.w && (editTarget.height ?? 10) === size.h
                        ? 'bg-[#25D366] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>{size.label}</button>
                ))}
              </div>
              <div className="flex gap-2 mt-1.5">
                <div className="flex-1">
                  <label className="text-[8px] text-gray-400">Larg.</label>
                  <input type="number" min="4" max="25" value={editTarget.width ?? 10}
                    onChange={e => updateEditField({ width: Math.max(4, Math.min(25, parseInt(e.target.value) || 10)) })}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[8px] text-gray-400">Alt.</label>
                  <input type="number" min="4" max="25" value={editTarget.height ?? 10}
                    onChange={e => updateEditField({ height: Math.max(4, Math.min(25, parseInt(e.target.value) || 10)) })}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                  />
                </div>
              </div>
            </div>

            {/* Save button */}
            <button onClick={handleSaveEdit} disabled={saving}
              className="w-full bg-[#25D366] text-white py-1.5 rounded-lg text-[10px] font-semibold hover:bg-[#1DA851] disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => handleDuplicateTable(editTarget)}
                className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-gray-200 transition-colors">
                Duplicar
              </button>
              <button onClick={() => handleDeleteTable(editTarget.id)}
                className="flex-1 bg-red-50 text-red-500 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-red-100 transition-colors">
                Excluir
              </button>
            </div>

            {/* Position info */}
            <p className="text-[8px] text-gray-300 text-center">
              pos ({Math.round(editTarget.posX ?? 0)}, {Math.round(editTarget.posY ?? 0)})
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
