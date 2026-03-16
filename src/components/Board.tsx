import { useState } from 'react'

// Typy stanu pola
export type CellState = 'empty' | 'ship' | 'hit' | 'miss'

// Przykładowe pozycje statków do testów (indeksy wiersz * 10 + kolumna)
const TEST_SHIPS = new Set([11, 12, 13, 34, 44, 54, 77, 78, 95, 96, 97, 98])

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface CellProps {
  state: CellState
  onClick: () => void
}

function Cell({ state, onClick }: CellProps) {
  const [animating, setAnimating] = useState(false)

  function handleClick() {
    if (state === 'hit' || state === 'miss') return
    setAnimating(true)
    onClick()
  }

  // Kolory morskie: woda = teal/niebieski, statek = teal ciemny, trafienie = czerwień koralowa, pudło = lodowy błękit
  let colorClass: string
  if (state === 'hit') {
    colorClass = 'bg-red-500 hover:bg-red-400 border-red-700'
  } else if (state === 'miss') {
    colorClass = 'bg-cyan-100 hover:bg-cyan-100 border-cyan-300'
  } else if (state === 'ship') {
    colorClass = 'bg-teal-700 hover:bg-teal-600 border-teal-900'
  } else {
    colorClass = 'bg-cyan-700 hover:bg-cyan-500 border-cyan-900'
  }

  return (
    <div
      className={[
        'w-9 h-9 border flex items-center justify-center cursor-pointer select-none',
        'transition-colors duration-150',
        colorClass,
        // animacja skali po kliknięciu
        animating ? 'scale-90' : 'scale-100',
        'transition-transform duration-150',
      ].join(' ')}
      onClick={handleClick}
      onTransitionEnd={() => setAnimating(false)}
    >
      {state === 'miss' && (
        <span className="text-cyan-400 font-bold text-lg leading-none">×</span>
      )}
      {state === 'hit' && (
        <span className="text-red-200 font-bold text-base leading-none">✕</span>
      )}
    </div>
  )
}

export default function Board() {
  const [cells, setCells] = useState<CellState[]>(() =>
    Array.from({ length: 100 }, (_, i) => (TEST_SHIPS.has(i) ? 'ship' : 'empty'))
  )

  function handleClick(index: number) {
    setCells(prev => {
      const state = prev[index]
      if (state === 'hit' || state === 'miss') return prev
      const next = [...prev]
      next[index] = state === 'ship' ? 'hit' : 'miss'
      return next
    })
  }

  return (
    <div className="inline-block p-4 bg-cyan-950 rounded-2xl shadow-2xl shadow-cyan-900/60">
      {/* Nagłówek kolumn */}
      <div className="flex ml-9">
        {COLS.map(col => (
          <div key={col} className="w-9 h-7 flex items-center justify-center text-cyan-400 text-sm font-semibold">
            {col}
          </div>
        ))}
      </div>

      {/* Wiersze */}
      {ROWS.map((row, rowIdx) => (
        <div key={row} className="flex">
          {/* Etykieta wiersza */}
          <div className="w-9 h-9 flex items-center justify-center text-cyan-400 text-sm font-semibold">
            {row}
          </div>
          {/* Pola */}
          {COLS.map((_, colIdx) => {
            const index = rowIdx * 10 + colIdx
            return (
              <Cell
                key={index}
                state={cells[index]}
                onClick={() => handleClick(index)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
