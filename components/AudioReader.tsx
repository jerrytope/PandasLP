'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Square } from 'lucide-react'
import styles from './AudioReader.module.css'

interface AudioReaderProps {
  text: string
  /** Strips markdown-style **bold** markers before reading — same convention as
   *  lib/renderFormattedText.tsx and lib/pdfGenerator.js, so the reader doesn't say "asterisk
   *  asterisk" out loud. */
  label?: string
}

function stripMarkers(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1')
}

// window.speechSynthesis reads a document/letter aloud — Play/Pause/Stop, a rate slider
// (0.5x-2x, the Web Speech API's own native range), a pitch slider, a voice picker, and
// active-word highlighting driven by the utterance's own onboundary event (word-level where
// the browser/voice supports it; falls back gracefully to no highlight otherwise — this is
// the browser telling us where it actually is, not something faked on a timer).
export default function AudioReader({ text, label = 'Listen' }: AudioReaderProps) {
  const [supported, setSupported] = useState(true)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState('')
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [charIndex, setCharIndex] = useState<number | null>(null)
  const [showText, setShowText] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const cleanText = useMemo(() => stripMarkers(text), [text])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false)
      return
    }
    function loadVoices() {
      const list = window.speechSynthesis.getVoices()
      setVoices(list)
      // Prefer an English voice as the default rather than whatever the browser lists first.
      if (!voiceURI && list.length > 0) {
        const preferred = list.find((v) => v.lang.startsWith('en')) ?? list[0]
        setVoiceURI(preferred.voiceURI)
      }
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function play() {
    if (!supported) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = rate
    utterance.pitch = pitch
    const voice = voices.find((v) => v.voiceURI === voiceURI)
    if (voice) utterance.voice = voice
    utterance.onstart = () => { setSpeaking(true); setPaused(false) }
    utterance.onend = () => { setSpeaking(false); setPaused(false); setCharIndex(null) }
    utterance.onerror = () => { setSpeaking(false); setPaused(false); setCharIndex(null) }
    utterance.onboundary = (event) => {
      if (event.name === 'word') setCharIndex(event.charIndex)
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setShowText(true)
  }

  function pause() {
    window.speechSynthesis.pause()
    setPaused(true)
  }

  function resume() {
    window.speechSynthesis.resume()
    setPaused(false)
  }

  function stop() {
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setPaused(false)
    setCharIndex(null)
  }

  // Splits the text at the currently-spoken word so it can render a highlighted <span> — only
  // computed while actually speaking, since it's meaningless (and wasted work) otherwise.
  const segments = useMemo(() => {
    if (charIndex === null) return null
    const rest = cleanText.slice(charIndex)
    const wordMatch = rest.match(/^\S+/)
    const wordLen = wordMatch ? wordMatch[0].length : 0
    return {
      before: cleanText.slice(0, charIndex),
      word: cleanText.slice(charIndex, charIndex + wordLen),
      after: cleanText.slice(charIndex + wordLen),
    }
  }, [cleanText, charIndex])

  if (!supported) {
    return <div className={styles.reader}><span className={styles.unsupported}>Read-aloud isn&apos;t supported in this browser.</span></div>
  }

  return (
    <div className={styles.reader}>
      <div className={styles.controlsRow}>
        <button
          type="button"
          className={styles.playBtn}
          onClick={speaking && !paused ? pause : paused ? resume : play}
          aria-label={speaking && !paused ? 'Pause' : 'Play'}
          title={label}
        >
          {speaking && !paused ? <Pause size={15} strokeWidth={2} aria-hidden="true" /> : <Play size={15} strokeWidth={2} aria-hidden="true" />}
        </button>
        <button type="button" className={styles.iconBtn} onClick={stop} disabled={!speaking} aria-label="Stop" title="Stop">
          <Square size={13} strokeWidth={2} aria-hidden="true" />
        </button>

        <select
          className={styles.select}
          value={voiceURI}
          onChange={(e) => setVoiceURI(e.target.value)}
          aria-label="Voice"
          title="Voice — name/accent as reported by your browser"
        >
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
          ))}
        </select>

        <label className={styles.sliderGroup}>
          Speed {rate.toFixed(1)}x
          <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed" />
        </label>
        <label className={styles.sliderGroup}>
          Pitch {pitch.toFixed(1)}
          <input type="range" min={0} max={2} step={0.1} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} aria-label="Pitch" />
        </label>
      </div>

      {showText && (
        <div className={styles.textView} aria-live="off">
          {segments ? (
            <>
              {segments.before}
              <span className={styles.wordActive}>{segments.word}</span>
              {segments.after}
            </>
          ) : (
            cleanText
          )}
        </div>
      )}
    </div>
  )
}
