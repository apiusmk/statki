import { useState, useEffect } from 'react'
import Board from './components/Board'
import ShipPanel from './components/ShipPanel'
import Lobby, { GameSession } from './components/Lobby'
import GameScreen from './components/GameScreen'
import { supabase } from './lib/supabase'
import { CellState, Orientation, ShipDef } from './types'

const SHIP_DEFS: ShipDef[] = [
  { id: 'carrier',    name: 'Lotniskowiec', size: 5, total: 1 },
  { id: 'battleship', name: 'Pancernik',    size: 4, total: 1 },
  { id: 'cruiser',    name: 'Krążownik',    size: 3, total: 2 },
  { id: 'destroyer',  name: 'Niszczyciel',  size: 2, total: 1 },
]

// Oblicza indeksy do wyświetlenia podglądu (obcięte do granicy planszy)
function getDisplayIndices(index: number, size: number, orientation: Orientation): number[] {
  const row = Math.floor(index / 10)
  const col = index % 10
  const result: number[] = []
  if (orientation === 'h') {
    for (let i = 0; i < size; i++) {
      if (col + i < 10) result.push(index + i)
    }
  } else {
    for (let i = 0; i < size; i++) {
      if (row + i < 10) result.push(index + i * 10)
    }
  }
  return result
}

// Sprawdza, czy rozstawienie jest poprawne (brak nachodzenia i sąsiedztwa)
function isValidPlacement(indices: number[], cells: CellState[]): boolean {
  const set = new Set(indices)
  for (const idx of indices) {
    if (cells[idx] !== 'empty') return false
    const row = Math.floor(idx / 10)
    const col = idx % 10
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = row + dr, nc = col + dc
        if (nr < 0 || nr >= 10 || nc < 0 || nc >= 10) continue
        const ni = nr * 10 + nc
        if (!set.has(ni) && cells[ni] === 'ship') return false
      }
    }
  }
  return true
}

// Jedna próba losowego rozstawienia wszystkich statków; zwraca null gdy się nie uda
function tryRandomPlacement(): CellState[] | null {
  const cells: CellState[] = Array(100).fill('empty')
  const sizes = SHIP_DEFS.flatMap(d => Array(d.total).fill(d.size)).sort((a, b) => b - a)

  for (const size of sizes) {
    let placed = false
    for (let attempt = 0; attempt < 300; attempt++) {
      const orientation: Orientation = Math.random() < 0.5 ? 'h' : 'v'
      const index = Math.floor(Math.random() * 100)
      const indices = getDisplayIndices(index, size, orientation)
      if (indices.length === size && isValidPlacement(indices, cells)) {
        for (const idx of indices) cells[idx] = 'ship'
        placed = true
        break
      }
    }
    if (!placed) return null
  }
  return cells
}

function buildRandomPlacement(): CellState[] {
  for (let i = 0; i < 50; i++) {
    const result = tryRandomPlacement()
    if (result) return result
  }
  return Array(100).fill('empty')
}

