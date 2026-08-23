'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Pause, Play } from 'lucide-react'
import styles from './VoiceRecorder.module.css'

// Minimal ambient types for the Web Speech API — not part of TypeScript's standard DOM lib
// (still non-standard/vendor-prefixed in most browsers), so declared locally rather than
// globally to avoid leaking loosely-typed globals into the rest of the app.
interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number
  results: {
    length: number
    [index: number]: { 0: { transcript: string }; isFinal: boolean }
  }
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

interface VoiceRecorderProps {
  onInsert: (text: string) => void
  disabled?: boolean
}

// Live dictation via the browser's own Web Speech API — no external transcription vendor,
// no new API key, works entirely client-side. NOTE: this only covers live microphone
// dictation. Transcribing an already-recorded audio FILE (.mp3/.wav upload) is a separate
// capability the Web Speech API cannot do — that needs a dedicated speech-to-text vendor
// (e.g. Whisper API), which is a real new-vendor decision, not something to wire up silently.
export default function VoiceRecorder({ onInsert, disabled }: VoiceRecorderProps) {
  const [supported, setSupported] = useState(true)
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null)
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function startRecording() {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-NG'

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText) setTranscript((prev) => (prev ? `${prev} ${finalText}` : finalText).trim())
      setInterim(interimText)
    }
    recognition.onerror = () => {
      setRecording(false)
    }
    recognition.onend = () => {
      // Browsers auto-stop SpeechRecognition after a silence timeout even in continuous
      // mode — restart automatically unless the user explicitly paused/stopped.
      if (recording && !paused) recognition.start()
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
    setPaused(false)
    setOpen(true)
  }

  function pauseRecording() {
    recognitionRef.current?.stop()
    setPaused(true)
  }

  function resumeRecording() {
    setPaused(false)
    recognitionRef.current?.start()
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecording(false)
    setPaused(false)
    setInterim('')
  }

  function handleInsert() {
    if (transcript.trim()) onInsert(transcript.trim())
    setTranscript('')
    setOpen(false)
  }

  function handleCopy() {
    if (transcript.trim()) navigator.clipboard?.writeText(transcript.trim()).catch(() => {})
  }

  function handleDiscard() {
    stopRecording()
    setTranscript('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.micBtn} ${recording && !paused ? styles.micBtnActive : ''}`}
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled || !supported}
        title={supported ? 'Dictate' : 'Voice dictation is not supported in this browser'}
        aria-label="Dictate a message"
        aria-pressed={recording}
      >
        <Mic size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.panel} role="region" aria-label="Voice dictation">
          {!supported ? (
            <div className={styles.unsupported}>Voice dictation isn&apos;t supported in this browser — try Chrome or Edge.</div>
          ) : (
            <>
              <div className={styles.panelHeader}>
                <div className={styles.panelStatus}>
                  {recording && !paused && <span className={styles.recDot} aria-hidden="true" />}
                  {recording && !paused ? 'Listening…' : paused ? 'Paused' : 'Stopped'}
                </div>
                <div className={styles.panelControls}>
                  {recording && !paused && (
                    <button type="button" className="btn btn-sm" onClick={pauseRecording} title="Pause" aria-label="Pause recording">
                      <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                  {paused && (
                    <button type="button" className="btn btn-sm" onClick={resumeRecording} title="Resume" aria-label="Resume recording">
                      <Play size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                  {recording && (
                    <button type="button" className="btn btn-sm" onClick={stopRecording} title="Stop" aria-label="Stop recording">
                      <Square size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.transcript} aria-live="polite">
                {transcript || interim ? (
                  <>
                    {transcript}
                    {interim && <span style={{ opacity: 0.55 }}> {interim}</span>}
                  </>
                ) : (
                  <span className={styles.transcriptEmpty}>Start speaking — your words will appear here.</span>
                )}
              </div>
              <div className={styles.panelFooter}>
                <button type="button" className="btn btn-sm" onClick={handleDiscard}>Discard</button>
                <button type="button" className="btn btn-sm" onClick={handleCopy} disabled={!transcript.trim()}>Copy Text</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleInsert} disabled={!transcript.trim()}>
                  Insert into Message
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
