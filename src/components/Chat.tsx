import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  player_id: string
  player_name: string
  text: string
  created_at: string
}

interface ChatProps {
  gameId: string
  playerId: string
  playerName: string
}

export default function Chat({ gameId, playerId, playerName }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Wczytaj historię wiadomości
  useEffect(() => {
    supabase
      .from('messages')
      .select('id, player_id, player_name, text, created_at')
      .eq('game_id', gameId)
      .order('created_at')
      .then(({ data }) => { if (data) setMessages(data as Message[]) })
  }, [gameId])

  // Nasłuchuj nowych wiadomości przez Realtime
  useEffect(() => {
    const channel = supabase
      .channel('chat-' + gameId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `game_id=eq.${gameId}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message])
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  // Auto-scroll do najnowszej wiadomości
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    await supabase.from('messages').insert({
      game_id: gameId,
      player_id: playerId,
      player_name: playerName,
      text: trimmed,
    })
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col w-64 bg-cyan-950 rounded-2xl border border-cyan-800 shadow-xl shadow-cyan-900/30 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-cyan-800">
        <h3 className="text-cyan-300 font-semibold text-sm tracking-wide">Czat</h3>
      </div>

      {/* Lista wiadomości */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 h-64">
        {messages.length === 0 && (
          <p className="text-cyan-800 text-xs text-center mt-4">Brak wiadomości. Napisz coś!</p>
        )}
        {messages.map(msg => {
          const isMe = msg.player_id === playerId
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5">
                {!isMe && <span className="text-cyan-500 text-xs font-semibold">{msg.player_name}</span>}
                <span className="text-cyan-800 text-xs">{formatTime(msg.created_at)}</span>
              </div>
              <div className={[
                'px-3 py-1.5 rounded-xl text-sm max-w-[90%] break-words',
                isMe
                  ? 'bg-cyan-700 text-white rounded-tr-sm'
                  : 'bg-cyan-900 text-cyan-100 rounded-tl-sm',
              ].join(' ')}>
                {msg.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pole tekstowe */}
      <div className="p-2 border-t border-cyan-800 flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Napisz…"
          maxLength={200}
          className="flex-1 px-3 py-1.5 rounded-xl bg-gray-900 border border-cyan-700 text-white
                     placeholder-cyan-800 text-sm focus:outline-none focus:border-cyan-500
                     transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40
                     text-white text-sm font-bold transition-all active:scale-95"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