// ── Ekran rozstawiania statków ─────────────────────────────────────────────
function PlacementScreen({ session, onGameStart }: { session: GameSession; onGameStart: () => void }) {
  const [cells, setCells] = useState<CellState[]>(() => Array(100).fill('empty'))
  const [placed, setPlaced] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(SHIP_DEFS[0].id)
  const [orientation, setOrientation] = useState<Orientation>('h')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [myBoardSaved, setMyBoardSaved] = useState(false)
  const [savingBoard, setSavingBoard] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Nasłuchuj na zmianę statusu gry → 'playing'
  useEffect(() => {
    const channel = supabase
      .channel('placement-' + session.gameId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${session.gameId}` },
        (payload) => {
          if (payload.new.status === 'playing') onGameStart()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Klawisz R obraca statek (tylko gdy plansza nie jest jeszcze zapisana)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && !myBoardSaved) setOrientation(o => o === 'h' ? 'v' : 'h')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [myBoardSaved])

  const selectedDef = SHIP_DEFS.find(d => d.id === selectedId) ?? null

  const displayIndices: number[] =
    selectedDef && hoveredIndex !== null && !myBoardSaved
      ? getDisplayIndices(hoveredIndex, selectedDef.size, orientation)
      : []

  const previewValid =
    displayIndices.length === (selectedDef?.size ?? 0) &&
    isValidPlacement(displayIndices, cells)

  function handleCellClick(index: number) {
    if (myBoardSaved || !selectedDef || displayIndices.length === 0 || !previewValid) return
    const newCells = [...cells]
    for (const idx of displayIndices) newCells[idx] = 'ship'
    setCells(newCells)
    const newPlaced = { ...placed, [selectedDef.id]: (placed[selectedDef.id] ?? 0) + 1 }
    setPlaced(newPlaced)
    if (newPlaced[selectedDef.id] >= selectedDef.total) {
      const next = SHIP_DEFS.find(d => (newPlaced[d.id] ?? 0) < d.total && d.id !== selectedDef.id)
      setSelectedId(next?.id ?? null)
    }
  }

  function handleRandomize() {
    if (myBoardSaved) return
    const newCells = buildRandomPlacement()
    setCells(newCells)
    const newPlaced: Record<string, number> = {}
    for (const d of SHIP_DEFS) newPlaced[d.id] = d.total
    setPlaced(newPlaced)
    setSelectedId(null)
  }

  async function handleReady() {
    setSavingBoard(true)
    setSaveError(null)

    // Zapisz planszę do Supabase
    const { error: boardErr } = await supabase
      .from('boards')
      .upsert({ game_id: session.gameId, player_id: session.playerId, cells, ready: true })

    if (boardErr) { setSaveError(boardErr.message); setSavingBoard(false); return }

    setMyBoardSaved(true)
    setSavingBoard(false)

    // Sprawdź czy przeciwnik też jest gotowy
    const { data: boards } = await supabase
      .from('boards')
      .select('player_id, ready')
      .eq('game_id', session.gameId)
      .eq('ready', true)

    // Jeśli obaj gotowi — zaktualizuj status gry (Realtime wywoła onGameStart u obu)
    if (boards && boards.length === 2) {
      await supabase
        .from('games')
        .update({ status: 'playing', current_turn: session.playerId })
        .eq('id', session.gameId)
    }
  }

  const allPlaced = SHIP_DEFS.every(d => (placed[d.id] ?? 0) >= d.total)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white tracking-wide">Rozstaw flotę</h1>
        <p className="text-cyan-600 text-sm mt-1">
          Pokój: <span className="font-mono text-cyan-400 font-bold tracking-widest">{session.gameCode}</span>
          {' · '}
          <span className="text-cyan-300 font-semibold">{session.playerName}</span>
        </p>
      </div>

      <div className="flex gap-8 items-start">
        <Board
          cells={cells}
          previewIndices={displayIndices.length > 0 ? displayIndices : null}
          previewValid={previewValid}
          onCellClick={handleCellClick}
          onCellHover={setHoveredIndex}
        />
        <div className="flex flex-col gap-3">
          <ShipPanel
            ships={SHIP_DEFS}
            placed={placed}
            selectedId={selectedId}
            orientation={orientation}
            allPlaced={allPlaced && !myBoardSaved}
            onSelect={id => { if (!myBoardSaved) setSelectedId(id) }}
            onToggleOrientation={() => { if (!myBoardSaved) setOrientation(o => o === 'h' ? 'v' : 'h') }}
            onRandomize={handleRandomize}
            onReady={handleReady}
          />

          {/* Status po kliknięciu GOTOWY */}
          {myBoardSaved && (
            <div className="p-4 bg-cyan-950 rounded-2xl border border-cyan-800 text-center">
              <p className="text-emerald-400 font-semibold text-sm">Flota gotowa!</p>
              <p className="text-cyan-600 text-xs mt-1 animate-pulse">Oczekiwanie na przeciwnika…</p>
              <div className="flex justify-center gap-1.5 mt-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {saveError && (
            <p className="text-red-400 text-xs text-center">{saveError}</p>
          )}
          {savingBoard && (
            <p className="text-cyan-500 text-xs text-center animate-pulse">Zapisywanie…</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Główny komponent ───────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<GameSession | null>(null)
  const [screen, setScreen] = useState<'lobby' | 'placement' | 'game' | 'gameover'>('lobby')
  const [won, setWon] = useState<boolean | null>(null)

  if (screen === 'lobby') {
    return <Lobby onEnterGame={s => { setSession(s); setScreen('placement') }} />
  }

  if (screen === 'placement' && session) {
    return <PlacementScreen session={session} onGameStart={() => setScreen('game')} />
  }

  if (screen === 'game' && session) {
    return (
      <GameScreen
        session={session}
        onGameOver={w => { setWon(w); setScreen('gameover') }}
      />
    )
  }

  // Ekran końca gry
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
      <p className={`text-5xl font-bold ${won ? 'text-emerald-400' : 'text-red-400'}`}>
        {won ? 'Zwycięstwo!' : 'Przegrana'}
      </p>
      <button
        onClick={() => { setSession(null); setScreen('lobby') }}
        className="px-6 py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold tracking-wider transition-all active:scale-95"
      >
        Zagraj ponownie
      </button>
    </div>
  )
}
