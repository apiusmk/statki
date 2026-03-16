import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { GameSession } from './Lobby'
import Board from './Board'
import { CellState } from '../types'

// Łączna liczba pól statków: 5+4+3+3+2 = 17
const TOTAL_SHIP_CELLS = 17

interface Shot {
  id: string
  shooter_id: string
  cell_index: number
  result: 'hit' | 'miss' | 'sunk'
}

interface GameScreenProps {
  session: GameSession
  onGameOver: (won: boolean) => void
}

export default function GameScreen({ session, onGameOver }: GameScreenProps) {
  const [myCells, setMyCells] = useState<CellState[]>(Array(100).fill('empty'))
  const [opponentRawCells, setOpponentRawCells] = useState<string[]>(Array(100).fill('empty'))
  const [shots, setShots] = useState<Shot[]>([])
  const [currentTurn, setCurrentTurn] = useState<string | null>(null)
  const [opponentId, setOpponentId] = useState<string | null>(null)
  const [opponentName, setOpponentName] = useState<string>('Przeciwnik')
  const [loading, setLoading] = useState(true)
  const [shooting, setShooting] = useState(false)

  // Wczytaj dane gry przy starcie
  useEffect(() => {
    async function load() {
      const { data: game } = await supabase
        .from('games')
        .select('current_turn, player1_id, player2_id, player1_name, player2_name, status, winner_id')
        .eq('id', session.gameId)
        .single()

      if (!game) { setLoading(false); return }

      setCurrentTurn(game.current_turn)

      const oppId   = game.player1_id === session.playerId ? game.player2_id   : game.player1_id
      const oppName = game.player1_id === session.playerId ? game.player2_name  : game.player1_name
      setOpponentId(oppId)
      setOpponentName(oppName ?? 'Przeciwnik')

      if (game.status === 'finished') {
        onGameOver(game.winner_id === session.playerId)
        return
      }

      // Wczytaj plansze obu graczy
      const { data: boards } = await supabase
        .from('boards')
        .select('player_id, cells')
        .eq('game_id', session.gameId)

      if (boards) {
        const mine = boards.find(b => b.player_id === session.playerId)
        const opp  = boards.find(b => b.player_id === oppId)
        if (mine) setMyCells(mine.cells as CellState[])
        if (opp)  setOpponentRawCells(opp.cells as string[])
      }

      // Wczytaj historię strzałów
      const { data: shotsData } = await supabase
        .from('shots')
        .select('id, shooter_id, cell_index, result')
        .eq('game_id', session.gameId)
        .order('created_at')

      if (shotsData) setShots(shotsData as Shot[])

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subskrybuj nowe strzały i zmiany tury/statusu gry
  useEffect(() => {
    const channel = supabase
      .channel('game-play-' + session.gameId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shots', filter: `game_id=eq.${session.gameId}` },
        (payload) => setShots(prev => [...prev, payload.new as Shot])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${session.gameId}` },
        (payload) => {
          setCurrentTurn(payload.new.current_turn)
          if (payload.new.status === 'finished') {
            onGameOver(payload.new.winner_id === session.playerId)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session.gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pochodne stany plansz ─────────────────────────────────────────────────

  // Moja plansza: moje statki + efekty strzałów przeciwnika
  const myDisplayCells: CellState[] = myCells.map((cell, i) => {
    const incomingShot = shots.find(s => s.shooter_id !== session.playerId && s.cell_index === i)
    if (!incomingShot) return cell
    return incomingShot.result === 'miss' ? 'miss' : 'hit'
  })

  // Plansza przeciwnika: tylko gdzie strzelałem (statki ukryte)
  const oppDisplayCells: CellState[] = Array(100).fill('empty').map((_, i) => {
    const myShot = shots.find(s => s.shooter_id === session.playerId && s.cell_index === i)
    if (!myShot) return 'empty'
    return myShot.result === 'miss' ? 'miss' : 'hit'
  })

  const isMyTurn = currentTurn === session.playerId

  // Komórki już ostrzelane przeze mnie
  const alreadyShot = new Set(
    shots.filter(s => s.shooter_id === session.playerId).map(s => s.cell_index)
  )

  // ── Strzelanie ─────────────────────────────────────────────────────────────
  async function handleShoot(index: number) {
    if (!isMyTurn || shooting || alreadyShot.has(index) || !opponentId) return
    setShooting(true)

    const isHit = opponentRawCells[index] === 'ship'
    const result: Shot['result'] = isHit ? 'hit' : 'miss'

    // Sprawdź warunek zwycięstwa
    const myHits = shots.filter(
      s => s.shooter_id === session.playerId && s.result !== 'miss'
    ).length + (isHit ? 1 : 0)
    const gameOver = myHits >= TOTAL_SHIP_CELLS

    await supabase.from('shots').insert({
      game_id: session.gameId,
      shooter_id: session.playerId,
      cell_index: index,
      result,
    })

    if (gameOver) {
      await supabase.from('games').update({ status: 'finished', winner_id: session.playerId })
        .eq('id', session.gameId)
    } else if (!isHit) {
      // Pudło — tura przechodzi do przeciwnika
      await supabase.from('games').update({ current_turn: opponentId })
        .eq('id', session.gameId)
    }
    // Trafienie bez końca gry — tura pozostaje u strzelającego (brak update)

    setShooting(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-cyan-400 animate-pulse text-lg">Ładowanie gry…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4 py-8">

      {/* Wskaźnik tury */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-white tracking-wide">Rozgrywka</h1>
        <div className={[
          'px-5 py-2 rounded-full text-sm font-semibold border transition-all duration-300',
          isMyTurn
            ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600 shadow-lg shadow-emerald-900/40'
            : 'bg-cyan-950 text-cyan-500 border-cyan-800',
        ].join(' ')}>
          {isMyTurn
            ? '🎯 Twoja tura — wybierz pole na planszy przeciwnika'
            : `⏳ Tura gracza ${opponentName}…`}
        </div>
      </div>

      {/* Plansze */}
      <div className="flex gap-8 items-start flex-wrap justify-center">

        {/* Moja plansza */}
        <div className="flex flex-col gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-sm font-semibold tracking-wide">
              Moja flota
            </span>
            <span className="text-xs text-cyan-700">({session.playerName})</span>
          </div>
          <Board
            cells={myDisplayCells}
            previewIndices={null}
            previewValid={false}
            onCellClick={() => {}}
            onCellHover={() => {}}
            disabled
          />
          {/* Licznik trafionych pól na mojej planszy */}
          <HitCounter
            label="Trafień na moją flotę"
            count={shots.filter(s => s.shooter_id !== session.playerId && s.result !== 'miss').length}
            danger
          />
        </div>

        {/* Separator */}
        <div className="hidden lg:flex items-center self-stretch">
          <div className="w-px bg-cyan-900 h-full" />
        </div>

        {/* Plansza przeciwnika */}
        <div className="flex flex-col gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold tracking-wide ${isMyTurn ? 'text-emerald-400' : 'text-cyan-700'}`}>
              Flota {opponentName}
            </span>
            {isMyTurn && (
              <span className="text-xs text-emerald-600 animate-pulse">← klikaj!</span>
            )}
          </div>
          <div className={[
            'rounded-2xl transition-all duration-300',
            isMyTurn ? 'ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-900/30' : '',
            shooting ? 'opacity-60 pointer-events-none' : '',
          ].join(' ')}>
            <Board
              cells={oppDisplayCells}
              previewIndices={null}
              previewValid={false}
              onCellClick={handleShoot}
              onCellHover={() => {}}
              disabled={!isMyTurn || shooting}
            />
          </div>
          {/* Licznik moich trafień */}
          <HitCounter
            label="Moje trafienia"
            count={shots.filter(s => s.shooter_id === session.playerId && s.result !== 'miss').length}
            danger={false}
          />
        </div>

      </div>
    </div>
  )
}

// Mały pasek postępu trafień
function HitCounter({ label, count, danger }: { label: string; count: number; danger: boolean }) {
  const pct = Math.round((count / TOTAL_SHIP_CELLS) * 100)
  return (
    <div className="w-full max-w-[360px] flex flex-col gap-1">
      <div className="flex justify-between text-xs text-cyan-700">
        <span>{label}</span>
        <span className={danger ? 'text-red-500' : 'text-emerald-500'}>{count}/{TOTAL_SHIP_CELLS}</span>
      </div>
      <div className="h-1.5 bg-cyan-950 rounded-full overflow-hidden border border-cyan-900">
        <div
          className={`h-full rounded-full transition-all duration-300 ${danger ? 'bg-red-600' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
