import { useState, useEffect, useRef } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function getPlayerId(): string {
  let id = sessionStorage.getItem('playerId')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('playerId', id)
  }
  return id
}

export interface GameSession {
  gameId: string
  gameCode: string
  playerId: string
  playerName: string
  role: 'player1' | 'player2'
}

interface LobbyProps {
  onEnterGame: (session: GameSession) => void
}

export default function Lobby({ onEnterGame }: LobbyProps) {
  const [name, setName] = useState(() => sessionStorage.getItem('playerName') ?? '')
  const [joinCode, setJoinCode] = useState('')
  // waitingGame: gracz 1 stworzył grę i czeka na gracza 2
  const [waitingGame, setWaitingGame] = useState<{ id: string; code: string; playerId: string } | null>(null)
  const [loading, setLoading] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Subskrybuj zmiany gry gdy czekamy na gracza 2
  useEffect(() => {
    if (!waitingGame) return

    const channel = supabase
      .channel('lobby-wait-' + waitingGame.id)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${waitingGame.id}` },
        (payload) => {
          if (payload.new.status === 'placement') {
            onEnterGame({
              gameId: waitingGame.id,
              gameCode: waitingGame.code,
              playerId: waitingGame.playerId,
              playerName: name,
              role: 'player1',
            })
          }
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [waitingGame]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNameChange(value: string) {
    setName(value)
    sessionStorage.setItem('playerName', value)
  }

  function validate(requireCode = false): string | null {
    if (!name.trim()) return 'Podaj pseudonim.'
    if (requireCode && !joinCode.trim()) return 'Podaj kod pokoju.'
    return null
  }

  async function handleCreate() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setLoading('create')

    const playerId = getPlayerId()
    const code = generateCode()

    const { data, error: dbErr } = await supabase
      .from('games')
      .insert({ code, player1_id: playerId, player1_name: name.trim(), status: 'waiting' })
      .select('id')
      .single()

    setLoading(null)
    if (dbErr) { setError(dbErr.message); return }

    // Nie przechodzimy od razu — czekamy na gracza 2 przez Realtime
    setWaitingGame({ id: data.id, code, playerId })
  }

  async function handleJoin() {
    const err = validate(true)
    if (err) { setError(err); return }
    setError(null)
    setLoading('join')

    const playerId = getPlayerId()
    const code = joinCode.trim().toUpperCase()

    const { data: game, error: findErr } = await supabase
      .from('games')
      .select('id, player1_id, status')
      .eq('code', code)
      .single()

    if (findErr || !game) { setError('Nie znaleziono gry o tym kodzie.'); setLoading(null); return }
    if (game.status !== 'waiting') { setError('Ta gra już się rozpoczęła lub zakończyła.'); setLoading(null); return }
    if (game.player1_id === playerId) { setError('Nie możesz dołączyć do własnej gry.'); setLoading(null); return }

    const { error: joinErr } = await supabase
      .from('games')
      .update({ player2_id: playerId, player2_name: name.trim(), status: 'placement' })
      .eq('id', game.id)

    setLoading(null)
    if (joinErr) { setError(joinErr.message); return }

    // Gracz 2 przechodzi od razu — to on zmienił status, więc Realtime odpali u gracza 1
    onEnterGame({ gameId: game.id, gameCode: code, playerId, playerName: name.trim(), role: 'player2' })
  }

  // ── Ekran oczekiwania (po stworzeniu gry) ────────────────────────────────
  if (waitingGame) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white tracking-widest mb-1">STATKI</h1>
          <p className="text-cyan-600 text-sm tracking-wide">Multiplayer</p>
        </div>

        <div className="flex flex-col items-center gap-4 p-8 bg-cyan-950 rounded-2xl border border-cyan-800 shadow-2xl shadow-cyan-900/40">
          <p className="text-cyan-400 text-sm font-medium">Kod pokoju</p>
          <p className="text-white font-mono text-5xl font-bold tracking-[.3em]">{waitingGame.code}</p>
          <p className="text-cyan-500 text-sm mt-2 animate-pulse">Oczekiwanie na drugiego gracza…</p>

          {/* Animowany wskaźnik oczekiwania */}
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => setWaitingGame(null)}
          className="text-cyan-700 hover:text-cyan-500 text-sm transition-colors"
        >
          Anuluj
        </button>
      </div>
    )
  }

  // ── Główny ekran lobby ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-10 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white tracking-widest mb-1">STATKI</h1>
        <p className="text-cyan-600 text-sm tracking-wide">Multiplayer</p>
      </div>

      <div className="flex flex-col gap-1.5 w-72">
        <label className="text-cyan-400 text-sm font-semibold tracking-wide">Pseudonim</label>
        <input
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Wpisz swój nick…"
          maxLength={20}
          className="px-4 py-3 rounded-xl bg-cyan-950 border border-cyan-700 text-white placeholder-cyan-800
                     focus:outline-none focus:border-cyan-400 transition-colors text-base"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-5 items-stretch flex-wrap justify-center">
        {/* Stwórz grę */}
        <div className="flex flex-col gap-4 p-6 bg-cyan-950 rounded-2xl border border-cyan-800 w-60 shadow-xl shadow-cyan-900/30">
          <h2 className="text-cyan-200 font-bold text-center text-lg">Nowa gra</h2>
          <p className="text-cyan-600 text-xs text-center -mt-2">Stwórz pokój i poczekaj na przeciwnika</p>
          <button
            onClick={handleCreate}
            disabled={loading === 'create'}
            className="mt-auto px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                       text-white font-bold tracking-wider transition-all duration-150 active:scale-95 text-sm"
          >
            {loading === 'create' ? 'Tworzenie…' : 'STWÓRZ GRĘ'}
          </button>
        </div>

        {/* Dołącz do gry */}
        <div className="flex flex-col gap-4 p-6 bg-cyan-950 rounded-2xl border border-cyan-800 w-60 shadow-xl shadow-cyan-900/30">
          <h2 className="text-cyan-200 font-bold text-center text-lg">Dołącz do gry</h2>
          <p className="text-cyan-600 text-xs text-center -mt-2">Wpisz kod pokoju od znajomego</p>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="px-4 py-3 rounded-xl bg-gray-900 border border-cyan-700 text-white placeholder-cyan-800
                       focus:outline-none focus:border-cyan-400 transition-colors font-mono
                       text-center text-xl tracking-[.35em] uppercase"
          />
          <button
            onClick={handleJoin}
            disabled={loading === 'join'}
            className="px-4 py-3 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50
                       text-white font-bold tracking-wider transition-all duration-150 active:scale-95 text-sm"
          >
            {loading === 'join' ? 'Dołączanie…' : 'DOŁĄCZ DO GRY'}
          </button>
        </div>
      </div>
    </div>
  )
}
