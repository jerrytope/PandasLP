'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [msg, setMsg] = useState('Signing you in…')

  useEffect(() => {
    // supabase-js v2 detects the ?code= param automatically and exchanges it
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/dashboard')
    })

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) setMsg('Sign-in failed: ' + error.message)
      else if (session) router.replace('/dashboard')
    })

    const timer = setTimeout(() => setMsg('Taking longer than expected — check your email link and try again.'), 12000)
    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [router])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <p role="status" style={{ color: 'var(--text-muted)', fontSize: 15 }}>{msg}</p>
    </div>
  )
}
