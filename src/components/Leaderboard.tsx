import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface GameRow {
  id: string
  player1_name: string
  player2_name: string
  player1_id: string
  winner_id: string | null
  created_at: string
  shotCount: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Leaderboard() {
  const [games, setGames] = useState<GameRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)

    async function load() {
      const { data: gamesData } = await supabase
        .from('games')
        .select('id, player1_name, player2_name, player1_id, winner_id, created_at')
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!gamesData) { setLoading(false); return }

      const ids = gamesData.map(g => g.id)

      // Pobierz liczbę strzałów dla każdej gry
      const { data: shotsData } = await supabase
        .from('shots')
        .select('game_id')
        .in('game_id', ids)

      const countMap: Record<string, number> = {}
      for (const s of shotsData ?? []) {
        countMap[s.game_id] = (countMap[s.game_id] ?? 0) + 1
      }

      setGames(gamesData.map(g => ({
        ...g,
        shotCount: countMap[g.id] ?? 0,
      })))
      setLoading(false)
    }

    load()
  }, [open])

  return (
    <div className="w-full max-w-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-cyan-950 border border-cyan-800
                   rounded-2xl text-cyan-400 font-semibold text-sm tracking-wide hover:bg-cyan-900
                   transition-colors"
      >
        <span>📋 Historia rozgrywek</span>
        <span className="text-cyan-600 text-xs">{open ? '▲ zwiń' : '▼ rozwiń'}</span>
      </button>

      {open && (
        <div className="mt-2 bg-cyan-950 border border-cyan-800 rounded-2xl overflow-hidden shadow-xl shadow-cyan-900/30">
          {loading ? (
            <p className="text-cyan-600 text-sm text-center py-6 animate-pulse">Ładowanie…</p>
          ) : games.length === 0 ? (
            <p className="text-cyan-800 text-sm text-center py-6">Brak rozegranych gier.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyan-800 text-cyan-500 text-xs">
                    <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Gracz 1</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Gracz 2</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Zwycięzca</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Strzały</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g, i) => {
                    const winner = g.winner_id === g.player1_id ? g.player1_name : g.player2_name
                    return (
                      <tr
                        key={g.id}
                        className={[
                          'border-b border-cyan-900/50 transition-colors hover:bg-cyan-900/30',
                          i % 2 === 0 ? '' : 'bg-cyan-900/10',
                        ].join(' ')}
                      >
                        <td className="px-4 py-2.5 text-cyan-700 text-xs whitespace-nowrap">{formatDate(g.created_at)}</td>
                        <td className="px-3 py-2.5 text-cyan-300 font-medium">{g.player1_name}</td>
                        <td className="px-3 py-2.5 text-cyan-300 font-medium">{g.player2_name}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            🏆 {winner}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-cyan-500 font-mono">{g.shotCount}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
