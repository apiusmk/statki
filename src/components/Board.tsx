import { CellState } from '../types'

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface BoardProps {
  cells: CellState[]
  previewIndices: number[] | null
  previewValid: boolean
  onCellClick: (index: number) => void
  onCellHover: (index: number | null) => void
  // disabled: blokuje interakcję (np. plansza przeciwnika gdy nie twoja tura)
  disabled?: boolean
}

function getCellClass(state: CellState, isPreview: boolean, previewValid: boolean, disabled: boolean): string {
  if (isPreview) {
    return previewValid ? 'bg-emerald-400 border-emerald-600' : 'bg-red-400 border-red-600'
  }
  if (state === 'ship') return 'bg-teal-700 hover:bg-teal-600 border-teal-900'
  if (state === 'hit')  return 'bg-red-500 border-red-700'
  if (state === 'miss') return 'bg-cyan-100 border-cyan-300'
  if (state === 'sunk') return 'bg-orange-800 border-orange-900'
  // puste pole — hover tylko gdy aktywne
  return disabled ? 'bg-cyan-700 border-cyan-900' : 'bg-cyan-700 hover:bg-cyan-500 border-cyan-900'
}

export default function Board({ cells, previewIndices, previewValid, onCellClick, onCellHover, disabled = false }: BoardProps) {
  const previewSet = new Set(previewIndices ?? [])

  return (
    <div
      className="inline-block p-4 bg-cyan-950 rounded-2xl shadow-2xl shadow-cyan-900/60"
      onMouseLeave={() => onCellHover(null)}
    >
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
          <div className="w-9 h-9 flex items-center justify-center text-cyan-400 text-sm font-semibold">
            {row}
          </div>
          {COLS.map((_, colIdx) => {
            const index = rowIdx * 10 + colIdx
            const state = cells[index]
            const isPreview = previewSet.has(index)
            return (
              <div
                key={index}
                className={[
                  'w-9 h-9 border flex items-center justify-center select-none',
                  'transition-all duration-100',
                  disabled ? 'cursor-default' : 'cursor-pointer active:scale-90',
                  getCellClass(state, isPreview, previewValid, disabled),
                ].join(' ')}
                onClick={() => !disabled && onCellClick(index)}
                onMouseEnter={() => !disabled && onCellHover(index)}
              >
                {state === 'miss' && <span className="text-cyan-400 text-xl leading-none">·</span>}
                {state === 'hit'  && <span className="text-red-200 font-bold text-base leading-none">✕</span>}
                {state === 'sunk' && <span className="text-orange-300 font-bold text-base leading-none">✕</span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
