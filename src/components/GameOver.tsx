interface GameOverProps {
  won: boolean
  totalShots: number
  durationSeconds: number
  onNewGame: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m} min ${s} sek` : `${s} sek`
}

export default function GameOver({ won, totalShots, durationSeconds, onNewGame }: GameOverProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-10 px-4">

      {/* Główny wynik */}
      <div className="flex flex-col items-center gap-3">
        <div className={[
          'text-7xl font-black tracking-tight',
          won ? 'text-emerald-400' : 'text-red-400',
        ].join(' ')}>
          {won ? 'WYGRAŁEŚ!' : 'PRZEGRAŁEŚ'}
        </div>
        <p className="text-cyan-600 text-lg">
          {won ? 'Gratulacje — wróg zatopiony!' : 'Twoja flota poszła na dno.'}
        </p>
      </div>

      {/* Statystyki */}
      <div className="flex gap-6 flex-wrap justify-center">
        <StatCard
          icon="🎯"
          label="Liczba strzałów"
          value={String(totalShots)}
        />
        <StatCard
          icon="⏱"
          label="Czas gry"
          value={formatDuration(durationSeconds)}
        />
      </div>

      {/* Przycisk nowej gry */}
      <button
        onClick={onNewGame}
        className="px-8 py-4 rounded-2xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold
                   text-lg tracking-widest transition-all duration-150 active:scale-95
                   shadow-xl shadow-cyan-900/40"
      >
        NOWA GRA
      </button>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-8 py-5 bg-cyan-950 rounded-2xl
                    border border-cyan-800 shadow-lg shadow-cyan-900/30 min-w-36">
      <span className="text-3xl">{icon}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-cyan-600 text-center">{label}</span>
    </div>
  )
}
