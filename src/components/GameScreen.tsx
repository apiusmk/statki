import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { playHit, playMiss, playSunk } from '../lib/sounds'
import { GameSession } from './Lobby'
import Board, { BoardEffect } from './Board'
import Chat from './Chat'
import { CellState } from '../types'

const TOTAL_SHIP_CELLS = 17

interface Shot {
  id: string
  shooter_id: string
  cell_index: number
  result: 'hit' | 'miss' | 'sunk'
}

// Znajdź wszystkie pola statku zaczynając od danej komórki (BFS, tylko poziomo/pionowo)
function findShipCells(startIndex: number, boardCells: string[]): number[] {
  const visited = new Set<number>()
  const queue = [startIndex]
  while (queue.length > 0) {
    const idx = queue.pop()!
    if (visited.has(idx) || boardCells[idx] !== 'ship') continue
    visited.add(idx)
    const row = Math.floor(idx / 10), col = idx % 10
    if (row > 0) queue.push(idx - 10)
    if (row < 9) queue.push(idx + 10)
    if (col > 0) queue.push(idx - 1)
    if (col < 9) queue.push(idx + 1)
  }
  return [...visited]
}

// Wyznacz zbiór pól zatopionych statków na podstawie historii strzałów
function computeSunkCells(
  shotsFromPlayer: Shot[],
  boardCells: string[]
): Set<number> {
  const sunkSet = new Set<number>()
  for (const shot of shotsFromPlayer) {
    if (shot.result !== 'sunk') continue
    for (const idx of findShipCells(shot.cell_index, boardCells)) {
      sunkSet.add(idx)
    }
  }
  return sunkSet
}

export interface GameResult {
  won: boolean
  totalShots: number
  durationSeconds: number
}

interface GameScreenProps {
  session: GameSession
  onGameOver: (result: GameResult) => void
}

interface Toast {
  id: number
  text: string
  type: 'sunk-me' | 'sunk-opp'
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
  const [toasts, setToasts] = useState<Toast[]>([])
  const [myEffects, setMyEffects] = useState<BoardEffect[]>([])
  const [oppEffects, setOppEffects] = useState<BoardEffect[]>([])
  const [myShake, setMyShake] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const toastCounterRef = useRef(0)
  const effectCounterRef = useRef(0)
  const startTimeRef = useRef(Date.now())

  function addEffect(board: 'my' | 'opp', cellIndex: number, type: BoardEffect['type']) {
    const id = ++effectCounterRef.current
    const effect: BoardEffect = { id, cellIndex, type }
    const setter = board === 'my' ? setMyEffects : setOppEffects
    setter(prev => [...prev, effect])
    const duration = type === 'sunk' ? 900 : 600
    setTimeout(() => setter(prev => prev.filter(e => e.id !== id)), duration)
  }

  function triggerShake() {
    setMyShake(true)
    setTimeout(() => setMyShake(false), 400)
  }

  const finishGame = useCallback((won: boolean, allShots: Shot[]) => {
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    onGameOver({ won, totalShots: allShots.length, durationSeconds })
  }, [onGameOver])

