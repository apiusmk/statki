// Dźwięki generowane przez Web Audio API — bez zewnętrznych plików

function ctx(): AudioContext {
  if (!(window as unknown as Record<string, unknown>)._audioCtx) {
    (window as unknown as Record<string, unknown>)._audioCtx = new AudioContext()
  }
  return (window as unknown as Record<string, unknown>)._audioCtx as AudioContext
}

function noise(audioCtx: AudioContext, duration: number): AudioBufferSourceNode {
  const samples = audioCtx.sampleRate * duration
  const buffer = audioCtx.createBuffer(1, samples, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  return source
}

// Plusk — chybienie
export function playMiss() {
  const c = ctx(), t = c.currentTime

  const n = noise(c, 0.35)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(500, t)
  filter.frequency.exponentialRampToValueAtTime(80, t + 0.35)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0.25, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

  n.connect(filter); filter.connect(gain); gain.connect(c.destination)
  n.start(t); n.stop(t + 0.35)
}

// Uderzenie — trafienie
export function playHit() {
  const c = ctx(), t = c.currentTime

  // Perkusyjny ton
  const osc = c.createOscillator()
  osc.frequency.setValueAtTime(280, t)
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.18)
  const oscGain = c.createGain()
  oscGain.gain.setValueAtTime(0.55, t)
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  osc.connect(oscGain); oscGain.connect(c.destination)
  osc.start(t); osc.stop(t + 0.18)

  // Krótki szum uderzenia
  const n = noise(c, 0.1)
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900
  const nGain = c.createGain()
  nGain.gain.setValueAtTime(0.4, t)
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  n.connect(filter); filter.connect(nGain); nGain.connect(c.destination)
  n.start(t); n.stop(t + 0.1)
}

// Wybuch — zatopienie statku
export function playSunk() {
  const c = ctx(), t = c.currentTime

  // Grzmot szumu
  const n = noise(c, 0.9)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(700, t)
  filter.frequency.exponentialRampToValueAtTime(40, t + 0.9)
  const nGain = c.createGain()
  nGain.gain.setValueAtTime(0.8, t)
  nGain.gain.setValueAtTime(0.8, t + 0.04) // chwilowe plateau
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
  n.connect(filter); filter.connect(nGain); nGain.connect(c.destination)
  n.start(t); n.stop(t + 0.9)

  // Niski basowy boom
  const osc = c.createOscillator()
  osc.frequency.setValueAtTime(90, t)
  osc.frequency.exponentialRampToValueAtTime(25, t + 0.5)
  const oscGain = c.createGain()
  oscGain.gain.setValueAtTime(0.65, t)
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
  osc.connect(oscGain); oscGain.connect(c.destination)
  osc.start(t); osc.stop(t + 0.5)

  // Drugie uderzenie z opóźnieniem (echo wybuchu)
  const n2 = noise(c, 0.3)
  const filter2 = c.createBiquadFilter()
  filter2.type = 'lowpass'
  filter2.frequency.value = 300
  const n2Gain = c.createGain()
  n2Gain.gain.setValueAtTime(0, t)
  n2Gain.gain.setValueAtTime(0.4, t + 0.12)
  n2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
  n2.connect(filter2); filter2.connect(n2Gain); n2Gain.connect(c.destination)
  n2.start(t); n2.stop(t + 0.45)
}
