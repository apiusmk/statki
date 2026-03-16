import { useState, useEffect } from 'react'
import Board from './components/Board'
import ShipPanel from './components/ShipPanel'
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
  // Największe statki najpierw — lepsza szansa sukcesu
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

// Ponawia próby aż do skutku
function buildRandomPlacement(): CellState[] {
  for (let i = 0; i < 50; i++) {
    const result = tryRandomPlacement()
    if (result) return result
  }
  return Array(100).fill('empty') // nie powinno się zdarzyć
}

export default function App() {
  const [cells, setCells] = useState<CellState[]>(() => Array(100).fill('empty'))
  const [placed, setPlaced] = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(SHIP_DEFS[0].id)
  const [orientation, setOrientation] = useState<Orientation>('h')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Klawisz R obraca statek
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setOrientation(o => o === 'h' ? 'v' : 'h')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const selectedDef = SHIP_DEFS.find(d => d.id === selectedId) ?? null

  // displayIndices: zawsze obliczone (obcięte do granicy) — dla czerwonego podglądu przy krawędzi
  const displayIndices: number[] =
    selectedDef && hoveredIndex !== null
      ? getDisplayIndices(hoveredIndex, selectedDef.size, orientation)
      : []

  // Podgląd jest poprawny tylko gdy żadne pole nie wychodzi poza planszę i brak kolizji
  const previewValid =
    displayIndices.length === (selectedDef?.size ?? 0) &&
    isValidPlacement(displayIndices, cells)

  function handleCellClick(index: number) {
    if (!selectedDef || displayIndices.length === 0 || !previewValid) return

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
    const newCells = buildRandomPlacement()
    setCells(newCells)
    // Ustaw placed na maksimum dla wszystkich typów
    const newPlaced: Record<string, number> = {}
    for (const d of SHIP_DEFS) newPlaced[d.id] = d.total
    setPlaced(newPlaced)
    setSelectedId(null)
  }

  function handleReady() {
    // TODO: przejście do fazy gry
    alert('Zaczynamy grę!')
  }

  const allPlaced = SHIP_DEFS.every(d => (placed[d.id] ?? 0) >= d.total)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold text-white tracking-wide">Statki - Multiplayer</h1>

      <div className="flex gap-8 items-start">
        <Board
          cells={cells}
          previewIndices={displayIndices.length > 0 ? displayIndices : null}
          previewValid={previewValid}
          onCellClick={handleCellClick}
          onCellHover={setHoveredIndex}
        />
        <ShipPanel
          ships={SHIP_DEFS}
          placed={placed}
          selectedId={selectedId}
          orientation={orientation}
          allPlaced={allPlaced}
          onSelect={setSelectedId}
          onToggleOrientation={() => setOrientation(o => o === 'h' ? 'v' : 'h')}
          onRandomize={handleRandomize}
          onReady={handleReady}
        />
      </div>
    </div>
  )
}
