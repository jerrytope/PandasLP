'use client'

import { useEffect, useRef, useState } from 'react'
import BillingSettingsForm from './BillingSettingsForm'
import FinanceOverview from './FinanceOverview'
import InvoicesView from './InvoicesView'
import { useBillingSettings } from './shared'
import type { FinanceSub as Sub } from '../shell/adminSections'

interface FinanceViewProps {
  /** Controlled by the URL (/admin?section=finance&sub=…) when given; see app/admin/page.tsx. */
  sub?: Sub
  onSubChange?: (sub: Sub) => void
}

export default function FinanceView({ sub: controlledSub, onSubChange }: FinanceViewProps = {}) {
  const [localSub, setLocalSub] = useState<Sub>('overview')
  const sub = controlledSub ?? localSub
  const setSub = onSubChange ?? setLocalSub
  const { settings, reload } = useBillingSettings()

  // Billing settings are refreshed when moving to Overview or Invoices — whether that came
  // from the tabs below or from the sidebar's Finance links. Skipped on first render, which
  // useBillingSettings already loads for.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (sub !== 'settings') reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="tablist" aria-label="Finance" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)' }}>
        {(['overview', 'invoices', 'settings'] as Sub[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={sub === s}
            onClick={() => setSub(s)}
            style={{
              all: 'unset', cursor: 'pointer', padding: '8px 12px', fontSize: 13, marginBottom: -1,
              fontWeight: sub === s ? 600 : 500,
              color: sub === s ? 'var(--text-1)' : 'var(--text-3)',
              borderBottom: `2px solid ${sub === s ? 'var(--accent)' : 'transparent'}`,
            }}
          >
            {s === 'overview' ? 'Overview' : s === 'invoices' ? 'Invoices' : 'Settings'}
          </button>
        ))}
      </div>
      {sub === 'overview' && <FinanceOverview />}
      {sub === 'invoices' && <InvoicesView settings={settings} />}
      {sub === 'settings' && <BillingSettingsForm />}
    </div>
  )
}
