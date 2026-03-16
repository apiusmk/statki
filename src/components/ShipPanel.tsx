import { Orientation, ShipDef } from '../types'

interface ShipPanelProps {
  ships: ShipDef[]
  placed: Record<string, number>
  selectedId: string | null
  orientation: Orientation
  allPlaced: boolean
  onSelect: (id: string) => void
  onToggleOrientation: () => void
  onRandomize: () => void
  onReady: () => void
}

// Wizualizacja kształtu statku zgodna z orientacją
function ShipShape({ size, orientation, active, exhausted }: {
  size: number
  orientation: Orientation
  active: boolean
  exhausted: boolean
}) {
  const seg = `rounded-sm transition-colors duration-150 h-3.5 w-6 ${
    exhausted ? 'bg-cyan-900' : active ? 'bg-cyan-400' : 'bg-teal-600'
  }`
  const isVertical = active && orientation === 'v'
  return (
    <div className={isVertical ? 'flex flex-col gap-0.5' : 'flex gap-0.5'}>
      {Array.from({ length: size }, (_, i) => <div key={i} className={seg} />)}
    </div>
  )
}

export default function ShipPanel({
  ships, placed, selectedId, orientation, allPlaced,
  onSelect, onToggleOrientation, onRandomize, onReady,
}: ShipPanelProps) {
  return (
    <div className="flex flex-col gap-3 p-5 bg-cyan-950 rounded-2xl shadow-2xl shadow-cyan-900/60 w-52">
      <h2 className="text-cyan-300 font-bold text-lg text-center tracking-wide">Flota</h2>

      {/* Lista statków */}
      <div className="flex flex-col gap-2">
        {ships.map(ship => {
          const remaining = ship.total - (placed[ship.id] ?? 0)
          const isSelected = selectedId === ship.id
          const isExhausted = remaining === 0

          return (
            <button
              key={ship.id}
              disabled={isExhausted}
              onClick={() => !isExhausted && onSelect(ship.id)}
              className={[
                'flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all duration-150',
                isSelected
                  ? 'border-cyan-400 bg-cyan-800 shadow-md shadow-cyan-700/40'
                  : isExhausted
                  ? 'border-cyan-900 bg-cyan-950 opacity-40 cursor-not-allowed'
                  : 'border-cyan-800 bg-cyan-900 hover:border-cyan-500 hover:bg-cyan-800 cursor-pointer',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-cyan-200'}`}>
                  {ship.name}
                </span>
                <span className="text-xs text-cyan-500 font-mono">{remaining}/{ship.total}</span>
              </div>
              <ShipShape
                size={ship.size}
                orientation={orientation}
                active={isSelected}
                exhausted={isExhausted}
              />
            </button>
          )
        })}
      </div>

      <div className="h-px bg-cyan-900" />

      {/* Przycisk OBRÓĆ */}
      <button
        onClick={onToggleOrientation}
        className="flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 rounded-xl border border-cyan-600 bg-cyan-900 text-white hover:bg-cyan-700 hover:border-cyan-400 active:scale-95 transition-all duration-150 font-bold tracking-wider text-sm"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-lg inline-block transition-transform duration-300"
            style={{ transform: orientation === 'v' ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ↔
          </span>
          OBRÓĆ
        </div>
        <span className="text-cyan-400 text-xs font-normal">
          {orientation === 'h' ? 'Poziomo' : 'Pionowo'} · klawisz R
        </span>
      </button>

      {/* Przycisk LOSOWE ROZMIESZCZENIE */}
      <button
        onClick={onRandomize}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-700 bg-cyan-900 text-cyan-300 hover:bg-cyan-800 hover:border-cyan-500 active:scale-95 transition-all duration-150 text-sm font-medium"
      >
        <span className="text-base">🎲</span>
        Losowe
      </button>

      {/* Przycisk GOTOWY */}
      <button
        disabled={!allPlaced}
        onClick={onReady}
        className={[
          'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-bold text-base tracking-wider transition-all duration-200',
          allPlaced
            ? 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 hover:border-emerald-400 active:scale-95 shadow-lg shadow-emerald-900/50'
            : 'border-cyan-900 bg-cyan-950 text-cyan-700 cursor-not-allowed opacity-50',
        ].join(' ')}
      >
        {allPlaced ? '✓ GOTOWY' : 'GOTOWY'}
      </button>
    </div>
  )
}