  function addToast(text: string, type: Toast['type']) {
    const id = ++toastCounterRef.current
    setToasts(prev => [...prev, { id, text, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

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
      const oppId   = game.player1_id === session.playerId ? game.player2_id  : game.player1_id
      const oppName = game.player1_id === session.playerId ? game.player2_name : game.player1_name
      setOpponentId(oppId)
      setOpponentName(oppName ?? 'Przeciwnik')

      if (game.status === 'finished') {
        // Pobierz strzały żeby przekazać statystyki
        const { data: sd } = await supabase.from('shots').select('id, shooter_id, cell_index, result')
          .eq('game_id', session.gameId)
        finishGame(game.winner_id === session.playerId, (sd ?? []) as Shot[])
        return
      }

      const { data: boards } = await supabase
        .from('boards').select('player_id, cells').eq('game_id', session.gameId)
      if (boards) {
        const mine = boards.find(b => b.player_id === session.playerId)
        const opp  = boards.find(b => b.player_id === oppId)
        if (mine) setMyCells(mine.cells as CellState[])
        if (opp)  setOpponentRawCells(opp.cells as string[])
      }

      const { data: shotsData } = await supabase
        .from('shots').select('id, shooter_id, cell_index, result')
        .eq('game_id', session.gameId).order('created_at')
      if (shotsData) setShots(shotsData as Shot[])

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subskrybuj nowe strzały i zmiany tury/statusu
  useEffect(() => {
    const channel = supabase
      .channel('game-play-' + session.gameId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shots', filter: `game_id=eq.${session.gameId}` },
        (payload) => {
          const shot = payload.new as Shot
          setShots(prev => [...prev, shot])
          // Dźwięk i toast dla strzałów PRZECIWNIKA
          if (shot.shooter_id !== session.playerId) {
            const type = shot.result === 'sunk' ? 'sunk' : shot.result === 'hit' ? 'hit' : 'miss'
            addEffect('my', shot.cell_index, type)
            if (shot.result === 'sunk') {
              playSunk()
              triggerShake()
              addToast('💥 Twój statek zatopiony!', 'sunk-me')
            } else if (shot.result === 'hit') {
              playHit()
              triggerShake()
            } else {
              playMiss()
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${session.gameId}` },
        (payload) => {
          setCurrentTurn(payload.new.current_turn)
          if (payload.new.status === 'finished') {
            setShots(prev => {
              finishGame(payload.new.winner_id === session.playerId, prev)
              return prev
            })
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session.gameId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer tury (reset po każdym strzale lub zmianie tury) ─────────────────

  // Klucz zmienia się przy każdym strzale i przy zmianie tury
  const timerKey = (currentTurn ?? '') + '-' + shots.length

  useEffect(() => {
    if (loading) return
    setTimeLeft(30)
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [timerKey, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-pass gdy timer dobiegnie końca na mojej turze
  useEffect(() => {
    if (timeLeft === 0 && currentTurn === session.playerId && opponentId && !shooting) {
      supabase.from('games').update({ current_turn: opponentId }).eq('id', session.gameId)
    }
  }, [timeLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pochodne stany plansz ─────────────────────────────────────────────────

  const myShots  = shots.filter(s => s.shooter_id === session.playerId)
  const oppShots = shots.filter(s => s.shooter_id !== session.playerId)

  const mySunkCells  = computeSunkCells(myShots,  opponentRawCells)
  const oppSunkCells = computeSunkCells(oppShots, myCells as unknown as string[])

  const myDisplayCells: CellState[] = myCells.map((cell, i) => {
    if (oppSunkCells.has(i)) return 'sunk'
    const shot = oppShots.find(s => s.cell_index === i)
    if (!shot) return cell
    return shot.result === 'miss' ? 'miss' : 'hit'
  })

  const oppDisplayCells: CellState[] = Array(100).fill('empty').map((_, i) => {
    if (mySunkCells.has(i)) return 'sunk'
    const shot = myShots.find(s => s.cell_index === i)
    if (!shot) return 'empty'
    return shot.result === 'miss' ? 'miss' : 'hit'
  })

  const isMyTurn   = currentTurn === session.playerId
  const alreadyShot = new Set(myShots.map(s => s.cell_index))

  // ── Strzelanie ─────────────────────────────────────────────────────────────
  async function handleShoot(index: number) {
    if (!isMyTurn || shooting || alreadyShot.has(index) || !opponentId) return
    setShooting(true)

    const isHit = opponentRawCells[index] === 'ship'

    // Sprawdź czy statek jest zatopiony po tym strzale
    let isSunk = false
    if (isHit) {
      const shipCells = findShipCells(index, opponentRawCells)
      const hitsSoFar = new Set(myShots.filter(s => s.result !== 'miss').map(s => s.cell_index))
      hitsSoFar.add(index)
      isSunk = shipCells.every(c => hitsSoFar.has(c))
    }

    const result: Shot['result'] = isSunk ? 'sunk' : isHit ? 'hit' : 'miss'

    // Liczba trafionych pól po tym strzale
    const totalHits = myShots.filter(s => s.result !== 'miss').length + (isHit ? 1 : 0)
    const gameOver  = totalHits >= TOTAL_SHIP_CELLS

    await supabase.from('shots').insert({
      game_id: session.gameId,
      shooter_id: session.playerId,
      cell_index: index,
      result,
    })

    // Efekt wizualny i dźwięk dla strzelającego
    const effectType = isSunk ? 'sunk' : isHit ? 'hit' : 'miss'
    addEffect('opp', index, effectType)
    if (isSunk) playSunk()
    else if (isHit) playHit()
    else playMiss()

    if (isSunk && !gameOver) addToast('💣 Zatopiony!', 'sunk-opp')

    if (gameOver) {
      await supabase.from('games')
        .update({ status: 'finished', winner_id: session.playerId })
        .eq('id', session.gameId)
      // Własny ekran końcowy — Realtime odpali finishGame u obu przez setShots powyżej
    } else if (!isHit) {
      await supabase.from('games').update({ current_turn: opponentId })
        .eq('id', session.gameId)
    }
    // Trafienie/zatopienie bez końca gry — tura pozostaje

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

      {/* Toasty zatopień */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={[
              'px-6 py-3 rounded-2xl font-bold text-sm shadow-xl animate-bounce',
              t.type === 'sunk-opp'
                ? 'bg-orange-700 text-orange-100 border border-orange-500'
                : 'bg-red-900 text-red-200 border border-red-700',
            ].join(' ')}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Wskaźnik tury + timer */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-white tracking-wide">Rozgrywka</h1>
        <div className="flex items-center gap-3">
          <div className={[
            'px-5 py-2 rounded-full text-sm font-semibold border transition-all duration-300',
            isMyTurn
              ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600 shadow-lg shadow-emerald-900/40'
              : 'bg-cyan-950 text-cyan-500 border-cyan-800',
          ].join(' ')}>
            {isMyTurn ? '🎯 Twoja tura — wybierz pole na planszy przeciwnika' : `⏳ Tura gracza ${opponentName}…`}
          </div>
          {/* Odliczanie */}
          <div className="flex flex-col items-center gap-0.5">
            <span className={[
              'text-2xl font-mono font-bold w-10 text-center transition-colors duration-300',
              timeLeft <= 5  ? 'text-red-400'
              : timeLeft <= 10 ? 'text-orange-400'
              : timeLeft <= 20 ? 'text-yellow-400'
              : 'text-emerald-400',
            ].join(' ')}>
              {timeLeft}
            </span>
            <div className="w-10 h-1 bg-cyan-900 rounded-full overflow-hidden">
              <div
                className={[
                  'h-full rounded-full transition-all duration-1000',
                  timeLeft <= 5  ? 'bg-red-500'
                  : timeLeft <= 10 ? 'bg-orange-500'
                  : timeLeft <= 20 ? 'bg-yellow-500'
                  : 'bg-emerald-500',
                ].join(' ')}
                style={{ width: `${(timeLeft / 30) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plansze */}
      <div className="flex gap-8 items-start flex-wrap justify-center">

        {/* Moja plansza */}
        <div className="flex flex-col gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-sm font-semibold tracking-wide">Moja flota</span>
            <span className="text-xs text-cyan-700">({session.playerName})</span>
          </div>
          <Board cells={myDisplayCells} previewIndices={null} previewValid={false}
            onCellClick={() => {}} onCellHover={() => {}} disabled
            effects={myEffects} shake={myShake} />
          <HitCounter label="Trafień na moją flotę"
            count={oppShots.filter(s => s.result !== 'miss').length} danger />
        </div>

        <div className="hidden lg:flex items-center self-stretch">
          <div className="w-px bg-cyan-900 h-full" />
        </div>

        {/* Plansza przeciwnika */}
        <div className="flex flex-col gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold tracking-wide ${isMyTurn ? 'text-emerald-400' : 'text-cyan-700'}`}>
              Flota {opponentName}
            </span>
            {isMyTurn && <span className="text-xs text-emerald-600 animate-pulse">← klikaj!</span>}
          </div>
          <div className={[
            'rounded-2xl transition-all duration-300',
            isMyTurn ? 'ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-900/30' : '',
            shooting ? 'opacity-60 pointer-events-none' : '',
          ].join(' ')}>
            <Board cells={oppDisplayCells} previewIndices={null} previewValid={false}
              onCellClick={handleShoot} onCellHover={() => {}}
              disabled={!isMyTurn || shooting}
              effects={oppEffects} />
          </div>
          <HitCounter label="Moje trafienia"
            count={myShots.filter(s => s.result !== 'miss').length} danger={false} />
        </div>

      </div>

      {/* Legenda */}
      <div className="flex gap-4 text-xs text-cyan-700 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />trafienie
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-orange-800 inline-block" />zatopiony
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-cyan-100 inline-block" />pudło
        </span>
      </div>

      {/* Czat */}
      <Chat
        gameId={session.gameId}
        playerId={session.playerId}
        playerName={session.playerName}
      />
    </div>
  )
}

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
