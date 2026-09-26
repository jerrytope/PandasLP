'use client'

import { useState } from 'react'
import BillingSettingsForm from './BillingSettingsForm'
import FinanceOverview from './FinanceOverview'
import InvoicesView from './InvoicesView'
import { useBillingSettings } from './shared'

type Sub = 'overview' | 'invoices' | 'settings'

export default function FinanceView() {
  const [sub, setSub] = useState<Sub>('overview')
  const { settings, reload } = useBillingSettings()

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="tablist" aria-label="Finance" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)' }}>
        {(['overview', 'invoices', 'settings'] as Sub[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={sub === s}
            onClick={() => {
              setSub(s)
              if (s !== 'settings') reload()
            }}
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
