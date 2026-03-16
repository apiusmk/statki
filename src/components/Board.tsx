import { CellState } from '../types'

export interface BoardEffect {
  id: number
  cellIndex: number
  type: 'hit' | 'miss' | 'sunk'
}

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Pozycja środka pola w px względem kontenera planszy
// padding=16, etykieta=36, nagłówek=28, komórka=36
function cellCenter(index: number): { x: number; y: number } {
  const row = Math.floor(index / 10)
  const col = index % 10
  return {
    x: 16 + 36 + col * 36 + 18,
    y: 16 + 28 + row * 36 + 18,
  }
}

// Cząsteczki wybuchu przy zatopieniu — 8 kierunków
const PARTICLE_DIRS = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
]

interface EffectLayerProps {
  effects: BoardEffect[]
}

function EffectLayer({ effects }: EffectLayerProps) {
  return (
    <>
      {effects.map(effect => {
        const { x, y } = cellCenter(effect.cellIndex)

        if (effect.type === 'miss') {
          return (
            <div
              key={effect.id}
              className="fx-miss pointer-events-none absolute rounded-full border-2 border-cyan-400"
              style={{ width: 32, height: 32, left: x - 16, top: y - 16 }}
            />
          )
        }

        if (effect.type === 'hit') {
          return (
            <div
              key={effect.id}
              className="fx-hit pointer-events-none absolute text-2xl select-none"
              style={{ left: x - 14, top: y - 14 }}
            >
              🔥
            </div>
          )
        }

        // sunk — rdzeń + fala uderzeniowa + cząsteczki
        return (
          <div key={effect.id} className="pointer-events-none">
            {/* Fala uderzeniowa */}
            <div
              className="fx-sunk-ring absolute rounded-full border-4 border-orange-400"
              style={{ width: 32, height: 32, left: x - 16, top: y - 16 }}
            />
            {/* Rdzeń wybuchu */}
            <div
              className="fx-sunk-core absolute text-3xl select-none"
              style={{ left: x - 18, top: y - 18 }}
            >
              💥
            </div>
            {/* Cząsteczki */}
            {PARTICLE_DIRS.map(([dx, dy], i) => (
              <div
                key={i}
                className="fx-particle absolute rounded-full select-none"
                style={{
                  width: 8, height: 8,
                  left: x - 4, top: y - 4,
                  background: i % 2 === 0 ? '#f97316' : '#fbbf24',
                  '--px': `${dx * 38}px`,
                  '--py': `${dy * 38}px`,
                  animationDelay: `${i * 25}ms`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )
      })}
    </>
  )
}

interface BoardProps {
  cells: CellState[]
  previewIndices: number[] | null
  previewValid: boolean
  onCellClick: (index: number) => void
  onCellHover: (index: number | null) => void
  disabled?: boolean
  effects?: BoardEffect[]
  shake?: boolean
}

function getCellClass(state: CellState, isPreview: boolean, previewValid: boolean, disabled: boolean): string {
  if (isPreview) {
    return previewValid ? 'bg-emerald-400 border-emerald-600' : 'bg-red-400 border-red-600'
  }
  if (state === 'ship') return 'bg-teal-700 hover:bg-teal-600 border-teal-900'
  if (state === 'hit')  return 'bg-red-500 border-red-700'
  if (state === 'miss') return 'bg-cyan-100 border-cyan-300'
  if (state === 'sunk') return 'bg-orange-800 border-orange-900'
  return disabled ? 'bg-cyan-700 border-cyan-900' : 'bg-cyan-700 hover:bg-cyan-500 border-cyan-900'
}

export default function Board({
  cells, previewIndices, previewValid,
  onCellClick, onCellHover,
  disabled = false, effects = [], shake = false,
}: BoardProps) {
  const previewSet = new Set(previewIndices ?? [])

  return (
    <div
      className={['inline-block p-4 bg-cyan-950 rounded-2xl shadow-2xl shadow-cyan-900/60 relative', shake ? 'fx-shake' : ''].join(' ')}
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

      {/* Warstwa efektów wizualnych */}
      <EffectLayer effects={effects} />
    </div>
  )
}
